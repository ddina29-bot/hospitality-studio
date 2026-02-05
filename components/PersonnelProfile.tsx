
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
  
  // Rule: ONLY Admins can access the generator/terminal.
  const canManagePayslip = isCurrentUserAdmin;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeModule, setActiveModule] = useState<'PAYROLL' | 'INVOICING' | 'RECORDS'>('PAYROLL');
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY'>('PAYSLIP REGISTRY');
  const [isPrinting, setIsPrinting] = useState(false);
  
  // 2026 COMPLIANCE STATES
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('JAN 2026'); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-01-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-01-31');
  
  // DYNAMIC WAGE STATE
  const [contractualGross, setContractualGross] = useState<number | null>(user.payRate || 1333.33); 
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);

  useEffect(() => {
    if (user.payRate) setContractualGross(user.payRate);
    setEditMaritalStatus(user.maritalStatus || 'Single');
    setEditIsParent(!!user.isParent);
    setEditChildrenCount(user.childrenCount || 0);
    setEditPhone(user.phone || '');
    setEditPayRate(user.payRate || 5.00);
    setEditPaymentType(user.paymentType || 'Per Hour');
    setEditEmploymentType(user.employmentType || 'Full-Time');
  }, [user.id, user.payRate, user.maritalStatus, user.isParent, user.childrenCount, user.phone, user.paymentType, user.employmentType]);
  
  useEffect(() => {
    if (initialHistoricalPayslip) {
      setActiveHistoricalPayslip(initialHistoricalPayslip);
      setViewingDoc('payslip');
    }
  }, [initialHistoricalPayslip]);

  const printContentRef = useRef<HTMLDivElement>(null);

  // Sync dates when month dropdown changes
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

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editMaritalStatus, setEditMaritalStatus] = useState(user.maritalStatus || 'Single');
  const [editIsParent, setEditIsParent] = useState(user.isParent || false);
  const [editChildrenCount, setEditChildrenCount] = useState(user.childrenCount || 0);
  const [editPayRate, setEditPayRate] = useState(user.payRate || 5.00);
  const [editPaymentType, setEditPaymentType] = useState<PaymentType>(user.paymentType || 'Per Hour');
  const [editEmploymentType, setEditEmploymentType] = useState<EmploymentType>(user.employmentType || 'Full-Time');

  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const detailValueStyle = "text-sm font-bold text-slate-900 uppercase tracking-tight";
  const editInputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none focus:border-teal-500 transition-all";

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

  const countMondaysInRange = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    let count = 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() === 1) count++; 
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const getStatutoryBonus = (monthLabel: string, actualHours: number, isFixed: boolean, daysInPeriod: number, daysInMonth: number) => {
    let baseAmount = 0;
    if (monthLabel.includes('MAR') || monthLabel.includes('SEP')) baseAmount = 121.16;
    if (monthLabel.includes('JUN') || monthLabel.includes('DEC')) baseAmount = 135.10;
    if (baseAmount === 0) return 0;
    const factor = isFixed ? (daysInPeriod / daysInMonth) : (actualHours / 173);
    return baseAmount * Math.min(1, factor);
  };

  const calculateMalteseTax = (annualGross: number, status: string, isParent: boolean, childrenCount: number) => {
    if (isParent) {
        const threshold = childrenCount >= 2 ? 18500 : 10500;
        if (annualGross <= threshold) return 0;
        if (childrenCount >= 2) {
            if (annualGross <= 60000) return (annualGross - threshold) * 0.25;
            else return (annualGross - 60000) * 0.35 + (60000 - threshold) * 0.25;
        } else {
            if (annualGross <= 15800) return (annualGross - 10500) * 0.15;
            else if (annualGross <= 60000) return (annualGross - 15800) * 0.25 + 795;
            else return (annualGross - 60000) * 0.35 + 11845;
        }
    } 
    if (status === 'Married') {
        if (annualGross <= 12700) return 0;
        else if (annualGross <= 21200) return (annualGross - 12700) * 0.15;
        else if (annualGross <= 60000) return (annualGross - 21200) * 0.25 + 1275;
        else return (annualGross - 60000) * 0.35 + 10975;
    }
    if (annualGross <= 9100) return 0;
    else if (annualGross <= 14500) return (annualGross - 9100) * 0.15;
    else if (annualGross <= 60000) return (annualGross - 14500) * 0.25 + 810;
    else return (annualGross - 60000) * 0.35 + 12185;
  };

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        ...activeHistoricalPayslip,
        tax: activeHistoricalPayslip.tax,
        grossPay: activeHistoricalPayslip.grossPay,
        totalNet: activeHistoricalPayslip.netPay,
        daysInPeriod: activeHistoricalPayslip.daysWorked,
        niWeeks: activeHistoricalPayslip.niWeeks,
        govBonus: activeHistoricalPayslip.govBonus,
        ni: activeHistoricalPayslip.ni
      };
    }

    const from = new Date(payPeriodFrom);
    const until = new Date(payPeriodUntil);
    const daysWorked = Math.ceil((until.getTime() - from.getTime()) / (1000 * 3600 * 24)) + 1;
    const monthRef = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const totalDaysInMonth = monthRef.getDate();

    let totalBase = 0;
    let totalBonus = 0;
    let totalHours = 0;

    if (contractualGross && contractualGross > 0 && user.paymentType === 'Fixed Wage') {
       totalBase = (contractualGross / totalDaysInMonth) * daysWorked;
       totalHours = (173 / totalDaysInMonth) * daysWorked;
    } else {
        filteredShifts.forEach(s => {
          const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
          const hours = durationMs / (1000 * 60 * 60);
          totalHours += hours;
          const shiftBase = hours * (user.payRate || 5.00);
          totalBase += shiftBase;
          if (s.approvalStatus === 'approved') {
              const prop = properties?.find(p => p.id === s.propertyId);
              if (prop && user.paymentType === 'Per Clean') {
                  const teamCount = s.userIds?.length || 1;
                  const target = prop.cleanerPrice / teamCount;
                  totalBonus += Math.max(0, target - shiftBase);
              }
              if (s.serviceType === 'TO FIX' && s.fixWorkPayment) totalBonus += s.fixWorkPayment;
          }
        });
    }

    const govBonus = getStatutoryBonus(selectedDocMonth, totalHours, user.paymentType === 'Fixed Wage', daysWorked, totalDaysInMonth);
    const actualGrossPay = manualGrossPay !== null ? manualGrossPay : (totalBase + totalBonus + govBonus);
    
    const weeklyActual = actualGrossPay / (daysWorked / 7);
    const weeklyNI = Math.max(0, Math.min(60.12, weeklyActual * 0.10)); 
    const niWeeks = countMondaysInRange(payPeriodFrom, payPeriodUntil);
    const totalNI = weeklyNI * niWeeks;
    
    const annualProj = (actualGrossPay * (totalDaysInMonth / daysWorked)) * 12;
    const annualTax = calculateMalteseTax(annualProj, user.maritalStatus || 'Single', !!user.isParent, user.childrenCount || 0);
    const proRataTax = (annualTax / 12 / totalDaysInMonth) * daysWorked;

    return {
      daysInPeriod: daysWorked,
      totalDaysInMonth,
      niWeeks,
      govBonus,
      grossPay: actualGrossPay,
      ni: totalNI,
      tax: proRataTax,
      totalNet: Math.max(0, actualGrossPay - totalNI - proRataTax)
    };
  }, [filteredShifts, user, payPeriodFrom, payPeriodUntil, contractualGross, manualGrossPay, properties, selectedDocMonth, activeHistoricalPayslip]);

  const handlePrint = () => {
    if (!printContentRef.current) return;
    setIsPrinting(true);
    const content = printContentRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`
            <html><head><title>Payroll Record</title><script src="https://cdn.tailwindcss.com"></script><style>@media print { .no-print { display: none; } body { background: white; margin: 0; padding: 20px; } }</style></head><body>${content}</body><script>window.onload=function(){setTimeout(function(){window.print();},500);}</script></html>
        `);
        printWindow.document.close();
        setTimeout(() => setIsPrinting(false), 1000);
    }
  };

  const handleSaveProfile = () => {
    if (onUpdateUser) {
      onUpdateUser({ 
        ...user, 
        phone: editPhone, 
        maritalStatus: editMaritalStatus, 
        isParent: editIsParent, 
        childrenCount: editChildrenCount,
        payRate: editPayRate,
        paymentType: editPaymentType,
        employmentType: editEmploymentType
      });
    }
    setIsEditingProfile(false);
  };

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    
    const confirmCommit = window.confirm(`CONFIRM FINANCIAL COMMITMENT:\n\nYou are about to freeze this record into ${user.name}'s permanent file. This action generates a historical payslip.`);

    if (!confirmCommit) return;

    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: payPeriodFrom,
      periodUntil: payPeriodUntil,
      grossPay: payrollData.grossPay,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.ni,
      niWeeks: payrollData.niWeeks,
      govBonus: payrollData.govBonus,
      daysWorked: payrollData.daysInPeriod,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'Admin User'
    };

    const updatedPayslips = [...(user.payslips || []), newPayslip];
    onUpdateUser({ ...user, payslips: updatedPayslips });
    alert("Record committed to registry.");
  };

  const viewHistoricalPayslip = (ps: SavedPayslip) => {
    setActiveHistoricalPayslip(ps);
    setViewingDoc('payslip');
  };

  const formatDateRange = (from: string, until: string) => {
    const f = from.split('-').reverse().join('/');
    const u = until.split('-').reverse().join('/');
    return `${f} - ${u}`;
  };

  const visibleSubTabs = useMemo(() => {
    return canManagePayslip ? ['PENDING PAYOUTS', 'PAYSLIP REGISTRY'] : ['PAYSLIP REGISTRY'];
  }, [canManagePayslip]);

  return (
    <div className="bg-[#F0FDFA] min-h-screen text-left pb-24 font-brand animate-in fade-in duration-500">
      {/* Top connecteam-style Nav Modules */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-teal-50 px-6 py-2 shadow-sm flex gap-4 overflow-x-auto no-scrollbar">
         {['PAYROLL', 'INVOICING', 'RECORDS'].map(mod => (
            <button 
              key={mod}
              onClick={() => setActiveModule(mod as any)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-[0.1em] transition-all whitespace-nowrap ${activeModule === mod ? 'bg-[#0D9488] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
               {mod}
            </button>
         ))}
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-8 space-y-10">
        {/* Profile Card Summary */}
        <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-3xl shadow-inner overflow-hidden border border-teal-100">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left">
                 <h2 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">CONTRACT</p>
                 <p className="text-xs font-bold text-slate-900 text-center">{user.employmentType || 'Full-Time'}</p>
              </div>
              <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">RATE</p>
                 <p className="text-xs font-bold text-slate-900 text-center">€{user.payRate?.toFixed(2)} / {user.paymentType === 'Per Hour' ? 'HR' : 'CLEAN'}</p>
              </div>
           </div>
        </section>

        {/* Financial Terminal / Registry Suite */}
        <div className="space-y-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="flex gap-10 border-b border-slate-200 w-full md:w-auto px-4">
                 {visibleSubTabs.map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setActiveSubTab(tab as any)}
                      className={`pb-4 text-[10px] md:text-[11px] font-black tracking-widest transition-all relative ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}
                    >
                       {tab}
                       {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left duration-300"></div>}
                    </button>
                 ))}
              </div>
              
              {activeSubTab === 'PENDING PAYOUTS' && canManagePayslip && (
                 <button onClick={() => { setActiveHistoricalPayslip(null); setViewingDoc('payslip'); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    PREVIEW LIVE CALCULATION
                 </button>
              )}
           </div>

           <div className="animate-in slide-in-from-bottom-4 duration-500">
              {activeSubTab === 'PENDING PAYOUTS' && canManagePayslip ? (
                /* LIVE GENERATOR INTERFACE - ADMIN ONLY */
                <section className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-10 shadow-lg space-y-10">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Configuration Terminal</h3>
                            <p className="text-[10px] text-slate-400 font-medium">Select period parameters for the calculation.</p>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                               <label className={subLabelStyle}>Month Focus</label>
                               <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest" value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                               </select>
                            </div>
                            <div>
                               <label className={subLabelStyle}>Period Start</label>
                               <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-bold" value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} />
                            </div>
                            <div>
                               <label className={subLabelStyle}>Period End</label>
                               <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-bold" value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} />
                            </div>
                         </div>
                      </div>

                      <div className="flex flex-col gap-6 justify-center">
                         <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center justify-between shadow-inner">
                            <div className="text-left">
                               <p className={subLabelStyle}>Projected Net</p>
                               <p className="text-5xl font-black text-emerald-700 tracking-tighter">€{payrollData.totalNet.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Gross Base</p>
                               <p className="text-base font-bold text-emerald-600/60 mt-1">€{payrollData.grossPay.toFixed(2)}</p>
                            </div>
                         </div>
                         <button 
                           onClick={handleCommitPayslip}
                           className="w-full bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-1.5"
                         >
                            <span>COMMIT TO RECORD</span>
                            <span className="text-[7px] opacity-60">Authorize official document creation</span>
                         </button>
                      </div>
                   </div>
                </section>
              ) : (
                /* OFFICIAL REGISTRY - CONNECTEAM STYLE */
                <section className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col">
                   {/* Table View - Desktop */}
                   <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gross (€)</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {(user.payslips || []).length === 0 ? (
                               <tr>
                                  <td colSpan={6} className="px-10 py-32 text-center opacity-20 grayscale">
                                     <span className="text-4xl block mb-4">📑</span>
                                     <p className="text-[10px] font-black uppercase tracking-widest">No generated payslips found in registry</p>
                                  </td>
                               </tr>
                            ) : [...(user.payslips || [])].reverse().map(ps => (
                               <tr key={ps.id} className="hover:bg-slate-50/60 transition-colors group cursor-pointer" onClick={() => viewHistoricalPayslip(ps)}>
                                  <td className="px-10 py-8">
                                     <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">{user.name}</p>
                                     <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role}</p>
                                  </td>
                                  <td className="px-10 py-8">
                                     <p className="text-[11px] font-black text-slate-900 uppercase">{ps.month}</p>
                                  </td>
                                  <td className="px-10 py-8">
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDateRange(ps.periodFrom, ps.periodUntil)}</p>
                                  </td>
                                  <td className="px-10 py-8 text-right">
                                     <p className="text-sm font-bold text-slate-900 tracking-tight">€{ps.grossPay.toFixed(2)}</p>
                                  </td>
                                  <td className="px-10 py-8 text-right">
                                     <p className="text-sm font-black text-[#0D9488] tracking-tight">€{ps.netPay.toFixed(2)}</p>
                                  </td>
                                  <td className="px-10 py-8 text-right">
                                     <button 
                                       className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-teal-700 active:scale-95 transition-all"
                                     >
                                       VIEW DOC
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>

                   {/* List View - Mobile */}
                   <div className="md:hidden divide-y divide-slate-100">
                      {(user.payslips || []).length === 0 ? (
                         <div className="px-6 py-20 text-center opacity-20">
                            <p className="text-[10px] font-black uppercase tracking-widest">Registry Empty</p>
                         </div>
                      ) : [...(user.payslips || [])].reverse().map(ps => (
                         <div key={ps.id} className="p-6 bg-white space-y-4 active:bg-slate-50 transition-colors" onClick={() => viewHistoricalPayslip(ps)}>
                            <div className="flex justify-between items-start">
                               <div>
                                  <p className="text-[11px] font-black text-slate-900 uppercase">{ps.month}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{formatDateRange(ps.periodFrom, ps.periodUntil)}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-lg font-black text-[#0D9488] leading-none">€{ps.netPay.toFixed(2)}</p>
                                  <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-1">NET PAYABLE</p>
                               </div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                               <span className="text-[8px] font-bold text-slate-400 uppercase">Gross: €{ps.grossPay.toFixed(2)}</span>
                               <button className="bg-[#0D9488] text-white px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">VIEW</button>
                            </div>
                         </div>
                      ))}
                   </div>
                </section>
              )}
           </div>
        </div>
      </div>

      {/* Official Doc Modal (Static PDF-style) */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-3xl p-10 md:p-14 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 no-print font-black text-xl">&times;</button>
              
              <div ref={printContentRef} className="space-y-12">
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                    <div className="text-left space-y-2">
                       <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                       <p className="text-[11px] font-black text-teal-600 uppercase tracking-widest">PE NO: {organization?.peNumber || 'N/A'}</p>
                       <div className="mt-6">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Pay Period</p>
                          <p className="text-[11px] font-black text-slate-900">
                             {activeHistoricalPayslip ? formatDateRange(activeHistoricalPayslip.periodFrom, activeHistoricalPayslip.periodUntil) : formatDateRange(payPeriodFrom, payPeriodUntil)}
                          </p>
                    </div>
                    </div>
                    <div className="text-right space-y-4">
                       <h2 className="text-lg font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-6 py-1.5 inline-block">OFFICIAL PAYSLIP</h2>
                       <div className="text-right">
                          <p className="text-sm font-black text-slate-900 uppercase leading-none">{user.name}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 mt-2 uppercase">ID: {user.idPassportNumber || '---'}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 uppercase">NI: {user.niNumber || '---'}</p>
                       </div>
                    </div>
                 </header>

                 <div className="space-y-10">
                    <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-4 mb-4">
                       <span>Description</span>
                       <span className="text-center">Basis</span>
                       <span className="text-right">Amount (€)</span>
                    </div>
                    <div className="space-y-5">
                       <div className="grid grid-cols-3 text-xs font-bold text-slate-700">
                          <span className="uppercase">Calculated Earnings</span>
                          <span className="text-center text-slate-400">{payrollData.daysInPeriod} DAYS</span>
                          <span className="text-right font-black">€{(payrollData.grossPay - payrollData.govBonus).toFixed(2)}</span>
                       </div>
                       {payrollData.govBonus > 0 && (
                          <div className="grid grid-cols-3 text-xs font-bold text-emerald-600">
                             <span className="uppercase">Statutory Gov. Bonus</span>
                             <span className="text-center">PRO-RATA</span>
                             <span className="text-right font-black">€{payrollData.govBonus.toFixed(2)}</span>
                          </div>
                       )}
                       <div className="grid grid-cols-3 pt-6 border-t-4 border-slate-900 mt-6 font-black text-slate-900 text-2xl">
                          <span className="uppercase tracking-tighter">Gross Wage</span>
                          <span></span>
                          <span className="text-right font-black">€{payrollData.grossPay.toFixed(2)}</span>
                       </div>
                    </div>

                    <div className="pt-10 space-y-6">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Deductions (Malta 2026 Statutory)</p>
                       <div className="space-y-4 text-xs font-bold">
                          <div className="flex justify-between items-center">
                             <span className="text-slate-500 uppercase">FSS PAYE Tax ({user.isParent ? `Parent ${user.childrenCount}+` : user.maritalStatus || 'Single'} Computation)</span>
                             <span className="text-slate-900 font-black">-€{payrollData.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-slate-500 uppercase">SSC Class 1 NI ({payrollData.niWeeks} Weeks • 10% Basis)</span>
                             <span className="text-slate-900 font-black">-€{payrollData.ni.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-8 border-t-4 border-emerald-600 text-emerald-600 text-4xl mt-4">
                             <span className="font-black uppercase tracking-tighter">Net Payout</span>
                             <span className="font-black">€{payrollData.totalNet.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <p className="text-[8px] font-black uppercase text-center text-slate-300 mt-12 tracking-[0.5em]">DIGITALLY VERIFIED BY RESET STUDIO OPS CORE</p>
              </div>

              <div className="flex justify-end gap-3 no-print pt-6">
                 <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="px-8 py-3 rounded-xl border border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest">Close</button>
                 <button onClick={handlePrint} className="bg-black text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Print PDF</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
