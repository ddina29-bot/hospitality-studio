
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

    let baseSalary = user.paymentType === 'Fixed Wage' ? (Number(user.payRate) || 0) : 0;
    let deploymentEarnings = 0;

    filteredShifts.forEach(s => {
        const prop = properties?.find(p => p.id === s.propertyId);
        if (!prop && s.serviceType !== 'TO FIX') return;

        const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
        const hours = Math.max(0, durationMs / (1000 * 60 * 60));
        const hourlyRate = Number(user.payRate) || 5.00;
        const durationPay = hours * hourlyRate;

        if (s.approvalStatus === 'approved') {
            const teamCount = s.userIds?.length || 1;
            let pieceRate = 0;
            if (s.serviceType === 'TO FIX') pieceRate = s.fixWorkPayment || 0;
            else if (prop) pieceRate = getCleanerRateForShift(s.serviceType, prop) / teamCount;

            if (user.paymentType === 'Fixed Wage') {
                deploymentEarnings += pieceRate; // Pure bonus
            } else if (user.paymentType === 'Per Clean') {
                deploymentEarnings += Math.max(pieceRate, durationPay); // Hybrid: better of two
            } else {
                deploymentEarnings += durationPay; // Standard hourly
            }
        } else if (user.paymentType !== 'Fixed Wage') {
            deploymentEarnings += durationPay; // Unapproved still pays base duration if not fixed wage
        }
    });

    const actualGrossPay = manualGrossPay !== null ? manualGrossPay : (baseSalary + deploymentEarnings);
    const ni = actualGrossPay * 0.1;
    const tax = actualGrossPay * 0.15;

    return {
      grossPay: actualGrossPay,
      ni,
      tax,
      govBonus: 0,
      totalNet: Math.max(0, actualGrossPay - ni - tax)
    };
  }, [filteredShifts, user, properties, activeHistoricalPayslip, manualGrossPay]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    if (!window.confirm(`COMMIT FINANCIAL RECORD:\n\nGenerate official payslip for ${user.name}?`)) return;

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
    alert("Payroll commitment secured.");
    setActiveSubTab('PAYSLIP REGISTRY');
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1.5 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

  return (
    <div className="bg-transparent min-h-fit text-left font-brand animate-in fade-in duration-500">
      <div className="mx-auto space-y-10">
        <section className="bg-white border border-slate-100 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
           <div className="flex items-center gap-6 text-left">
              <div className="w-20 h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-3xl shadow-inner border border-teal-100">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover rounded-[1.5rem]" /> : user.name.charAt(0)}
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role} • {user.paymentType}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{user.email}</p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-4">
              <div className="bg-slate-50 px-8 py-3 rounded-2xl border border-slate-100 min-w-[140px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">CONTRACT RATE</p>
                 <p className="text-sm font-black text-slate-900 text-center">€{user.payRate?.toFixed(2)}</p>
                 <p className="text-[7px] font-bold text-slate-300 uppercase text-center tracking-widest">{user.paymentType === 'Per Hour' ? 'Per Hour' : 'Base'}</p>
              </div>
              {(isViewingSelf || isCurrentUserAdmin) && (
                <button onClick={() => setShowLeaveForm(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">REQUEST LEAVE</button>
              )}
           </div>
        </section>

        <div className="space-y-6">
           <div className="flex gap-10 border-b border-slate-200 px-4">
              {['PENDING PAYOUTS', 'PAYSLIP REGISTRY', 'LEAVE REQUESTS'].map(tab => (
                 (tab === 'PENDING PAYOUTS' && !isCurrentUserAdmin) ? null : (
                   <button key={tab} onClick={() => setActiveSubTab(tab as any)} className={`pb-4 text-[11px] font-black tracking-widest transition-all relative ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                      {tab}
                      {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left"></div>}
                   </button>
                 )
              ))}
           </div>

           {activeSubTab === 'PENDING PAYOUTS' && (
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-lg space-y-10 animate-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Pay Period Calculation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="md:col-span-2">
                              <label className={labelStyle}>Month Focus</label>
                              <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                                 {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                           </div>
                           <div><label className={labelStyle}>From</label><input type="date" className={inputStyle} value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} /></div>
                           <div><label className={labelStyle}>Until</label><input type="date" className={inputStyle} value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} /></div>
                        </div>
                     </div>
                     <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">Calculated Net Payout</p>
                        <p className="text-6xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                        <p className="text-[9px] font-bold text-emerald-600/40 uppercase mt-4">Inclusive of efficiency bonuses and piece-rates</p>
                        <button onClick={handleCommitPayslip} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95">COMMIT & NOTIFY STAFF</button>
                     </div>
                  </div>
              </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden text-left animate-in slide-in-from-right-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                       <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gross (€)</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {(user.payslips || []).length === 0 ? (
                             <tr><td colSpan={4} className="px-10 py-20 text-center opacity-20 text-[10px] uppercase font-black">No payslips found</td></tr>
                          ) : [...(user.payslips || [])].reverse().map(ps => (
                             <tr key={ps.id}>
                                <td className="px-10 py-6 text-[11px] font-black text-slate-900 uppercase">{ps.month}</td>
                                <td className="px-10 py-6 text-right text-sm font-bold text-slate-600">€{ps.grossPay.toFixed(2)}</td>
                                <td className="px-10 py-6 text-right text-sm font-black text-emerald-600">€{ps.netPay.toFixed(2)}</td>
                                <td className="px-10 py-6 text-right">
                                   <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-[8px] font-black uppercase">View Doc</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
              </div>
           )}
        </div>
      </div>

      {viewingDoc === 'payslip' && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-3xl p-14 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              <header className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                 <div className="space-y-2">
                    <h1 className="text-3xl font-black uppercase text-slate-900 leading-none tracking-tighter">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">DIGITAL PAYROLL RECORD</p>
                 </div>
                 <div className="text-right">
                    <div className="bg-slate-900 text-white px-6 py-2 rounded uppercase text-sm font-black tracking-widest mb-4">PAYSLIP</div>
                    <p className="text-sm font-black text-slate-900 uppercase leading-none">{user.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                 </div>
              </header>
              <div className="space-y-10">
                 <div className="flex justify-between border-b-4 border-slate-900 pb-8 text-4xl font-black text-emerald-600">
                    <span className="uppercase tracking-tighter">Net Payable</span>
                    <span>€{(activeHistoricalPayslip?.netPay || payrollData.totalNet).toFixed(2)}</span>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between text-sm font-bold text-slate-500 uppercase"><span>Gross Earnings</span><span className="text-slate-900 font-black">€{(activeHistoricalPayslip?.grossPay || payrollData.grossPay).toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-slate-500 uppercase"><span>NI Contribution (10%)</span><span className="text-rose-600 font-black">-€{(activeHistoricalPayslip?.ni || payrollData.ni).toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-slate-500 uppercase"><span>FSS PAYE Tax (15%)</span><span className="text-rose-600 font-black">-€{(activeHistoricalPayslip?.tax || payrollData.tax).toFixed(2)}</span></div>
                 </div>
              </div>
              <div className="pt-10 flex justify-between items-end border-t border-slate-100">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">OPERATIONS_CORE_VERIFIED</p>
                 <button onClick={() => window.print()} className="bg-slate-50 text-slate-400 px-6 py-2 rounded-xl text-[8px] font-black uppercase no-print">Export PDF</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
