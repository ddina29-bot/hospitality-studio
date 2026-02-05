
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
  const isViewingSelf = user.id === currentUserObj.id;
  
  // Rule: Admins can see/generate for anyone. Users can see/generate for themselves in "My Studio".
  const canManagePayslip = isCurrentUserAdmin || isViewingSelf;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
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
    if (!onUpdateUser) {
        console.warn("Update handler missing from prop chain.");
        return;
    }
    
    const confirmCommit = window.confirm(
      isViewingSelf && !isCurrentUserAdmin
        ? "CONFIRM PAY PERIOD FINALIZATION:\n\nYou are about to verify your earnings for this period and submit them to the record."
        : `CONFIRM FINANCIAL COMMITMENT:\n\nYou are about to freeze this record into ${user.name}'s permanent file. This action generates a historical payslip for the employee.`
    );

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
      generatedBy: currentUserObj.name || 'System User'
    };

    const updatedPayslips = [...(user.payslips || []), newPayslip];
    onUpdateUser({ ...user, payslips: updatedPayslips });
    alert("Record committed to registry.");
  };

  const viewHistoricalPayslip = (ps: SavedPayslip) => {
    setActiveHistoricalPayslip(ps);
    setViewingDoc('payslip');
  };

  return (
    <div className="bg-slate-50 min-h-screen space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="space-y-1 px-8 pt-8">
        <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight font-brand">Personnel File</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Employment Dossier</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-8">
        {/* Profile Card */}
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-8 h-fit">
           <div className="flex justify-between items-start">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-3xl shadow-inner overflow-hidden">
                    {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                 </div>
                 <div>
                    <p className={subLabelStyle}>ID: {user.email}</p>
                    <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h3>
                 </div>
              </div>
              {isCurrentUserAdmin && (
                <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="text-[9px] font-black uppercase text-teal-600 tracking-widest border border-teal-100 px-4 py-2 rounded-xl hover:bg-teal-50 transition-all">
                  {isEditingProfile ? 'DISCARD' : 'EDIT FILE'}
                </button>
              )}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8">
              <div>
                 <p className={subLabelStyle}>Marital Status</p>
                 {isEditingProfile ? (
                   <select className={editInputStyle} value={editMaritalStatus} onChange={e => setEditMaritalStatus(e.target.value)}>
                     <option value="Single">Single</option>
                     <option value="Married">Married</option>
                     <option value="Separated">Separated</option>
                   </select>
                 ) : (
                   <p className={detailValueStyle}>{user.maritalStatus || 'Single'}</p>
                 )}
              </div>
              <div>
                 <p className={subLabelStyle}>Tax Category</p>
                 <div className="flex flex-col gap-3">
                   {isEditingProfile ? (
                     <div className="space-y-3">
                        <div className="flex items-center gap-3">
                           <input type="checkbox" id="pcheck" className="w-5 h-5 accent-teal-600" checked={editIsParent} onChange={e => setEditIsParent(e.target.checked)} />
                           <label htmlFor="pcheck" className="text-[10px] font-bold text-slate-500 uppercase">Parent Rates</label>
                        </div>
                        {editIsParent && (
                           <select className={editInputStyle} value={editChildrenCount} onChange={e => setEditChildrenCount(parseInt(e.target.value))}>
                              <option value={0}>0 Children</option>
                              <option value={1}>1 Child</option>
                              <option value={2}>2+ Children</option>
                           </select>
                        )}
                     </div>
                   ) : (
                     <p className={detailValueStyle}>
                       {user.isParent ? `PARENT (${user.childrenCount || 0} CHILD${(user.childrenCount || 0) === 1 ? '' : 'REN'})` : user.maritalStatus === 'Married' ? 'MARRIED RATE' : 'STANDARD RATE'}
                     </p>
                   )}
                 </div>
              </div>

              {isEditingProfile && isCurrentUserAdmin && (
                <>
                  <div>
                    <p className={subLabelStyle}>Wage Type</p>
                    <select className={editInputStyle} value={editPaymentType} onChange={e => setEditPaymentType(e.target.value as PaymentType)}>
                       <option value="Per Hour">Per Hour (Standard)</option>
                       <option value="Fixed Wage">Fixed Wage (Monthly)</option>
                       <option value="Per Clean">Per Deployment (Piece-rate)</option>
                    </select>
                  </div>
                  <div>
                    <p className={subLabelStyle}>Rate (€)</p>
                    <input type="number" step="0.01" className={editInputStyle} value={editPayRate} onChange={e => setEditPayRate(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="md:col-span-2">
                    <p className={subLabelStyle}>Employment Type</p>
                    <select className={editInputStyle} value={editEmploymentType} onChange={e => setEditEmploymentType(e.target.value as EmploymentType)}>
                       <option value="Full-Time">Full-Time</option>
                       <option value="Part-Time">Part-Time</option>
                       <option value="Casual">Casual</option>
                       <option value="Contractor">Contractor</option>
                    </select>
                  </div>
                </>
              )}

              {isEditingProfile && (
                <div className="md:col-span-2 pt-4">
                   <button onClick={handleSaveProfile} className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Commit changes to registry</button>
                </div>
              )}
           </div>
        </section>

        {/* Payslip Console */}
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-8 flex flex-col">
           <div className="flex justify-between items-center border-b border-slate-50 pb-6">
              <div className="space-y-1">
                 <h3 className="text-xl font-bold text-slate-900 uppercase">Payslip Terminal</h3>
                 <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                    {isCurrentUserAdmin ? 'Maltese 2026 Compliance Generator' : 'Official Earnings Review'}
                 </p>
              </div>
              <button 
                type="button"
                onClick={() => { setActiveHistoricalPayslip(null); setViewingDoc('payslip'); }} 
                className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                {activeHistoricalPayslip ? 'RE-OPEN PDF' : 'PREVIEW DRAFT'}
              </button>
           </div>

           {canManagePayslip ? (
             <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2 md:col-span-2">
                      <label className={subLabelStyle}>Select Pay Period Month</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase" value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                        {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className={subLabelStyle}>Period From</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold" value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} />
                   </div>
                   <div className="space-y-2">
                      <label className={subLabelStyle}>Period Until</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold" value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} />
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                   <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[1.5rem]">
                      <p className={subLabelStyle}>Calculated Net Payout</p>
                      <p className="text-3xl font-black text-emerald-700 leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                   </div>
                   <button 
                     type="button"
                     onClick={handleCommitPayslip}
                     className="bg-indigo-600 text-white font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                   >
                     <span>{isCurrentUserAdmin ? 'COMMIT TO RECORD' : 'VERIFY PERIOD'}</span>
                     <span className="text-[7px] opacity-60">
                        {isCurrentUserAdmin ? 'Authorize for Employee' : 'Submit for Approval'}
                     </span>
                   </button>
                </div>
             </div>
           ) : (
             <div className="py-20 text-center opacity-20">
                <p className="text-[10px] font-black uppercase tracking-widest">Financial management restricted to personal view or admin.</p>
             </div>
           )}

           {/* Always show History Table below generator for better context */}
           <div className="pt-8 border-t border-slate-50 flex-1 flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Official Document Archive</p>
              {(user.payslips || []).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 py-10 grayscale">
                  <span className="text-4xl mb-4">📑</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">No generated payslips found.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100">
                              <tr>
                                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Net (€)</th>
                                  <th className="px-6 py-4 text-right"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {[...(user.payslips || [])].reverse().map(ps => (
                                  <tr key={ps.id} className="hover:bg-teal-50/30 cursor-pointer transition-colors group" onClick={() => viewHistoricalPayslip(ps)}>
                                      <td className="px-6 py-5 text-[11px] font-black text-slate-900 uppercase">{ps.month}</td>
                                      <td className="px-6 py-5 text-[9px] font-bold text-slate-400">{ps.periodFrom.split('-').reverse().join('/')} - {ps.periodUntil.split('-').reverse().join('/')}</td>
                                      <td className="px-6 py-5 text-[11px] font-black text-emerald-600">€{ps.netPay.toFixed(2)}</td>
                                      <td className="px-6 py-5 text-right">
                                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-sm">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6"/></svg>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                </div>
              )}
           </div>
        </section>
      </div>

      {/* Official Doc Modal */}
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
                             {activeHistoricalPayslip ? `${activeHistoricalPayslip.periodFrom.split('-').reverse().join('/')} — ${activeHistoricalPayslip.periodUntil.split('-').reverse().join('/')}` : `${payPeriodFrom.split('-').reverse().join('/')} — ${payPeriodUntil.split('-').reverse().join('/')}`}
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
                          <div className="flex justify-between items-center">
                             <span className="text-slate-400 uppercase italic">Maternity Leave Trust Fund (Employer Paid)</span>
                             <span className="text-slate-400 font-black">€0.00</span>
                          </div>
                          <div className="flex justify-between items-center pt-8 border-t-4 border-emerald-600 text-emerald-600 text-4xl mt-4">
                             <span className="font-black uppercase tracking-tighter">Net Payout</span>
                             <span className="font-black">€{payrollData.totalNet.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <p className="text-[8px] font-black uppercase text-center text-slate-300 mt-12 tracking-[0.5em]">DIGITALLY VERIFIED BY RESET STUDIO OPS CORE</p>
                 {activeHistoricalPayslip && (
                    <div className="text-center mt-2 no-print">
                       <p className="text-[7px] text-slate-400 italic">Saved on: {new Date(activeHistoricalPayslip.generatedAt).toLocaleString()} by {activeHistoricalPayslip.generatedBy}</p>
                    </div>
                 )}
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
