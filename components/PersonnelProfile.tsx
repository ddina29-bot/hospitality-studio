
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings } from '../types';

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('Day Off');
  const [showDossier, setShowDossier] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // DATE RANGE AND PRORATION STATES
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('JAN 2026'); // Forced default for your current needs
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-01-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-01-31');
  
  const [contractualGross, setContractualGross] = useState<number | null>(null);
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);
  const [weeksInMonth, setWeeksInMonth] = useState<number>(4);
  
  const printContentRef = useRef<HTMLDivElement>(null);

  // Initialize dates when month selection changes
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

  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const detailValueStyle = "text-sm font-bold text-slate-900 uppercase tracking-tight";

  const monthOptions = useMemo(() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months.map(m => `${m} 2026`);
  }, []);

  const allMyShifts = useMemo(() => {
    return (shifts || []).filter(s => s.userIds?.includes(user.id) && s.status === 'completed');
  }, [shifts, user.id]);

  const filteredShifts = useMemo(() => {
    if (!payPeriodFrom || !payPeriodUntil) return [];
    const from = new Date(payPeriodFrom);
    const until = new Date(payPeriodUntil);
    until.setHours(23, 59, 59);

    return allMyShifts.filter(s => {
      const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${new Date().getFullYear()}`);
      return d >= from && d <= until;
    });
  }, [allMyShifts, payPeriodFrom, payPeriodUntil]);

  // CALCULATION LOGIC
  const calculateMalteseTax = (annualGross: number, status: 'Single' | 'Married' | 'Parent', children: number = 0) => {
    let tax = 0;
    if (status === 'Married') {
        if (annualGross <= 12700) tax = 0;
        else if (annualGross <= 21200) tax = (annualGross - 12700) * 0.15;
        else if (annualGross <= 60000) tax = (annualGross - 21200) * 0.25 + 1275;
        else tax = (annualGross - 60000) * 0.35 + 10975;
    } else if (status === 'Parent') {
        if (annualGross <= 10500) tax = 0;
        else if (annualGross <= 15800) tax = (annualGross - 10500) * 0.15;
        else if (annualGross <= 60000) tax = (annualGross - 15800) * 0.25 + 795;
        else tax = (annualGross - 60000) * 0.35 + 11845;
        if (children >= 2) tax = Math.max(0, tax - 450); 
    } else {
        if (annualGross <= 9100) tax = 0;
        else if (annualGross <= 14500) tax = (annualGross - 9100) * 0.15;
        else if (annualGross <= 60000) tax = (annualGross - 14500) * 0.25 + 810;
        else tax = (annualGross - 60000) * 0.35 + 12185;
    }
    return Math.max(0, tax);
  };

  const calculateNI = (weeklyGross: number, weeks: number) => {
    const rate10 = weeklyGross * 0.10;
    const minNI = 21.45; 
    const maxNI = 60.12; 
    let weeklyNI = rate10;
    if (weeklyNI < minNI && weeklyGross > 0) weeklyNI = minNI; 
    if (weeklyNI > maxNI) weeklyNI = maxNI;
    return weeklyNI * (weeks || 0);
  };

  const payrollData = useMemo(() => {
    const from = new Date(payPeriodFrom);
    const until = new Date(payPeriodUntil);
    const daysWorked = Math.ceil((until.getTime() - from.getTime()) / (1000 * 3600 * 24)) + 1;
    
    // Calculate total days in the month for proration
    const monthRef = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const totalDaysInMonth = monthRef.getDate();

    let totalBase = 0;
    let totalBonus = 0;

    // Proration Logic for Fixed Wage
    if (contractualGross && contractualGross > 0) {
       totalBase = (contractualGross / totalDaysInMonth) * daysWorked;
    } else {
        filteredShifts.forEach(s => {
          const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
          const hours = durationMs / (1000 * 60 * 60);
          const hourlyRate = user.payRate || 5.00;
          const shiftBase = hours * hourlyRate;
          totalBase += shiftBase;
          
          if (s.approvalStatus === 'approved') {
              const prop = properties?.find(p => p.id === s.propertyId);
              if (prop && user.paymentType === 'Per Clean') {
                  const target = prop.cleanerPrice / (s.userIds?.length || 1);
                  totalBonus += Math.max(0, target - shiftBase);
              }
              if (s.serviceType === 'TO FIX' && s.fixWorkPayment) {
                  totalBonus += s.fixWorkPayment;
              }
          }
        });
    }

    const finalGross = manualGrossPay !== null ? manualGrossPay : (totalBase + totalBonus);
    const weeklyGrossForNI = weeksInMonth > 0 ? (finalGross / weeksInMonth) : 0;
    const ni = calculateNI(weeklyGrossForNI, weeksInMonth);
    const maternity = finalGross * 0.003;
    
    const annualProj = finalGross * 12;
    let taxCategory: 'Single' | 'Married' | 'Parent' = 'Single';
    if (user.maritalStatus === 'Married') taxCategory = 'Married';
    else if (user.isParent) taxCategory = 'Parent';
    const annualTax = calculateMalteseTax(annualProj, taxCategory, user.childrenCount || 0);
    const tax = annualTax / 12;

    return {
      daysInPeriod: daysWorked,
      totalDaysInMonth,
      grossPay: finalGross,
      ni,
      tax,
      maternity,
      totalNet: finalGross - ni - tax - maternity
    };
  }, [filteredShifts, user, payPeriodFrom, payPeriodUntil, contractualGross, manualGrossPay, weeksInMonth, properties]);

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
      onUpdateUser({ ...user, phone: editPhone, maritalStatus: editMaritalStatus, isParent: editIsParent, childrenCount: editChildrenCount });
    }
    setIsEditingProfile(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="space-y-1 px-8 pt-8">
        <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight font-brand">Personnel File</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Employment Dossier</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-8">
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-8 h-fit">
           <div className="flex justify-between items-start">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-3xl shadow-inner">
                    {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover rounded-[1.5rem]" /> : user.name.charAt(0)}
                 </div>
                 <div>
                    <p className={subLabelStyle}>ID: {user.email}</p>
                    <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h3>
                 </div>
              </div>
              <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="text-[9px] font-black uppercase text-teal-600 tracking-widest border border-teal-100 px-4 py-2 rounded-xl hover:bg-teal-50 transition-all shadow-sm">
                 {isEditingProfile ? 'DISCARD' : 'EDIT FILE'}
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8">
              <div>
                 <p className={subLabelStyle}>Verified Phone</p>
                 {isEditingProfile ? (
                   <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                 ) : (
                   <p className={detailValueStyle}>{user.phone || 'NONE'}</p>
                 )}
              </div>
              <div>
                 <p className={subLabelStyle}>Marital Status</p>
                 {isEditingProfile ? (
                   <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase" value={editMaritalStatus} onChange={e => setEditMaritalStatus(e.target.value)}>
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
                           <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold uppercase" value={editChildrenCount} onChange={e => setEditChildrenCount(parseInt(e.target.value))}>
                              <option value={1}>1 Child (Standard Parent)</option>
                              <option value={2}>2+ Children (Rebate Active)</option>
                           </select>
                        )}
                     </div>
                   ) : (
                     <p className={detailValueStyle}>{user.isParent ? `PARENT RATE (${user.childrenCount || 1} CHILD${(user.childrenCount || 1) > 1 ? 'REN' : ''})` : 'STANDARD RATE'}</p>
                   )}
                 </div>
              </div>
              {isEditingProfile && (
                <div className="md:col-span-2">
                   <button onClick={handleSaveProfile} className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg">Commit changes to registry</button>
                </div>
              )}
           </div>
        </section>

        {/* Payslip Tool */}
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-8">
           <div className="flex justify-between items-center border-b border-slate-50 pb-6">
              <div className="space-y-1">
                 <h3 className="text-xl font-bold text-slate-900 uppercase">Payslip Terminal</h3>
                 <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Maltese Statutory Calculator</p>
              </div>
              <button onClick={() => setViewingDoc('payslip')} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">GENERATE PDF</button>
           </div>

           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2 md:col-span-2">
                    <label className={subLabelStyle}>Quick-Select Month (2026)</label>
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
                 <div className="space-y-2">
                    <label className={subLabelStyle}>Contractual Monthly Gross (€)</label>
                    <input type="number" step="0.01" className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-black text-indigo-900" placeholder="E.G. 1333.33" value={contractualGross || ''} onChange={e => setContractualGross(parseFloat(e.target.value) || null)} />
                 </div>
                 <div className="space-y-2">
                    <label className={subLabelStyle}>Weeks for NI (Mondays)</label>
                    <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                       {[0, 1, 2, 3, 4, 5].map(w => (
                         <button key={w} onClick={() => setWeeksInMonth(w)} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${weeksInMonth === w ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{w}</button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl space-y-2">
                 <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Proration Summary</p>
                 <div className="flex justify-between text-[11px] font-bold text-slate-700">
                    <span>Days in Range:</span>
                    <span>{payrollData.daysInPeriod} / {payrollData.totalDaysInMonth}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                 <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[1.5rem]">
                    <p className={subLabelStyle}>Net Payout</p>
                    <p className="text-3xl font-black text-emerald-700 leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                 </div>
                 <div className="p-5 bg-rose-50 border border-rose-100 rounded-[1.5rem]">
                    <p className={subLabelStyle}>Deductions</p>
                    <p className="text-xl font-bold text-rose-700 leading-none">€{(payrollData.ni + payrollData.tax + payrollData.maternity).toFixed(2)}</p>
                 </div>
              </div>
           </div>
        </section>
      </div>

      {/* Doc Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-3xl p-10 md:p-14 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => setViewingDoc(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors no-print font-black text-xl">&times;</button>
              
              <div ref={printContentRef} className="space-y-12">
                 <header className="flex justify-between items-start border-b-2 border-slate-900 pb-10">
                    <div className="text-left space-y-2">
                       <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                       <p className="text-[11px] font-black text-teal-600 uppercase tracking-widest">PE NO: {organization?.peNumber || 'N/A'}</p>
                       <div className="mt-6">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Pay Period</p>
                          <p className="text-[11px] font-black text-slate-900">{payPeriodFrom.split('-').reverse().join('/')} — {payPeriodUntil.split('-').reverse().join('/')}</p>
                       </div>
                    </div>
                    <div className="text-right space-y-4">
                       <h2 className="text-lg font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-6 py-1.5 inline-block">OFFICIAL PAYSLIP</h2>
                       <div className="text-right">
                          <p className="text-sm font-black text-slate-900 uppercase leading-none">{user.name}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 mt-2 uppercase">ID Card: {user.idPassportNumber || '---'}</p>
                          <p className="text-[9px] font-mono font-bold text-slate-400 uppercase">NI Number: {user.niNumber || '---'}</p>
                       </div>
                    </div>
                 </header>

                 <div className="space-y-10">
                    <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-4 mb-4">
                       <span>Description</span>
                       <span className="text-center">Units</span>
                       <span className="text-right">Amount (€)</span>
                    </div>
                    <div className="space-y-5">
                       <div className="grid grid-cols-3 text-xs font-bold text-slate-700">
                          <span className="uppercase">Basic Wage (Pro-Rata)</span>
                          <span className="text-center text-slate-400">{payrollData.daysInPeriod} DAYS</span>
                          <span className="text-right font-black">€{payrollData.grossPay.toFixed(2)}</span>
                       </div>
                       {contractualGross && contractualGross > payrollData.grossPay && (
                          <p className="text-[7px] text-slate-300 uppercase italic">Base Rate: €{contractualGross.toFixed(2)} / Month</p>
                       )}
                       <div className="grid grid-cols-3 pt-6 border-t-4 border-slate-900 mt-6 font-black text-slate-900 text-2xl">
                          <span className="uppercase tracking-tighter">Gross Wage</span>
                          <span></span>
                          <span className="text-right font-black">€{payrollData.grossPay.toFixed(2)}</span>
                       </div>
                    </div>

                    <div className="pt-10 space-y-6">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Deductions (Malta 2026)</p>
                       <div className="space-y-4 text-xs font-bold">
                          <div className="flex justify-between items-center">
                             <span className="text-slate-500 uppercase">FSS PAYE Tax ({user.isParent ? `Parent ${user.childrenCount || 1}+` : 'Standard'} Rate)</span>
                             <span className="text-rose-600 font-black">-€{payrollData.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-slate-500 uppercase">SSC Class 1 NI ({weeksInMonth} Weeks)</span>
                             <span className="text-rose-600 font-black">-€{payrollData.ni.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-slate-500 uppercase">Maternity Fund Contribution</span>
                             <span className="text-rose-600 font-black">-€{payrollData.maternity.toFixed(2)}</span>
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
                 <button onClick={() => setViewingDoc(null)} className="px-8 py-3 rounded-xl border border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest">Close</button>
                 <button onClick={handlePrint} className="bg-black text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Print PDF</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
