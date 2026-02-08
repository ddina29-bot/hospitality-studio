
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType, EmploymentType } from '../types';

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
  initialHistoricalPayslip?: SavedPayslip | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView, initialHistoricalPayslip }) => {
  const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isCurrentUserAdmin = currentUserObj.role === 'admin';
  
  const canManageFinancials = isCurrentUserAdmin;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(isCurrentUserAdmin ? 'PENDING PAYOUTS' : 'PAYSLIP REGISTRY');
  
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('JAN 2026'); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-01-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-01-31');
  
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);
  const [isPreviewingCurrent, setIsPreviewingCurrent] = useState(false);

  const printContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setPayPeriodFrom(first.toISOString().split('T')[0]);
      setPayPeriodUntil(last.toISOString().split('T')[0]);
    }
  }, [selectedDocMonth]);

  const monthOptions = useMemo(() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months.map(m => `${m} 2026`);
  }, []);

  const filteredShifts = useMemo(() => {
    if (!payPeriodFrom || !payPeriodUntil) return [];
    const from = new Date(payPeriodFrom);
    const until = new Date(payPeriodUntil);
    until.setHours(23, 59, 59);

    // Extract year from doc selection to fix date parsing mismatch
    const contextYear = selectedDocMonth.split(' ').pop() || new Date().getFullYear().toString();

    return (shifts || []).filter(s => {
      if (!s.userIds?.includes(user.id) || s.status !== 'completed') return false;
      
      // FIX: Ensure the year used for parsing matches the payroll context year, not current wall-clock year
      const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${contextYear}`);
      return d >= from && d <= until;
    });
  }, [shifts, user.id, payPeriodFrom, payPeriodUntil, selectedDocMonth]);

  // MALTA 2026 REFINED TAX ENGINE
  const calculateMaltaTax = (monthlyGross: number, status: string, isParent: boolean, children: number) => {
    const annualGross = monthlyGross * 12;
    let tax = 0;

    if (isParent) {
      const isSingleParent = status === 'Single';
      const taxFreeLimit = isSingleParent ? 18500 : (children >= 2 ? 12500 : 10500);
      
      if (annualGross > taxFreeLimit) {
        const taxable = annualGross - taxFreeLimit;
        if (taxable <= 5000) tax = taxable * 0.15;
        else if (taxable <= 15000) tax = (5000 * 0.15) + (taxable - 5000) * 0.25;
        else tax = (5000 * 0.15) + (10000 * 0.25) + (taxable - 15000) * 0.35;
      }
    } else if (status === 'Married') {
      const taxFreeLimit = 12700;
      if (annualGross > taxFreeLimit) {
        if (annualGross <= 21200) tax = (annualGross - taxFreeLimit) * 0.15;
        else if (annualGross <= 28700) tax = (21200 - taxFreeLimit) * 0.15 + (annualGross - 21200) * 0.25;
        else tax = (21200 - taxFreeLimit) * 0.15 + (28700 - 21200) * 0.25 + (annualGross - 28700) * 0.35;
      }
    } else {
      const taxFreeLimit = 9100;
      if (annualGross > taxFreeLimit) {
        if (annualGross <= 14500) tax = (annualGross - taxFreeLimit) * 0.15;
        else if (annualGross <= 19500) tax = (14500 - taxFreeLimit) * 0.15 + (annualGross - 14500) * 0.25;
        else tax = (14500 - taxFreeLimit) * 0.15 + (19500 - 14500) * 0.25 + (annualGross - 19500) * 0.35;
      }
    }
    return Math.max(0, tax / 12);
  };

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        grossPay: activeHistoricalPayslip.grossPay,
        totalNet: activeHistoricalPayslip.netPay,
        tax: activeHistoricalPayslip.tax,
        ni: activeHistoricalPayslip.ni,
        govBonus: activeHistoricalPayslip.govBonus || 0,
        totalPerformanceBonus: 0,
        isHistorical: true,
        taxBand: 'Registry archived'
      };
    }

    let totalBase = 0;
    let totalPerformanceBonus = 0;

    // 1. CALCULATE SHIFT BASED EARNINGS
    if (user.paymentType === 'Fixed Wage') {
        totalBase = user.payRate || 0;
    } else {
        filteredShifts.forEach(s => {
            const prop = properties?.find(p => p.id === s.propertyId);
            const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
            const hours = Math.max(0.5, durationMs / (1000 * 60 * 60)); // Minimum 30 min log
            const hourlyEquivalent = hours * (user.payRate || 5.00);

            // Piece Rate Logic mapping specifically to all Supervisor/Cleaner types
            let targetPieceRate = 0;
            const sType = s.serviceType.toLowerCase();
            let isIndividualTask = false;

            if (sType.includes('check apartment') || sType.includes('audit')) {
                targetPieceRate = prop?.cleanerAuditPrice || 0;
                isIndividualTask = true; 
            } else if (sType.includes('to fix')) {
                targetPieceRate = s.fixWorkPayment || 0;
                isIndividualTask = true; 
            } else if (sType.includes('beds only')) {
                targetPieceRate = prop?.cleanerBedsOnlyPrice || 0;
            } else if (sType.includes('common area')) {
                targetPieceRate = prop?.cleanerCommonAreaPrice || 0;
            } else if (sType.includes('refresh')) {
                targetPieceRate = prop?.cleanerRefreshPrice || 0;
            } else if (sType.includes('mid stay')) {
                targetPieceRate = prop?.cleanerMidStayPrice || 0;
            } else if (sType.includes('check out') || sType.includes('check in')) {
                targetPieceRate = prop?.cleanerPrice || 0;
            } else {
                targetPieceRate = prop?.serviceRates?.[s.serviceType] || prop?.cleanerPrice || 0;
            }

            // Piece rates are shared by team unless individual
            const teamCount = s.userIds?.length || 1;
            const pieceRatePerPerson = isIndividualTask ? targetPieceRate : (targetPieceRate / teamCount);

            // Always pay base hourly
            totalBase += hourlyEquivalent;

            // PERFORMANCE BONUS: Difference between Piece-Rate and Hourly Floor
            if (s.approvalStatus !== 'rejected' && pieceRatePerPerson > hourlyEquivalent) {
                totalPerformanceBonus += (pieceRatePerPerson - hourlyEquivalent);
            }
        });
    }

    // 2. AUTOMATIC STATUTORY BONUS (Every 3 months in Malta)
    let govBonus = 0;
    const month = selectedDocMonth.split(' ')[0];
    const isFullTime = user.employmentType === 'Full-Time';
    const isPartTime = user.employmentType === 'Part-Time' || user.employmentType === 'Casual';
    
    if (isFullTime) {
        if (['MAR', 'SEP'].includes(month)) govBonus = 135.10;
        if (['JUN', 'DEC'].includes(month)) govBonus = 121.12;
    } else if (isPartTime) {
        if (['MAR', 'SEP'].includes(month)) govBonus = 67.55;
        if (['JUN', 'DEC'].includes(month)) govBonus = 60.56;
    }

    const actualGrossPay = manualGrossPay !== null ? manualGrossPay : (totalBase + totalPerformanceBonus + govBonus);
    const ni = Math.min(actualGrossPay * 0.1, 200); 
    const tax = calculateMaltaTax(actualGrossPay, user.maritalStatus || 'Single', !!user.isParent, user.childrenCount || 0);

    const isSingleParent = user.isParent && user.maritalStatus === 'Single';
    const childLabel = user.isParent 
        ? (isSingleParent ? 'Single Parent Rate' : `Parent (${user.childrenCount >= 2 ? '2+' : '1'})`) 
        : (user.maritalStatus === 'Married' ? 'Married Rate' : 'Single Rate');

    return {
      grossPay: actualGrossPay,
      ni,
      tax,
      govBonus,
      totalNet: Math.max(0, actualGrossPay - ni - tax),
      isHistorical: false,
      taxBand: childLabel,
      totalPerformanceBonus,
      totalBase
    };
  }, [filteredShifts, user, properties, activeHistoricalPayslip, manualGrossPay, selectedDocMonth]);

  const annualAccumulation = useMemo(() => {
    const yearSuffix = (activeHistoricalPayslip?.month || selectedDocMonth).split(' ').pop();
    if (!yearSuffix) return { ni: 0, tax: 0, gross: 0 };

    const relevantSaved = (user.payslips || []).filter(ps => 
      ps.month.endsWith(yearSuffix) && ps.id !== activeHistoricalPayslip?.id
    );

    let totalNI = relevantSaved.reduce((sum, ps) => sum + ps.ni, 0);
    let totalTax = relevantSaved.reduce((sum, ps) => sum + ps.tax, 0);
    let totalGross = relevantSaved.reduce((sum, ps) => sum + ps.grossPay, 0);

    totalNI += payrollData.ni;
    totalTax += payrollData.tax;
    totalGross += payrollData.grossPay;

    return { ni: totalNI, tax: totalTax, gross: totalGross, year: yearSuffix };
  }, [user.payslips, selectedDocMonth, activeHistoricalPayslip, payrollData]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;

    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: payPeriodFrom,
      periodUntil: payPeriodUntil,
      grossPay: payrollData.grossPay,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.ni,
      niWeeks: 4,
      govBonus: payrollData.govBonus,
      daysWorked: filteredShifts.length || 20,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'System'
    };

    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setIsPreviewingCurrent(false);
    alert("Record registered. Financial data archived to Studio Ledger.");
  };

  const psIdDisplay = (id?: string) => id ? `ID: ${id.split('-').pop()}` : 'PREVIEW_MODE';

  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

  return (
    <div className="bg-[#F8FAFC] min-h-full text-left pb-24 font-brand animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 space-y-8">
        
        <section className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 rounded-[1.2rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-2xl shadow-inner overflow-hidden border border-teal-100">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left">
                 <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">{user.role}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">NI: {user.niNumber || 'CODE_PENDING'} • {user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 text-center">CONTRACT</p>
                 <p className="text-[10px] font-black text-slate-900 text-center uppercase">{user.employmentType || 'UNSPECIFIED'}</p>
              </div>
              <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 text-center">TAX STATUS</p>
                 <p className="text-[10px] font-black text-teal-600 text-center uppercase">
                  {user.isParent ? (user.maritalStatus === 'Single' ? 'SINGLE PARENT' : `PARENT (${user.childrenCount >= 2 ? '2+' : '1'})`) : (user.maritalStatus || 'SINGLE')}
                 </p>
              </div>
           </div>
        </section>

        <div className="space-y-6">
           <div className="flex gap-8 border-b border-slate-200 w-full md:w-auto px-2 overflow-x-auto no-scrollbar">
              {['PENDING PAYOUTS', 'PAYSLIP REGISTRY', 'LEAVE REQUESTS'].map(tab => (
                 (tab === 'PENDING PAYOUTS' && !canManageFinancials) ? null :
                 <button 
                   key={tab}
                   onClick={() => setActiveSubTab(tab as any)}
                   className={`pb-3 text-[10px] font-black tracking-widest transition-all relative whitespace-nowrap ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}
                 >
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left duration-300"></div>}
                 </button>
              ))}
           </div>

           {activeSubTab === 'PENDING PAYOUTS' && canManageFinancials && (
             <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-8 text-left">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">Deployment Parameters</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                            <label className={subLabelStyle}>Calculation Month</label>
                            <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                               {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                         </div>
                         <div><label className={subLabelStyle}>Start Date</label><input type="date" className={inputStyle} value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} /></div>
                         <div><label className={subLabelStyle}>End Date</label><input type="date" className={inputStyle} value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} /></div>
                      </div>
                      <div className="pt-2">
                         <label className={subLabelStyle}>Manual Adjustment Override (€)</label>
                         <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || null)} placeholder="Enter custom gross" />
                      </div>
                   </div>
                   <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] flex flex-col justify-center text-center">
                      <p className={subLabelStyle}>Projected Net Payment</p>
                      <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none mb-1">€{payrollData.totalNet.toFixed(2)}</p>
                      <p className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest leading-none mt-1">Applying {payrollData.taxBand} (Malta 2026)</p>
                      <button onClick={() => setIsPreviewingCurrent(true)} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">GENERATE STATEMENT</button>
                   </div>
                </div>
             </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
             <section className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden text-left">
                <table className="w-full">
                   <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5 text-left">Period</th><th className="px-8 py-5 text-left">Lifecycle</th><th className="px-8 py-5 text-right">Net Value (€)</th><th className="px-8 py-5 text-right">Registry</th></tr></thead>
                   <tbody className="divide-y divide-slate-50">
                      {(user.payslips || []).length === 0 ? (
                         <tr><td colSpan={4} className="px-10 py-16 text-center opacity-20 text-[10px] font-black uppercase tracking-widest">No archived records found</td></tr>
                      ) : [...(user.payslips || [])].reverse().map(ps => (
                         <tr key={ps.id}>
                            <td className="px-8 py-5 text-[10px] font-black text-slate-900 uppercase">{ps.month}</td>
                            <td className="px-8 py-5 text-[9px] font-bold text-slate-400 uppercase">{ps.periodFrom} — {ps.periodUntil}</td>
                            <td className="px-8 py-5 text-right text-xs font-black text-[#0D9488]">€{ps.netPay.toFixed(2)}</td>
                            <td className="px-8 py-5 text-right"><button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-teal-50 text-teal-700 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase border border-teal-100">View Doc</button></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </section>
           )}
        </div>
      </div>

      {(viewingDoc || isPreviewingCurrent) && (
        <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-2 md:p-6 backdrop-blur-xl overflow-y-auto">
           <div className="bg-white rounded-[1.5rem] w-full max-w-3xl p-6 md:p-14 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border-2 border-slate-100">
              <button onClick={() => { setViewingDoc(null); setIsPreviewingCurrent(false); setActiveHistoricalPayslip(null); }} className="absolute top-6 right-6 md:top-10 md:right-10 text-slate-300 hover:text-slate-900 no-print font-black text-2xl transition-colors">&times;</button>
              
              <div ref={printContentRef} className="space-y-12 text-slate-900">
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                    <div className="space-y-3">
                       <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO OPERATIONAL CORE'}</h1>
                       <div className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] space-y-1">
                          <p>PE NO: <span className="text-slate-900">{organization?.peNumber || 'PE 000000'}</span> • VAT: <span className="text-slate-900">{organization?.taxId || 'MT 00000000'}</span></p>
                          <p className="max-w-[280px] leading-relaxed italic">{organization?.address || 'ADDRESS_NOT_REGISTERED'}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <h2 className="text-lg font-black uppercase tracking-[0.25em] bg-slate-900 text-white px-6 py-2">PAYSLIP</h2>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-4 tracking-widest">{psIdDisplay(activeHistoricalPayslip?.id)}</p>
                    </div>
                 </header>

                 <div className="grid grid-cols-2 gap-10 border-b border-slate-100 pb-10">
                    <div className="space-y-4">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">PERSONNEL FILE</p>
                       <div className="space-y-1.5">
                          <p className="text-base font-black uppercase">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-[250px]">{user.homeAddress || '---'}</p>
                       </div>
                    </div>
                    <div className="space-y-4 text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">COMPLIANCE ID</p>
                       <div className="text-[10px] font-bold text-slate-700 uppercase space-y-1.5">
                          <p>Doc #: <span className="font-black text-slate-900">{user.idPassportNumber || '---'}</span></p>
                          <p>NI No: <span className="font-black text-slate-900">{user.niNumber || '---'}</span></p>
                          <p>Rate: <span className="font-black text-teal-600 uppercase">{payrollData.taxBand}</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-6 border border-slate-200 flex justify-between items-center rounded-xl shadow-inner">
                    <div className="space-y-0.5 text-left">
                        <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cycle Window</p>
                        <p className="text-[10px] md:text-xs font-black text-slate-900 uppercase">
                           {activeHistoricalPayslip?.periodFrom || payPeriodFrom} TO {activeHistoricalPayslip?.periodUntil || payPeriodUntil}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Statement</p>
                        <p className="text-[10px] md:text-xs font-black text-slate-900 uppercase">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                    </div>
                 </div>

                 <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                       <div className="space-y-5 text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">EARNINGS</p>
                          <div className="flex justify-between text-xs font-bold"><span>Basic Remuneration</span><span className="font-mono">€{(payrollData.totalBase || payrollData.grossPay - (payrollData.totalPerformanceBonus || 0) - (payrollData.govBonus || 0)).toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs font-bold text-teal-600"><span>Performance Top-up</span><span className="font-mono">€{(payrollData.totalPerformanceBonus || 0).toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs font-bold text-indigo-600"><span>Statutory Bonus</span><span className="font-mono">€{(payrollData.govBonus || 0).toFixed(2)}</span></div>
                       </div>
                       <div className="space-y-5 text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">DEDUCTIONS</p>
                          <div className="flex justify-between text-xs font-bold text-rose-600"><span>SSC / NI (10%)</span><span className="font-mono">-€{payrollData.ni.toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs font-bold text-rose-600"><span>Income Tax ({payrollData.taxBand})</span><span className="font-mono">-€{payrollData.tax.toFixed(2)}</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-between items-center py-6 border-y border-slate-100">
                    <span className="text-base font-black uppercase tracking-tight text-slate-900">Net Payable</span>
                    <span className="text-base font-black text-emerald-600 font-mono tracking-tighter">€{payrollData.totalNet.toFixed(2)}</span>
                 </div>

                 <div className="bg-slate-900 p-8 rounded-[1.5rem] text-white space-y-6 shadow-xl text-left">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-400">Fiscal Period Overview</p>
                       <p className="text-[10px] font-black uppercase text-white/40">{annualAccumulation.year} TAX YEAR</p>
                    </div>
                    <div className="grid grid-cols-3 gap-8">
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Total NI</p>
                          <p className="text-xl font-black tracking-tight">€{annualAccumulation.ni.toFixed(2)}</p>
                       </div>
                       <div className="space-y-1 text-center">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Total Tax</p>
                          <p className="text-xl font-black tracking-tight">€{annualAccumulation.tax.toFixed(2)}</p>
                       </div>
                       <div className="space-y-1 text-right">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Total Gross</p>
                          <p className="text-xl font-black tracking-tight text-teal-400">€{annualAccumulation.gross.toFixed(2)}</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-100 text-center">
                    <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.5em]">CERTIFIED BY RESET STUDIO OPS CORE • MALTA 2026</p>
                 </div>
              </div>

              {!payrollData.isHistorical && (
                <div className="flex flex-col sm:flex-row gap-4 pt-10 no-print">
                   <button onClick={handleCommitPayslip} className="flex-[2] bg-emerald-600 text-white font-black py-5 md:py-6 rounded-2xl uppercase tracking-[0.25em] text-[10px] md:text-[11px] shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all">Confirm & Archive</button>
                   <button onClick={() => setIsPreviewingCurrent(false)} className="flex-1 bg-slate-100 border border-slate-200 text-slate-400 font-black py-5 md:py-6 rounded-2xl uppercase tracking-widest text-[10px] md:text-[11px] hover:bg-slate-200">Discard</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
