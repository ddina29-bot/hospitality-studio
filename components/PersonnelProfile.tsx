
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
  
  // Restricted access for financial management
  const canManageFinancials = isCurrentUserAdmin;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeModule, setActiveModule] = useState<'PAYROLL' | 'INVOICING' | 'RECORDS'>(isCurrentUserAdmin ? 'PAYROLL' : 'PAYROLL'); 
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(isCurrentUserAdmin ? 'PENDING PAYOUTS' : 'PAYSLIP REGISTRY');
  
  // Leave Request Form States
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  // 2026 COMPLIANCE STATES
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('JAN 2026'); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-01-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-01-31');
  
  // DYNAMIC WAGE STATE
  const [contractualGross, setContractualGross] = useState<number | null>(user.payRate || 1333.33); 
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);

  useEffect(() => {
    if (user.payRate) setContractualGross(user.payRate);
  }, [user.id, user.payRate]);
  
  useEffect(() => {
    if (initialHistoricalPayslip) {
      setActiveHistoricalPayslip(initialHistoricalPayslip);
      setViewingDoc('payslip');
    }
  }, [initialHistoricalPayslip]);

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

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        grossPay: activeHistoricalPayslip.grossPay,
        totalNet: activeHistoricalPayslip.netPay,
        tax: activeHistoricalPayslip.tax,
        ni: activeHistoricalPayslip.ni,
        govBonus: activeHistoricalPayslip.govBonus,
        performanceBonus: (activeHistoricalPayslip as any).performanceBonus || 0,
        auditFees: (activeHistoricalPayslip as any).auditFees || 0
      };
    }

    let totalBase = 0;
    let totalPerformanceBonus = 0;
    let totalAuditFees = 0;

    // Handle Fixed Wage vs Hourly/Piece-rate
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
    const ni = actualGrossPay * 0.1;
    const tax = actualGrossPay * 0.15;

    return {
      performanceBonus: totalPerformanceBonus,
      auditFees: totalAuditFees,
      grossPay: actualGrossPay,
      ni,
      tax,
      govBonus: 0,
      totalNet: Math.max(0, actualGrossPay - ni - tax)
    };
  }, [filteredShifts, user, payPeriodFrom, payPeriodUntil, properties, activeHistoricalPayslip, manualGrossPay]);

  const userLeaveRequests = useMemo(() => {
    return leaveRequests.filter(l => l.userId === user.id).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaveRequests, user.id]);

  const approvedLeaveCount = useMemo(() => {
    return userLeaveRequests.filter(l => l.status === 'approved' && l.type === 'Vacation Leave').length;
  }, [userLeaveRequests]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    if (!window.confirm(`CONFIRM FINANCIAL COMMITMENT:\n\nGenerate permanent record for ${user.name}?`)) return;

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
      daysWorked: 20,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'Admin User'
    };

    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    alert("Record committed to registry.");
  };

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) return;
    onRequestLeave?.(leaveType, leaveStart, leaveEnd);
    setShowLeaveForm(false);
    setLeaveStart('');
    setLeaveEnd('');
  };

  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

  const visibleSubTabs = useMemo(() => {
    const tabs: ('PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS')[] = ['PAYSLIP REGISTRY', 'LEAVE REQUESTS'];
    if (canManageFinancials) tabs.unshift('PENDING PAYOUTS');
    return tabs;
  }, [canManageFinancials]);

  return (
    <div className="bg-[#F8FAFC] min-h-full text-left pb-24 font-brand animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 space-y-8">
        
        {/* HEADER SECTION - REFINED PROPORTIONS */}
        <section className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 rounded-[1.2rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-2xl shadow-inner overflow-hidden border border-teal-100">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left">
                 <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">{user.role}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-3 w-full md:w-auto">
              {(isViewingSelf || isCurrentUserAdmin) && (
                <button 
                    onClick={() => setShowLeaveForm(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                    REQUEST ABSENCE
                </button>
              )}
              <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 text-center">BASE RATE</p>
                 <p className="text-[10px] font-black text-slate-900 text-center">€{user.payRate?.toFixed(2)} / {user.paymentType === 'Per Hour' ? 'HR' : 'MONTH'}</p>
              </div>
           </div>
        </section>

        {/* NAVIGATION & CONTENT AREA */}
        <div className="space-y-6">
           <div className="flex gap-8 border-b border-slate-200 w-full md:w-auto px-2 overflow-x-auto no-scrollbar">
              {visibleSubTabs.map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveSubTab(tab)}
                   className={`pb-3 text-[10px] font-black tracking-widest transition-all relative whitespace-nowrap ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}
                 >
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left duration-300"></div>}
                 </button>
              ))}
           </div>

           <div className="animate-in slide-in-from-bottom-2 duration-500">
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
                            <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || null)} placeholder="Enter custom gross to override auto-calc" />
                         </div>
                      </div>
                      <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] flex flex-col justify-center text-center">
                         <p className={subLabelStyle}>Estimated Net Payout</p>
                         <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none mb-1">€{payrollData.totalNet.toFixed(2)}</p>
                         <p className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest">Gross: €{payrollData.grossPay.toFixed(2)}</p>
                         <button onClick={handleCommitPayslip} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">COMMIT TO REGISTRY</button>
                      </div>
                   </div>

                   {/* Activity Summary Table */}
                   {user.paymentType !== 'Fixed Wage' && (
                     <div className="pt-6 space-y-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Summary ({filteredShifts.length} units)</p>
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
                           <table className="w-full text-left">
                              <thead className="bg-slate-100/50 text-[7px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                 <tr>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Asset</th>
                                    <th className="px-4 py-2">Service</th>
                                    <th className="px-4 py-2 text-right">Status</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {filteredShifts.map(s => (
                                    <tr key={s.id} className="text-[8px] font-bold text-slate-600 uppercase">
                                       <td className="px-4 py-2">{s.date}</td>
                                       <td className="px-4 py-2 truncate max-w-[120px]">{s.propertyName}</td>
                                       <td className="px-4 py-2">{s.serviceType}</td>
                                       <td className="px-4 py-2 text-right">
                                          <span className={s.approvalStatus === 'approved' ? 'text-emerald-600' : 'text-rose-400'}>{s.approvalStatus}</span>
                                       </td>
                                    </tr>
                                 ))}
                                 {filteredShifts.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[8px] font-black text-slate-300 italic">No activity logged in selected period</td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                   )}
                </section>
              )}

              {activeSubTab === 'PAYSLIP REGISTRY' && (
                <section className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden text-left">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                               <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                               <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                               <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                               <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {(user.payslips || []).length === 0 ? (
                               <tr><td colSpan={4} className="px-10 py-20 text-center opacity-20 text-[10px] font-black uppercase">No payslips issued</td></tr>
                            ) : [...(user.payslips || [])].reverse().map(ps => (
                               <tr key={ps.id}>
                                  <td className="px-8 py-5 text-[10px] font-black text-slate-900 uppercase">{ps.month}</td>
                                  <td className="px-8 py-5 text-[9px] font-bold text-slate-400">{ps.periodFrom} — {ps.periodUntil}</td>
                                  <td className="px-8 py-5 text-right text-xs font-black text-[#0D9488]">€{ps.netPay.toFixed(2)}</td>
                                  <td className="px-8 py-5 text-right">
                                     <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-teal-50 text-teal-700 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase border border-teal-100">View Doc</button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </section>
              )}

              {activeSubTab === 'LEAVE REQUESTS' && (
                <section className="space-y-4 animate-in slide-in-from-right-2">
                   <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[1.5rem] flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg shadow-sm">⛱️</div>
                         <div>
                            <p className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">Absence Summary</p>
                            <p className="text-[10px] font-bold text-indigo-700 uppercase">{approvedLeaveCount} Approved Vacation Instances</p>
                         </div>
                      </div>
                      <button onClick={() => setShowLeaveForm(true)} className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:shadow-md transition-all">New Application</button>
                   </div>

                   <div className="bg-white border border-slate-100 rounded-[1.5rem] shadow-sm overflow-hidden text-left">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/80 border-b border-slate-100">
                              <tr>
                                 <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                 <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                                 <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {userLeaveRequests.length === 0 ? (
                                 <tr><td colSpan={3} className="px-10 py-16 text-center opacity-20 text-[9px] font-black uppercase italic">No leave history found</td></tr>
                              ) : userLeaveRequests.map(l => (
                                 <tr key={l.id}>
                                    <td className="px-8 py-4">
                                       <span className="text-[9px] font-black text-slate-900 uppercase">{l.type}</span>
                                    </td>
                                    <td className="px-8 py-4">
                                       <span className="text-[8px] font-bold text-slate-400 uppercase">{l.startDate} TO {l.endDate}</span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                       <span className={`px-4 py-1.5 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm ${
                                          l.status === 'approved' ? 'bg-emerald-600 text-white' :
                                          l.status === 'rejected' ? 'bg-rose-600 text-white' :
                                          'bg-amber-100 text-amber-700'
                                       }`}>
                                          {l.status}
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                   </div>
                </section>
              )}
           </div>
        </div>
      </div>

      {/* LEAVE REQUEST MODAL */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-md p-8 md:p-10 space-y-6 shadow-2xl relative text-left animate-in zoom-in-95 border-2 border-slate-100">
              <button onClick={() => setShowLeaveForm(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 font-black text-xl">&times;</button>
              <div className="space-y-1">
                 <h2 className="text-xl font-bold uppercase text-slate-900 tracking-tight">Request Absence</h2>
                 <p className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.4em]">Official Leave Application</p>
              </div>
              <form onSubmit={handleSubmitLeave} className="space-y-5">
                 <div>
                    <label className={subLabelStyle}>Leave Category</label>
                    <select className={inputStyle} value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)}>
                       <option value="Vacation Leave">Vacation Leave</option>
                       <option value="Sick Leave">Sick Leave</option>
                       <option value="Day Off">Standard Day Off</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={subLabelStyle}>Starting On</label>
                       <input required type="date" className={inputStyle} value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <div>
                       <label className={subLabelStyle}>Ending On</label>
                       <input required type="date" className={inputStyle} value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[9px] shadow-xl active:scale-95 transition-all mt-4">SUBMIT APPLICATION</button>
              </form>
           </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/80 z-[1000] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 md:p-12 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border-2 border-slate-100">
              <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 no-print font-black text-xl">&times;</button>
              <div ref={printContentRef} className="space-y-10">
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                    <div className="space-y-2">
                       <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                       <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">OFFICIAL PAYROLL RECORD</p>
                    </div>
                    <div className="text-right">
                       <h2 className="text-base font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-4 py-1.5">PAYSLIP</h2>
                       <p className="text-xs font-black text-slate-900 uppercase mt-4">{user.name}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase">{psIdDisplay(activeHistoricalPayslip?.id)}</p>
                    </div>
                 </header>
                 <div className="space-y-10">
                    <div className="flex justify-between border-b-4 border-slate-900 pb-8 text-4xl font-black text-emerald-600">
                       <span className="uppercase tracking-tighter">Net Payout</span>
                       <span>€{payrollData.totalNet.toFixed(2)}</span>
                    </div>
                    <div className="space-y-4">
                       <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Gross Earnings</span><span className="text-slate-900">€{payrollData.grossPay.toFixed(2)}</span></div>
                       <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Social Security (NI)</span><span className="text-rose-600">-€{payrollData.ni.toFixed(2)}</span></div>
                       <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>FSS PAYE Tax</span><span className="text-rose-600">-€{payrollData.tax.toFixed(2)}</span></div>
                    </div>
                 </div>
                 <div className="pt-10 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-[7px] font-black text-slate-400 uppercase">
                       Period: {activeHistoricalPayslip?.periodFrom || payPeriodFrom} to {activeHistoricalPayslip?.periodUntil || payPeriodUntil}
                    </div>
                    <p className="text-[7px] font-black uppercase text-slate-300 tracking-[0.3em]">RESET STUDIO OPS CORE VERIFIED</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const psIdDisplay = (id?: string) => id ? `Ref: ${id.split('-').pop()}` : '';

export default PersonnelProfile;
