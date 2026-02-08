
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
  const isViewingSelf = currentUserObj.id === user.id;
  
  const canManageFinancials = isCurrentUserAdmin;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(isCurrentUserAdmin ? 'PENDING PAYOUTS' : 'PAYSLIP REGISTRY');
  
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

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

    return (shifts || []).filter(s => {
      if (!s.userIds?.includes(user.id) || s.status !== 'completed') return false;
      const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${new Date().getFullYear()}`);
      return d >= from && d <= until;
    });
  }, [shifts, user.id, payPeriodFrom, payPeriodUntil]);

  // MALTA 2026 REFINED TAX ENGINE
  const calculateMaltaTax = (monthlyGross: number, status: string, isParent: boolean, children: number) => {
    let tax = 0;
    const annualGross = monthlyGross * 12;

    if (isParent) {
      if (children >= 2) {
        // Parent Rate (2+ children): 2026 Projected Tax Free up to €12,500
        if (annualGross > 12500) tax = (annualGross - 12500) * 0.10;
      } else {
        // Parent Rate (1 child): 2026 Projected Tax Free up to €10,500
        if (annualGross > 10500) tax = (annualGross - 10500) * 0.12;
      }
    } else if (status === 'Married') {
      // Married Rate: 2026 Projected Tax Free up to €9,300
      if (annualGross > 9300) tax = (annualGross - 9300) * 0.15;
    } else {
      // Single Rate: 2026 Projected Tax Free up to €8,500
      if (annualGross > 8500) tax = (annualGross - 8500) * 0.15;
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
        isHistorical: true,
        taxBand: 'Archived'
      };
    }

    let totalBase = 0;
    let totalPerformanceBonus = 0;
    let totalAuditFees = 0;

    if (user.paymentType === 'Fixed Wage') {
        totalBase = user.payRate || 0;
    } else {
        filteredShifts.forEach(s => {
            const prop = properties?.find(p => p.id === s.propertyId);
            const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
            const hours = durationMs / (1000 * 60 * 60);
            const shiftBase = hours * (user.payRate || 5.00);

            if (user.paymentType === 'Per Hour') totalBase += shiftBase;

            if (s.approvalStatus === 'approved' && prop) {
                const isCleaningShift = !['TO CHECK APARTMENT', 'SUPPLY DELIVERY', 'TO FIX'].includes(s.serviceType);
                if (isCleaningShift) {
                    const teamCount = s.userIds?.length || 1;
                    const targetPieceRate = (prop.serviceRates?.[s.serviceType] || prop.cleanerPrice) / teamCount;
                    if (targetPieceRate > shiftBase) totalPerformanceBonus += (targetPieceRate - shiftBase);
                    else if (user.paymentType === 'Per Clean') totalBase += targetPieceRate; 
                }
                if (s.serviceType === 'TO CHECK APARTMENT' && (user.role === 'supervisor' || user.role === 'housekeeping')) totalAuditFees += (prop.cleanerAuditPrice || 0);
                if (s.serviceType === 'TO FIX' && s.fixWorkPayment) totalPerformanceBonus += s.fixWorkPayment;
            }
        });
    }

    const actualGrossPay = manualGrossPay !== null ? manualGrossPay : (totalBase + totalPerformanceBonus + totalAuditFees);
    const ni = Math.min(actualGrossPay * 0.1, 200); 
    const tax = calculateMaltaTax(actualGrossPay, user.maritalStatus || 'Single', !!user.isParent, user.childrenCount || 0);

    const childLabel = user.isParent ? (user.childrenCount && user.childrenCount >= 2 ? 'Parent 2+' : 'Parent 1') : null;

    return {
      grossPay: actualGrossPay,
      ni,
      tax,
      govBonus: 0,
      totalNet: Math.max(0, actualGrossPay - ni - tax),
      isHistorical: false,
      taxBand: childLabel || (user.maritalStatus === 'Married' ? 'Married' : 'Single')
    };
  }, [filteredShifts, user, payPeriodFrom, payPeriodUntil, properties, activeHistoricalPayslip, manualGrossPay]);

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
      generatedBy: currentUserObj.name || 'Admin User'
    };

    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setIsPreviewingCurrent(false);
    alert("Official Record Successfully Registered in Studio Ledger.");
  };

  const psIdDisplay = (id?: string) => id ? `Ref: ${id.split('-').pop()}` : 'PREVIEW_UNCOMMITTED';

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
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">NI: {user.niNumber || 'REQUIRED'} • {user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 text-center">CONTRACT</p>
                 <p className="text-[10px] font-black text-slate-900 text-center uppercase">{user.employmentType || 'NOT SET'}</p>
              </div>
              <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 text-center">TAX STATUS</p>
                 <p className="text-[10px] font-black text-teal-600 text-center uppercase">
                  {user.maritalStatus || 'SINGLE'} {user.isParent ? `(PARENT ${user.childrenCount || 1})` : ''}
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
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">Calculation Parameters</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                            <label className={subLabelStyle}>Billing Cycle</label>
                            <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                               {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                         </div>
                         <div><label className={subLabelStyle}>From</label><input type="date" className={inputStyle} value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} /></div>
                         <div><label className={subLabelStyle}>Until</label><input type="date" className={inputStyle} value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} /></div>
                      </div>
                      <div className="pt-2">
                         <label className={subLabelStyle}>Manual Adjustment Override (€)</label>
                         <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || null)} placeholder="Enter custom gross" />
                      </div>
                   </div>
                   <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] flex flex-col justify-center text-center">
                      <p className={subLabelStyle}>Estimated Net Payout</p>
                      <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none mb-1">€{payrollData.totalNet.toFixed(2)}</p>
                      <p className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest">Applying {payrollData.taxBand} Tax Band (Malta 2026)</p>
                      <button onClick={() => setIsPreviewingCurrent(true)} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">PREVIEW PAYSLIP</button>
                   </div>
                </div>
             </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
             <section className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden text-left">
                <table className="w-full">
                   <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5 text-left">Month</th><th className="px-8 py-5 text-left">Period</th><th className="px-8 py-5 text-right">Net (€)</th><th className="px-8 py-5 text-right">Action</th></tr></thead>
                   <tbody className="divide-y divide-slate-50">
                      {(user.payslips || []).length === 0 ? (
                         <tr><td colSpan={4} className="px-10 py-16 text-center opacity-20 text-[10px] font-black uppercase">No records found</td></tr>
                      ) : [...(user.payslips || [])].reverse().map(ps => (
                         <tr key={ps.id}>
                            <td className="px-8 py-5 text-[10px] font-black text-slate-900 uppercase">{ps.month}</td>
                            <td className="px-8 py-5 text-[9px] font-bold text-slate-400">{ps.periodFrom} — {ps.periodUntil}</td>
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
        <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[1rem] w-full max-w-3xl p-8 md:p-12 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border border-slate-100">
              <button onClick={() => { setViewingDoc(null); setIsPreviewingCurrent(false); setActiveHistoricalPayslip(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 no-print font-black text-xl">&times;</button>
              
              <div ref={printContentRef} className="space-y-10 text-slate-900">
                 {/* BUSINESS HEADER */}
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                    <div className="space-y-2">
                       <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                       <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest space-y-0.5">
                          <p>PE Number: {organization?.peNumber || 'PE 12345'}</p>
                          <p>VAT: {organization?.taxId || 'MT 10002000'}</p>
                          <p className="max-w-[240px] leading-relaxed">{organization?.address || 'MALTA HQ'}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <h2 className="text-base font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-4 py-1.5">PAYSLIP</h2>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-4 tracking-widest">{psIdDisplay(activeHistoricalPayslip?.id)}</p>
                    </div>
                 </header>

                 {/* EMPLOYEE SECTION */}
                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">EMPLOYEE DETAILS</p>
                       <div className="space-y-1">
                          <p className="text-sm font-black uppercase">{user.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">{user.homeAddress || 'ADDRESS NOT RECORDED'}</p>
                       </div>
                    </div>
                    <div className="space-y-4 text-right">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">STATUTORY CODES</p>
                       <div className="text-[9px] font-bold text-slate-700 uppercase space-y-1">
                          <p>ID Card: <span className="font-black text-slate-900">{user.idPassportNumber || 'N/A'}</span></p>
                          <p>NI Number: <span className="font-black text-slate-900">{user.niNumber || 'N/A'}</span></p>
                       </div>
                    </div>
                 </div>

                 {/* PERIOD STRIP */}
                 <div className="bg-slate-50 p-4 border-y border-slate-200 flex justify-between items-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Cycle Period</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase">
                       {activeHistoricalPayslip?.periodFrom || payPeriodFrom} TO {activeHistoricalPayslip?.periodUntil || payPeriodUntil}
                    </p>
                 </div>

                 {/* FINANCIAL BREAKDOWN */}
                 <div className="space-y-8">
                    <div className="flex justify-between border-b-4 border-slate-900 pb-6 text-4xl font-black text-emerald-600">
                       <span className="uppercase tracking-tighter">Net Pay</span>
                       <span>€{payrollData.totalNet.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-4">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">EARNINGS</p>
                          <div className="flex justify-between text-[11px] font-bold"><span>Gross Basic Salary</span><span>€{payrollData.grossPay.toFixed(2)}</span></div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-300"><span>Govt. Bonuses</span><span>€0.00</span></div>
                       </div>
                       <div className="space-y-4">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">STATUTORY DEDUCTIONS</p>
                          <div className="flex justify-between text-[11px] font-bold text-rose-600"><span>Social Security (NI 10%)</span><span>-€{payrollData.ni.toFixed(2)}</span></div>
                          <div className="flex justify-between text-[11px] font-bold text-rose-600"><span>Income Tax ({payrollData.taxBand})</span><span>-€{payrollData.tax.toFixed(2)}</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-10 border-t border-slate-100 text-center">
                    <p className="text-[7px] font-black uppercase text-slate-300 tracking-[0.3em]">OFFICIALLY GENERATED FOR MALTA 2026 COMPLIANCE</p>
                 </div>
              </div>

              {!payrollData.isHistorical && (
                <div className="flex gap-4 pt-6 no-print">
                   <button onClick={handleCommitPayslip} className="flex-[2] bg-emerald-600 text-white font-black py-5 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-emerald-700 active:scale-95 transition-all">CONFIRM & COMMIT TO REGISTRY</button>
                   <button onClick={() => setIsPreviewingCurrent(false)} className="flex-1 bg-slate-100 border border-slate-200 text-slate-400 font-black py-5 rounded-xl uppercase tracking-widest text-[10px]">Cancel</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
