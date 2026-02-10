
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType, EmploymentType, Tutorial } from '../types';
import ScorecardView from './management/ScorecardView';
import OnboardingPathView from './management/OnboardingPathView';

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  tutorials?: Tutorial[];
  setActiveTab?: (tab: any) => void;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
  initialHistoricalPayslip?: SavedPayslip | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ 
  user, 
  leaveRequests = [], 
  onRequestLeave, 
  shifts = [], 
  properties = [], 
  onUpdateUser, 
  organization,
  tutorials = [],
  setActiveTab,
  initialDocView, 
  initialHistoricalPayslip 
}) => {
  const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isCurrentUserAdmin = currentUserObj.role === 'admin';
  const canManageFinancials = isCurrentUserAdmin;

  // Roles excluded from training and performance tracking (logistics/mgmt roles)
  const isRoadmapIrrelevant = ['admin', 'housekeeping', 'driver', 'laundry'].includes(user.role);
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  
  const [activeSubTab, setActiveSubTab] = useState<'ONBOARDING' | 'PERFORMANCE' | 'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(
    isRoadmapIrrelevant ? 'PAYSLIP REGISTRY' : 'ONBOARDING'
  );
  
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('MAR 2026'); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-03-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-03-31');
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);
  const [isPreviewingCurrent, setIsPreviewingCurrent] = useState(false);
  const [spouseWorks, setSpouseWorks] = useState(true);

  // Leave Form State
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  const printContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setManualGrossPay(null);
  }, [selectedDocMonth]);

  useEffect(() => {
    const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth();
      const last = new Date(y, m + 1, 0);
      setPayPeriodFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      setPayPeriodUntil(`${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`);
    }
  }, [selectedDocMonth]);

  const getTaxEngineOutput = (annualGross: number, status: string, isParent: boolean, kids: number, spouseWorks: boolean) => {
    let taxFreeThreshold = 0;
    let category = '';

    if (isParent && status === 'Single') {
        category = kids >= 2 ? 'Parent (2+)' : 'Parent (1 Child)';
        taxFreeThreshold = 18500;
    } else if (status === 'Married') {
        if (kids > 0) {
            category = 'Married (1 Child)';
            taxFreeThreshold = 17500;
        } else {
            if (spouseWorks) {
                category = 'Single (Separate Computation)';
                taxFreeThreshold = 12000;
            } else {
                category = 'Married (Joint Computation)';
                taxFreeThreshold = 15000;
            }
        }
    } else {
        category = 'Single';
        taxFreeThreshold = 12000;
    }

    if (annualGross <= taxFreeThreshold) return { tax: 0, category, threshold: taxFreeThreshold };

    const taxable = annualGross - taxFreeThreshold;
    let annualTax = 0;
    if (taxable <= 5000) annualTax = taxable * 0.15;
    else if (taxable <= 15000) annualTax = (5000 * 0.15) + (taxable - 5000) * 0.25;
    else annualTax = (5000 * 0.15) + (10000 * 0.25) + (taxable - 15000) * 0.35;

    return { tax: annualTax, category, threshold: taxFreeThreshold };
  };

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        grossBasic: activeHistoricalPayslip.grossPay - (activeHistoricalPayslip.govBonus || 0),
        performanceBonus: 0, 
        govBonus: activeHistoricalPayslip.govBonus || 0,
        tax: activeHistoricalPayslip.tax,
        niEmployee: activeHistoricalPayslip.ni,
        niEmployer: activeHistoricalPayslip.ni,
        maternityFund: activeHistoricalPayslip.grossPay * 0.003,
        totalNet: activeHistoricalPayslip.netPay,
        taxBandUsed: 'Registry Record',
        totalGross: activeHistoricalPayslip.grossPay,
        isHistorical: true
      };
    }

    const month = selectedDocMonth.split(' ')[0];

    let govBonus = 0;
    let bonusLabel = "N/A";
    if (month === 'MAR') {
        const bonusStart = new Date('2025-10-01');
        const bonusEnd = new Date('2026-03-31');
        const totalBonusDays = 182;
        const userStart = user.activationDate ? new Date(user.activationDate) : bonusStart;
        const effectiveStart = userStart > bonusStart ? userStart : bonusStart;
        const daysEmployed = Math.max(0, ((bonusEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        if (daysEmployed >= totalBonusDays) {
            govBonus = 121.16;
            bonusLabel = "Full";
        } else {
            govBonus = Number(((daysEmployed / totalBonusDays) * 121.16).toFixed(2));
            bonusLabel = `Pro-Rata (${Math.round(daysEmployed)} days)`;
        }
    }

    let totalBasic = 0;
    let totalPerformance = 0;

    if (user.paymentType === 'Fixed Wage') {
        totalBasic = user.payRate || 0;
    } else {
        (shifts || []).filter(s => s.userIds.includes(user.id) && s.status === 'completed' && s.date.includes(month)).forEach(s => {
            const prop = properties?.find(p => p.id === s.propertyId);
            const dur = (s.actualEndTime || 0) - (s.actualStartTime || 0);
            const hours = dur / 3600000;
            const hourlyRate = user.payRate || 5;
            totalBasic += hours * hourlyRate;

            if (s.approvalStatus === 'approved' && prop && user.paymentType === 'Per Clean') {
                const teamCount = s.userIds.length || 1;
                const targetPieceRate = (prop.serviceRates?.[s.serviceType] || prop.cleanerPrice) / teamCount;
                const hourlyBase = hours * hourlyRate;
                if (targetPieceRate > hourlyBase) {
                    totalPerformance += (targetPieceRate - hourlyBase);
                }
            }
        });
    }

    const currentGross = manualGrossPay !== null ? manualGrossPay : (totalBasic + totalPerformance);
    const totalGross = currentGross + govBonus;
    const niEmployee = totalGross * 0.10;
    const projectedAnnual = currentGross * 12;
    const taxRes = getTaxEngineOutput(projectedAnnual, user.maritalStatus || 'Single', !!user.isParent, user.childrenCount || 0, spouseWorks);
    const periodTax = taxRes.tax / 12;

    return {
      grossBasic: totalBasic,
      performanceBonus: totalPerformance,
      govBonus,
      bonusLabel,
      totalGross,
      niEmployee,
      niEmployer: totalGross * 0.10,
      maternityFund: currentGross * 0.003,
      tax: periodTax,
      totalNet: Math.max(0, totalGross - niEmployee - periodTax),
      taxBandUsed: taxRes.category,
      isHistorical: false
    };
  }, [shifts, user, properties, activeHistoricalPayslip, manualGrossPay, selectedDocMonth, payPeriodFrom, payPeriodUntil, spouseWorks]);

  const annualAccumulation = useMemo(() => {
    const yearSuffix = (activeHistoricalPayslip?.month || selectedDocMonth).split(' ').pop();
    if (!yearSuffix) return { ni: 0, tax: 0, gross: 0, year: '2026' };
    
    const relevantSaved = (user.payslips || []).filter(ps => ps.month.endsWith(yearSuffix) && ps.id !== activeHistoricalPayslip?.id);
    let totalNI = relevantSaved.reduce((sum, ps) => sum + ps.ni, 0);
    let totalTax = relevantSaved.reduce((sum, ps) => sum + ps.tax, 0);
    let totalGross = relevantSaved.reduce((sum, ps) => sum + ps.grossPay, 0);
    
    if (!activeHistoricalPayslip) {
      totalNI += payrollData.niEmployee;
      totalTax += payrollData.tax;
      totalGross += payrollData.totalGross;
    } else {
      totalNI += activeHistoricalPayslip.ni;
      totalTax += activeHistoricalPayslip.tax;
      totalGross += activeHistoricalPayslip.grossPay;
    }
    
    return { ni: totalNI, tax: totalTax, gross: totalGross, year: yearSuffix };
  }, [user.payslips, selectedDocMonth, activeHistoricalPayslip, payrollData]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: payPeriodFrom,
      periodUntil: payPeriodUntil,
      grossPay: payrollData.totalGross,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.niEmployee,
      niWeeks: 4,
      govBonus: payrollData.govBonus,
      daysWorked: 22,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'System Auditor'
    };
    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setIsPreviewingCurrent(false);
    alert("Official Record Generated and Archived in Studio Registry.");
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) {
      alert("Please select dates.");
      return;
    }
    if (onRequestLeave) {
      onRequestLeave(leaveType, leaveStart, leaveEnd);
      setShowLeaveForm(false);
      setLeaveStart('');
      setLeaveEnd('');
    }
  };

  const myLeaveRequests = useMemo(() => {
    if (!user?.id) return [];
    const viewedUserId = String(user.id);
    return leaveRequests.filter(l => String(l.userId) === viewedUserId);
  }, [leaveRequests, user.id]);

  const visibleSubTabs = useMemo(() => {
    return [
      !isRoadmapIrrelevant && 'ONBOARDING',
      !isRoadmapIrrelevant && 'PERFORMANCE',
      canManageFinancials && 'PENDING PAYOUTS',
      'PAYSLIP REGISTRY',
      'LEAVE REQUESTS'
    ].filter(Boolean) as any[];
  }, [isRoadmapIrrelevant, canManageFinancials]);

  return (
    <div className="bg-[#F8FAFC] min-h-full text-left pb-24 font-brand animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 space-y-8">
        <section className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 rounded-[1.2rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-2xl shadow-inner border border-teal-100 overflow-hidden">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left">
                 <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">{user.role} • {user.status}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Start: {user.activationDate || '---'} • ID: {user.idPassportNumber || 'PENDING'}</p>
              </div>
           </div>
           {canManageFinancials && (
             <div className="flex flex-col gap-2 items-end">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Spouse Works?</label>
               <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button onClick={() => setSpouseWorks(true)} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${spouseWorks ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`}>YES</button>
                 <button onClick={() => setSpouseWorks(false)} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${!spouseWorks ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>NO</button>
               </div>
             </div>
           )}
        </section>

        <div className="space-y-6">
           <div className="flex gap-8 border-b border-slate-200 w-full md:w-auto px-2 overflow-x-auto no-scrollbar">
              {visibleSubTabs.map(tab => (
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

           {activeSubTab === 'ONBOARDING' && !isRoadmapIrrelevant && (
             <OnboardingPathView user={user} tutorials={tutorials} onNavigateToTutorials={() => setActiveTab?.('tutorials')} />
           )}

           {activeSubTab === 'PERFORMANCE' && !isRoadmapIrrelevant && (
             <ScorecardView user={user} shifts={shifts} />
           )}

           {activeSubTab === 'PENDING PAYOUTS' && canManageFinancials && (
             <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-8 text-left">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Calculation Parameters</h3>
                        <span className="text-[8px] font-black text-teal-600 uppercase bg-teal-50 px-2 py-0.5 rounded">2026 Statutory Engine</span>
                      </div>
                      <div className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                                <label className={subLabelStyle}>Fiscal Month</label>
                                <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                                   {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => <option key={m} value={`${m} 2026`}>{m} 2026</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-3 grid grid-cols-2 gap-4">
                                <div>
                                    <label className={subLabelStyle}>From</label>
                                    <input type="date" className={inputStyle} value={payPeriodFrom} onChange={e => setPayPeriodFrom(e.target.value)} />
                                </div>
                                <div>
                                    <label className={subLabelStyle}>Until</label>
                                    <input type="date" className={inputStyle} value={payPeriodUntil} onChange={e => setPayPeriodUntil(e.target.value)} />
                                </div>
                            </div>
                         </div>
                         <div>
                            <label className={subLabelStyle}>Manual Adjustment Override (€)</label>
                            <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || null)} placeholder="Enter manual base gross" />
                         </div>
                      </div>
                   </div>
                   <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] flex flex-col justify-center text-center">
                      <p className={subLabelStyle}>Estimated Net Payout</p>
                      <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none mb-1">€{payrollData.totalNet.toFixed(2)}</p>
                      <p className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest mt-2">{payrollData.taxBandUsed}</p>
                      <button onClick={() => setIsPreviewingCurrent(true)} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">GENERATE OFFICIAL PAYSLIP</button>
                   </div>
                </div>
             </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
             <section className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                     <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="px-8 py-5">Issue Month</th>
                       <th className="px-8 py-5">Gross Amount</th>
                       <th className="px-8 py-5">Net Payable</th>
                       <th className="px-8 py-5 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {(user.payslips || []).length === 0 ? (
                        <tr><td colSpan={4} className="px-8 py-16 text-center opacity-20 text-[10px] font-black uppercase">No records found</td></tr>
                      ) : [...(user.payslips || [])].reverse().map(ps => (
                         <tr key={ps.id}>
                            <td className="px-8 py-5 text-[10px] font-black text-slate-900 uppercase">{ps.month}</td>
                            <td className="px-8 py-5 text-xs font-bold text-slate-500 font-mono">€{ps.grossPay.toFixed(2)}</td>
                            <td className="px-8 py-5 text-xs font-black text-[#0D9488] font-mono">€{ps.netPay.toFixed(2)}</td>
                            <td className="px-8 py-5 text-right">
                              <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-teal-50 text-teal-700 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase border border-teal-100 shadow-sm hover:bg-teal-100 transition-colors">Open Document</button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </section>
           )}

           {activeSubTab === 'LEAVE REQUESTS' && (
             <section className="space-y-6">
                <div className="flex justify-between items-center px-2">
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Absence History</h3>
                   <button 
                     onClick={() => setShowLeaveForm(true)}
                     className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                   >
                      Submit New Request
                   </button>
                </div>
                
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-8 py-5">Request Type</th>
                          <th className="px-8 py-5">Date Range</th>
                          <th className="px-8 py-5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {myLeaveRequests.length === 0 ? (
                           <tr><td colSpan={3} className="px-8 py-16 text-center opacity-20 text-[10px] font-black uppercase">No leave requests found</td></tr>
                         ) : [...myLeaveRequests].reverse().map(l => (
                           <tr key={l.id}>
                              <td className="px-8 py-5">
                                 <span className="text-[10px] font-black text-slate-900 uppercase">{l.type}</span>
                              </td>
                              <td className="px-8 py-5">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase">{l.startDate} TO {l.endDate}</span>
                              </td>
                              <td className="px-8 py-5">
                                 <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    l.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
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
             </section>
           )}
        </div>
      </div>

      {showLeaveForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[1100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-8 shadow-2xl relative text-left animate-in zoom-in-95">
              <button onClick={() => setShowLeaveForm(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 font-black text-xl transition-all">&times;</button>
              <header className="space-y-1">
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tighter">Submit Leave</h2>
                 <p className="text-[8px] font-black text-teal-600 uppercase tracking-[0.4em]">Personal Request Dispatch</p>
              </header>
              <form onSubmit={handleLeaveSubmit} className="space-y-6">
                 <div>
                    <label className={subLabelStyle}>Request Category</label>
                    <select className={inputStyle} value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)}>
                       <option value="Vacation Leave">Vacation Leave</option>
                       <option value="Sick Leave">Sick Leave</option>
                       <option value="Day Off">Day Off (Personal)</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={subLabelStyle}>Start Date</label>
                       <input required type="date" className={inputStyle} value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <div>
                       <label className={subLabelStyle}>End Date</label>
                       <input required type="date" className={inputStyle} value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-[#0D9488] text-white font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all">Submit to Operations</button>
              </form>
           </div>
        </div>
      )}

      {(viewingDoc || isPreviewingCurrent) && (
        <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto">
           <div className="bg-white rounded-[1rem] w-full max-w-4xl p-8 md:p-14 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border border-slate-100">
              <button onClick={() => { setViewingDoc(null); setIsPreviewingCurrent(false); setActiveHistoricalPayslip(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 font-black text-2xl transition-colors no-print">&times;</button>
              
              <div ref={printContentRef} className="space-y-10 text-slate-900">
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                    <div className="space-y-3">
                       <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{organization?.legalEntity || organization?.name || 'RESET HOSPITALITY STUDIO'}</h1>
                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] space-y-1">
                          <p>PE Number: <span className="text-slate-900">{organization?.peNumber || 'PE 000000'}</span></p>
                          <p>VAT ID: <span className="text-slate-900">{organization?.taxId || 'MT 00000000'}</span></p>
                          <p className="max-w-[280px] leading-relaxed italic">{organization?.address || 'NO_ADDRESS_REGISTERED'}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <h2 className="text-lg font-black uppercase tracking-[0.25em] bg-slate-900 text-white px-6 py-2 shadow-xl">PAYSLIP</h2>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 tracking-widest">{activeHistoricalPayslip ? `ID: ${activeHistoricalPayslip.id.split('-').pop()}` : 'PRE-ISSUE VOUCHER'}</p>
                       <p className="text-base font-black uppercase mt-1">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                    </div>
                 </header>

                 <div className="grid grid-cols-2 gap-10 border-b border-slate-100 pb-8">
                    <div className="space-y-4">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">EMPLOYEE PROFILE</p>
                       <div className="space-y-1.5 text-left">
                          <p className="text-base font-black uppercase text-slate-900">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-[280px]">{user.homeAddress || 'NO_ADDRESS_FILED'}</p>
                          <div className="pt-2">
                             <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Pay Period</p>
                             <p className="text-[10px] font-black text-slate-900">
                                {activeHistoricalPayslip?.periodFrom || payPeriodFrom} TO {activeHistoricalPayslip?.periodUntil || payPeriodUntil}
                             </p>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4 text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">STATUTORY IDENTITY</p>
                       <div className="text-[10px] font-bold text-slate-700 uppercase space-y-2">
                          <p>ID / Passport: <span className="font-black text-slate-900">{user.idPassportNumber || '---'}</span></p>
                          <p>NI Number: <span className="font-black text-slate-900">{user.niNumber || '---'}</span></p>
                          <p>Tax Status: <span className="font-black text-teal-600 uppercase">{payrollData.taxBandUsed}</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    <div className="space-y-6">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">EARNINGS BREAKDOWN</p>
                       <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold uppercase">
                             <span>Gross Basic Salary</span>
                             <span className="font-mono">€{payrollData.grossBasic.toFixed(2)}</span>
                          </div>
                          {payrollData.performanceBonus > 0 && (
                            <div className="flex justify-between text-xs font-bold uppercase text-teal-600">
                               <span>Performance Top-up</span>
                               <span className="font-mono">€{payrollData.performanceBonus.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-bold uppercase text-indigo-600">
                             <span>{payrollData.govBonus > 0 ? `Statutory Bonus (${payrollData.bonusLabel})` : 'Statutory Bonus'}</span>
                             <span className="font-mono">€{payrollData.govBonus.toFixed(2)}</span>
                          </div>
                          <div className="h-px bg-slate-100 my-4"></div>
                          <div className="flex justify-between text-xs font-black uppercase text-slate-900">
                             <span>Total Gross Earnings</span>
                             <span className="font-mono">€{payrollData.totalGross.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 pb-2">STATUTORY DEDUCTIONS</p>
                       <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold uppercase text-rose-600">
                             <span>Income Tax (FSS)</span>
                             <span className="font-mono">-€{payrollData.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold uppercase text-rose-600">
                             <span>Social Security (10% NI)</span>
                             <span className="font-mono">-€{payrollData.niEmployee.toFixed(2)}</span>
                          </div>
                          <div className="h-px bg-slate-100 my-4"></div>
                          <div className="flex justify-between text-xs font-black uppercase text-rose-800">
                             <span>Total Deductions</span>
                             <span className="font-mono">-€{(payrollData.tax + payrollData.niEmployee).toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-900 p-8 rounded-[1.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl mt-4">
                    <div className="text-left space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-400 opacity-80">Final Settlement</p>
                       <h3 className="text-2xl font-black uppercase tracking-tight">NET AMOUNT PAYABLE</h3>
                    </div>
                    <div className="text-center md:text-right">
                       <p className="text-5xl font-black font-mono tracking-tighter text-teal-400">€{payrollData.totalNet.toFixed(2)}</p>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                       <svg width="100" height="100" viewBox="0 0 24 24" fill="black"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="relative z-10 space-y-6">
                       <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">YTD FISCAL SUMMARY</p>
                          <p className="text-[9px] font-black uppercase text-slate-400">JAN — DEC {annualAccumulation.year}</p>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                          <div className="space-y-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total Gross (YTD)</p>
                             <p className="text-xl font-black text-slate-900">€{annualAccumulation.gross.toFixed(2)}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total NI (YTD)</p>
                             <p className="text-xl font-black text-slate-900">€{annualAccumulation.ni.toFixed(2)}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total FSS Tax (YTD)</p>
                             <p className="text-xl font-black text-teal-600">€{annualAccumulation.tax.toFixed(2)}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
                    <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.5em]">CERTIFIED 2026 MALTA EMPLOYMENT COMPLIANCE</p>
                    {activeHistoricalPayslip && (
                        <div className="text-right">
                           <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Digitally Audited By</p>
                           <p className="text-[9px] font-black text-slate-900 uppercase">{activeHistoricalPayslip.generatedBy}</p>
                        </div>
                    )}
                 </div>
              </div>

              {!payrollData.isHistorical && canManageFinancials && (
                <div className="flex gap-4 pt-10 no-print">
                   <button onClick={handleCommitPayslip} className="flex-[2] bg-emerald-600 text-white font-black py-6 rounded-2xl uppercase tracking-[0.25em] text-[11px] shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all">CONFIRM & REGISTER PAYSLIP</button>
                   <button onClick={() => { setViewingDoc(null); setIsPreviewingCurrent(false); setActiveHistoricalPayslip(null); }} className="flex-1 bg-slate-100 border border-slate-200 text-slate-400 font-black py-6 rounded-2xl uppercase tracking-widest text-[11px] hover:bg-slate-200 transition-all">Discard</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block";
const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

export default PersonnelProfile;
