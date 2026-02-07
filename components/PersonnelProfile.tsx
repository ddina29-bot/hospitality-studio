
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType, EmploymentType } from '../types';

// Helper to get the correct price for a specific service type from a property
export const getCleanerRateForShift = (serviceType: string, prop: Property): number => {
  const type = serviceType.toUpperCase();
  if (type === 'REFRESH') return prop.cleanerRefreshPrice || 0;
  if (type === 'MID STAY CLEANING') return prop.cleanerMidStayPrice || 0;
  if (type === 'TO CHECK APARTMENT') return prop.cleanerAuditPrice || 0;
  if (type === 'COMMON AREA') return prop.cleanerCommonAreaPrice || 0;
  if (type === 'BEDS ONLY') return prop.cleanerBedsOnlyPrice || 0;
  // Default to standard checkout price
  return prop.cleanerPrice || 0;
};

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

  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.toLocaleString('default', { month: 'short' }).toUpperCase()} ${now.getFullYear()}`;
  }); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('');
  const [payPeriodUntil, setPayPeriodUntil] = useState('');
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);

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
    const years = [2025, 2026];
    const opts: string[] = [];
    years.forEach(y => months.forEach(m => opts.push(`${m} ${y}`)));
    return opts;
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
        govBonus: activeHistoricalPayslip.govBonus
      };
    }

    let totalPieceRateEarned = 0;
    let totalHourlyEarned = 0;

    filteredShifts.forEach(s => {
        const prop = properties?.find(p => p.id === s.propertyId);
        if (!prop && s.serviceType !== 'TO FIX') return;

        const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
        const hours = Math.max(0, durationMs / (1000 * 60 * 60));
        const hourlyBaseForShift = hours * (user.payRate || 5.00);

        if (s.approvalStatus === 'approved') {
            const teamCount = s.userIds?.length || 1;
            let flatRate = 0;
            if (s.serviceType === 'TO FIX') flatRate = s.fixWorkPayment || 0;
            else if (prop) flatRate = getCleanerRateForShift(s.serviceType, prop) / teamCount;

            if (user.paymentType === 'Per Clean' || user.paymentType === 'Fixed Wage') {
                totalPieceRateEarned += Math.max(flatRate, user.paymentType === 'Fixed Wage' ? 0 : hourlyBaseForShift);
            } else {
                totalHourlyEarned += hourlyBaseForShift;
            }
        } else if (user.paymentType === 'Per Hour') {
            totalHourlyEarned += hourlyBaseForShift;
        }
    });

    const calculatedGross = totalPieceRateEarned + totalHourlyEarned;
    const actualGrossPay = manualGrossPay !== null ? manualGrossPay : calculatedGross;
    const ni = actualGrossPay * 0.1;
    const tax = actualGrossPay * 0.15;

    return {
      grossPay: actualGrossPay,
      ni,
      tax,
      govBonus: 0,
      totalNet: Math.max(0, actualGrossPay - ni - tax)
    };
  }, [filteredShifts, user, payPeriodFrom, payPeriodUntil, properties, activeHistoricalPayslip, manualGrossPay]);

  const userLeaveRequests = useMemo(() => {
    return (leaveRequests || []).filter(l => l.userId === user.id).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaveRequests, user.id]);

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
    setActiveSubTab('PAYSLIP REGISTRY');
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
    <div className="bg-transparent min-h-fit text-left font-brand animate-in fade-in duration-500">
      <div className="mx-auto space-y-10">
        <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto text-left">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-3xl shadow-inner overflow-hidden border border-teal-100 shrink-0">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div>
                 <h2 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role} • {user.paymentType}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-4 w-full md:w-auto">
              {(isViewingSelf || isCurrentUserAdmin) && (
                <button onClick={() => setShowLeaveForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">REQUEST ABSENCE</button>
              )}
              <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 min-w-[120px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">RATE</p>
                 <p className="text-xs font-bold text-slate-900 text-center">€{user.payRate?.toFixed(2)} / {user.paymentType === 'Per Hour' ? 'HR' : 'PERIOD'}</p>
              </div>
           </div>
        </section>

        <div className="space-y-6">
           <div className="flex gap-10 border-b border-slate-200 w-full md:w-auto px-4 overflow-x-auto no-scrollbar">
              {visibleSubTabs.map(tab => (
                 <button key={tab} onClick={() => setActiveSubTab(tab)} className={`pb-4 text-[10px] md:text-[11px] font-black tracking-widest transition-all relative whitespace-nowrap ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left duration-300"></div>}
                 </button>
              ))}
           </div>

           <div className="animate-in slide-in-from-bottom-4 duration-500">
              {activeSubTab === 'PENDING PAYOUTS' && canManageFinancials && (
                <section className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-10 shadow-lg space-y-10 text-left">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Hybrid Payment Calculator</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                               <label className={subLabelStyle}>Month Focus</label>
                               <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                               </select>
                            </div>
                            <div><label className={subLabelStyle}>From</label><input type="date" className={inputStyle} value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} /></div>
                            <div><label className={subLabelStyle}>Until</label><input type="date" className={inputStyle} value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} /></div>
                         </div>
                         <div className="pt-4 space-y-2">
                            <label className={subLabelStyle}>Adjust Manual Gross (€)</label>
                            <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(e.target.value ? parseFloat(e.target.value) : null)} placeholder="Override calculation..." />
                         </div>
                      </div>
                      <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center">
                         <p className={subLabelStyle}>Total Net Payout Preview</p>
                         <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                         <p className="text-[8px] font-black text-emerald-600/50 uppercase tracking-widest mt-4">Includes piece-rates for {filteredShifts.length} deployments</p>
                         <button onClick={handleCommitPayslip} className="mt-8 bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95">COMMIT TO REGISTRY</button>
                      </div>
                   </div>
                </section>
              )}

              {activeSubTab === 'PAYSLIP REGISTRY' && (
                <section className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden text-left">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                               <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {(user.payslips || []).length === 0 ? (
                               <tr><td colSpan={4} className="px-10 py-20 text-center opacity-20 text-[10px] font-black uppercase">No payslips issued</td></tr>
                            ) : [...(user.payslips || [])].reverse().map(ps => (
                               <tr key={ps.id}>
                                  <td className="px-10 py-6 text-[11px] font-black text-slate-900 uppercase">{ps.month}</td>
                                  <td className="px-10 py-6 text-[10px] font-bold text-slate-400">{ps.periodFrom} — {ps.periodUntil}</td>
                                  <td className="px-10 py-6 text-right text-sm font-black text-[#0D9488]">€{ps.netPay.toFixed(2)}</td>
                                  <td className="px-10 py-6 text-right">
                                     <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-teal-50 text-teal-700 px-4 py-2 rounded-lg text-[8px] font-black uppercase">View Doc</button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </section>
              )}

              {activeSubTab === 'LEAVE REQUESTS' && (
                <section className="space-y-6 animate-in slide-in-from-right-4">
                   <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">⛱️</div>
                         <div className="text-left">
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Absence Summary</p>
                            <p className="text-xs font-bold text-indigo-700 uppercase">{userLeaveRequests.filter(l => l.status === 'approved').length} Approved Absences</p>
                         </div>
                      </div>
                      <button onClick={() => setShowLeaveForm(true)} className="bg-white border border-indigo-200 text-indigo-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:shadow-md transition-all">New Application</button>
                   </div>
                   <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden text-left">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/80 border-b border-slate-100">
                              <tr>
                                 <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                 <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                                 <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {userLeaveRequests.length === 0 ? (
                                 <tr><td colSpan={3} className="px-10 py-20 text-center opacity-20 text-[10px] font-black uppercase italic">No leave history found</td></tr>
                              ) : userLeaveRequests.map(l => (
                                 <tr key={l.id}>
                                    <td className="px-10 py-6"><span className="text-[10px] font-black text-slate-900 uppercase">{l.type}</span></td>
                                    <td className="px-10 py-6"><span className="text-[9px] font-bold text-slate-400 uppercase">{l.startDate} TO {l.endDate}</span></td>
                                    <td className="px-10 py-6 text-center"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${l.status === 'approved' ? 'bg-emerald-600 text-white' : l.status === 'rejected' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span></td>
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

      {showLeaveForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-8 shadow-2xl relative text-left animate-in zoom-in-95">
              <button onClick={() => setShowLeaveForm(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 font-black text-xl">&times;</button>
              <div className="space-y-1">
                 <h2 className="text-2xl font-bold uppercase text-slate-900 tracking-tight">Request Absence</h2>
                 <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em]">Official Leave Application</p>
              </div>
              <form onSubmit={handleSubmitLeave} className="space-y-6">
                 <div>
                    <label className={subLabelStyle}>Leave Category</label>
                    <select className={inputStyle} value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)}>
                       <option value="Vacation Leave">Vacation Leave</option>
                       <option value="Sick Leave">Sick Leave</option>
                       <option value="Day Off">Standard Day Off</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className={subLabelStyle}>Starting On</label><input required type="date" className={inputStyle} value={leaveStart} onChange={e => setLeaveStart(e.target.value)} /></div>
                    <div><label className={subLabelStyle}>Ending On</label><input required type="date" className={inputStyle} value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} /></div>
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">SUBMIT APPLICATION</button>
              </form>
           </div>
        </div>
      )}

      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-3xl p-10 md:p-14 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 no-print font-black text-xl">&times;</button>
              <div>
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                    <div className="space-y-2">
                       <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                       <p className="text-[11px] font-black text-teal-600 uppercase tracking-widest">OFFICIAL PAYROLL RECORD</p>
                    </div>
                    <div className="text-right">
                       <h2 className="text-lg font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-6 py-1.5">PAYSLIP</h2>
                       <p className="text-sm font-black text-slate-900 uppercase mt-4">{user.name}</p>
                       <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{selectedDocMonth}</p>
                    </div>
                 </header>
                 <div className="space-y-10 mt-10">
                    <div className="flex justify-between border-b-4 border-slate-900 pb-8 text-4xl font-black text-emerald-600">
                       <span className="uppercase tracking-tighter">Net Payout</span>
                       <span>€{payrollData.totalNet.toFixed(2)}</span>
                    </div>
                    <div className="space-y-4">
                       <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Gross Earnings</span><span className="text-slate-900 font-black">€{payrollData.grossPay.toFixed(2)}</span></div>
                       <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Social Security (NI)</span><span className="text-rose-600 font-black">-€{payrollData.ni.toFixed(2)}</span></div>
                       <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>FSS PAYE Tax</span><span className="text-rose-600 font-black">-€{payrollData.tax.toFixed(2)}</span></div>
                    </div>
                 </div>
                 <p className="text-[8px] font-black uppercase text-center text-slate-300 mt-12 tracking-[0.5em]">DIGITALLY VERIFIED BY RESET STUDIO OPS CORE</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
