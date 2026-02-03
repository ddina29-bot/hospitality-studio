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
  
  const printContentRef = useRef<HTMLDivElement>(null);
  
  const currentMonthStr = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
  }, []);

  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(currentMonthStr);
  const [worksheetStart, setWorksheetStart] = useState('');
  const [worksheetEnd, setWorksheetEnd] = useState('');
  const [fs3Year, setFs3Year] = useState<number>(new Date().getFullYear());

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editMaritalStatus, setEditMaritalStatus] = useState(user.maritalStatus || 'Single');
  const [editIsParent, setEditIsParent] = useState(user.isParent || false);
  const [editPassword, setEditPassword] = useState('');

  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const detailValueStyle = "text-sm font-bold text-slate-900 uppercase tracking-tight";

  useEffect(() => {
    if (initialDocView) {
      setShowDossier(true);
      setViewingDoc(initialDocView);
      if (initialDocView === 'fs3') {
        setFs3Year(new Date().getFullYear());
      }
    }
  }, [initialDocView]);

  // Derive Period Display for Payslip
  const periodDisplay = useMemo(() => {
    const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
    if (isNaN(d.getTime())) return { from: '---', till: '---', year: '---' };
    const y = d.getFullYear();
    const m = d.getMonth();
    const from = new Date(y, m, 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const till = new Date(y, m + 1, 0).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    return { from, till, year: y.toString() };
  }, [selectedDocMonth]);

  useEffect(() => {
    if (viewingDoc === 'payslip' || viewingDoc === 'worksheet') {
      const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
      if (!isNaN(d.getTime())) {
         const y = d.getFullYear();
         const m = d.getMonth();
         const start = new Date(Date.UTC(y, m, 1));
         const end = new Date(Date.UTC(y, m + 1, 0));
         setWorksheetStart(start.toISOString().split('T')[0]);
         setWorksheetEnd(end.toISOString().split('T')[0]);
      }
    }
  }, [selectedDocMonth, viewingDoc]);

  const handleRequest = () => {
    if (!startDate || !endDate) return;
    onRequestLeave?.(leaveType, startDate, endDate);
    setStartDate('');
    setEndDate('');
  };

  const handleSaveProfile = () => {
    if (onUpdateUser) {
      const updates: User = {
        ...user,
        phone: editPhone,
        maritalStatus: editMaritalStatus,
        isParent: editIsParent
      };
      if (editPassword.trim()) updates.password = editPassword.trim();
      onUpdateUser(updates);
    }
    setIsEditingProfile(false);
    setEditPassword('');
  };

  const myLeaves = leaveRequests.filter(l => l.userId === user.id);

  const getShiftDateObj = (dateStr: string) => {
    const currentYear = new Date().getFullYear();
    if (dateStr.includes('-')) return new Date(dateStr);
    return new Date(`${dateStr} ${currentYear}`);
  };

  const allMyShifts = useMemo(() => {
    return (shifts || []).filter(s => s.userIds?.includes(user.id) && s.status === 'completed');
  }, [shifts, user.id]);

  const fs3Shifts = useMemo(() => {
    const startOfYear = new Date(fs3Year, 0, 1);
    const isCurrentYear = fs3Year === new Date().getFullYear();
    const endOfYear = isCurrentYear ? new Date() : new Date(fs3Year, 11, 31, 23, 59, 59);

    return allMyShifts.filter(s => {
      const d = getShiftDateObj(s.date);
      if (!s.date.includes('-')) d.setFullYear(fs3Year); 
      return d >= startOfYear && d <= endOfYear;
    });
  }, [allMyShifts, fs3Year]);

  const monthlyShifts = useMemo(() => {
    return allMyShifts.filter(s => {
      const d = getShiftDateObj(s.date);
      const monthStr = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
      return monthStr === selectedDocMonth;
    });
  }, [allMyShifts, selectedDocMonth]);

  const worksheetShifts = useMemo(() => {
    if (!worksheetStart || !worksheetEnd) return monthlyShifts;
    const start = new Date(worksheetStart);
    const end = new Date(worksheetEnd);
    end.setHours(23, 59, 59, 999);
    
    return allMyShifts.filter(s => {
      const d = getShiftDateObj(s.date);
      return d >= start && d <= end;
    });
  }, [allMyShifts, worksheetStart, worksheetEnd, monthlyShifts]);

  const calculateMalteseTax = (annualGross: number, status: 'Single' | 'Married' | 'Parent') => {
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
    } else {
        if (annualGross <= 9100) tax = 0;
        else if (annualGross <= 14500) tax = (annualGross - 9100) * 0.15;
        else if (annualGross <= 60000) tax = (annualGross - 14500) * 0.25 + 810;
        else tax = (annualGross - 60000) * 0.35 + 12185;
    }
    return Math.max(0, tax);
  };

  const calculateNI = (monthlyGross: number) => {
    const weeklyGross = (monthlyGross * 12) / 52;
    const rate10 = weeklyGross * 0.10;
    const minNI = 20.09; 
    const maxNI = 57.77; 
    let weeklyNI = rate10;
    if (weeklyNI < minNI && weeklyGross > 0) weeklyNI = minNI; 
    if (weeklyNI > maxNI) weeklyNI = maxNI;
    return (weeklyNI * 52) / 12;
  };

  const getGovBonus = (monthStr: string) => {
    if (monthStr.includes('MAR')) return 121.02;
    if (monthStr.includes('JUN')) return 135.10;
    if (monthStr.includes('SEP')) return 121.02;
    if (monthStr.includes('DEC')) return 135.10;
    return 0;
  };

  const calculatePayroll = (targetShifts: Shift[], isMonthly: boolean) => {
    let totalBase = 0;
    let totalBonus = 0;
    let totalHours = 0;
    const rows = targetShifts.map(s => {
      const prop = properties?.find(p => p.id === s.propertyId);
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = durationMs / (1000 * 60 * 60);
      totalHours += hours;
      const hourlyRate = user.payRate || 5.00;
      const shiftBasePay = hours * hourlyRate;
      let shiftBonus = 0;
      let finalPay = 0;
      const isApproved = s.approvalStatus === 'approved';
      if (isApproved && prop) {
        const teamCount = s.userIds?.length || 1;
        const targetFee = prop.serviceRates?.[s.serviceType] !== undefined ? prop.serviceRates[s.serviceType] : prop.cleanerPrice;
        const targetPerPerson = targetFee / teamCount;
        if (user.role === 'supervisor') {
           if (s.serviceType === 'TO CHECK APARTMENT') shiftBonus = prop.serviceRates?.['TO CHECK APARTMENT'] || 5.00;
           else if (s.serviceType !== 'TO FIX') shiftBonus = targetPerPerson; 
           finalPay = shiftBonus; 
        } else if (user.role === 'cleaner') {
           if (user.paymentType === 'Per Clean' || user.paymentType === 'Per Hour') shiftBonus = Math.max(0, targetPerPerson - shiftBasePay);
           finalPay = targetPerPerson;
        } else finalPay = shiftBasePay;
        if (s.serviceType === 'TO FIX' && s.fixWorkPayment) {
            shiftBonus += s.fixWorkPayment;
            finalPay += s.fixWorkPayment;
        }
      } else finalPay = (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') ? 0 : shiftBasePay;
      if (user.paymentType !== 'Fixed Wage' && user.role !== 'supervisor') totalBase += shiftBasePay;
      totalBonus += shiftBonus;
      return { shift: s, hours, finalPay, isApproved, propName: prop?.name || s.propertyName };
    });
    if (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') totalBase = isMonthly ? (user.payRate || 1200) : (user.payRate || 1200) * 12;
    const govBonus = isMonthly ? getGovBonus(selectedDocMonth) : 512.24;
    const grossPay = totalBase + totalBonus + govBonus;
    const ni = calculateNI(isMonthly ? grossPay : grossPay / 12) * (isMonthly ? 1 : 12);
    let taxCategory: 'Single' | 'Married' | 'Parent' = 'Single';
    if (user.maritalStatus === 'Married') taxCategory = 'Married';
    else if (user.isParent) taxCategory = 'Parent';
    const annualProj = isMonthly ? grossPay * 12 : grossPay;
    const annualTax = calculateMalteseTax(annualProj, taxCategory);
    const tax = isMonthly ? annualTax / 12 : annualTax;
    const maternity = grossPay * 0.003;
    return { rows, totalBase, totalBonus, govBonus, totalHours, grossPay, ni, tax, maternity, totalNet: grossPay - ni - tax - maternity };
  };

  const monthlyData = useMemo(() => calculatePayroll(monthlyShifts, true), [monthlyShifts, user, selectedDocMonth]);
  const worksheetData = useMemo(() => calculatePayroll(worksheetShifts, true), [worksheetShifts, user]);
  const fs3Data = useMemo(() => {
     const data = calculatePayroll(fs3Shifts, false);
     const employerShare = data.ni; 
     const totalSSC = data.ni + employerShare;
     return { ...data, employerShare, totalSSC };
  }, [fs3Shifts, user, fs3Year]);

  const handlePrint = () => {
    if (!printContentRef.current) return;
    setIsPrinting(true);
    const content = printContentRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`
            <html><head><title>Studio Doc</title><script src="https://cdn.tailwindcss.com"></script><style>@media print { .no-print { display: none; } body { background: white; margin: 0; padding: 20px; } }</style></head><body>${content}</body><script>window.onload=function(){setTimeout(function(){window.print();},500);}</script></html>
        `);
        printWindow.document.close();
        setTimeout(() => setIsPrinting(false), 1000);
    } else setIsPrinting(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen space-y-10 animate-in fade-in duration-700 text-left pb-24 px-1">
      <header className="space-y-1 px-4 pt-4">
        <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Studio Details</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Records & Logistics</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
        <div className="space-y-8">
          <section className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <p className={subLabelStyle}>Full Legal Name</p>
                  <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h3>
                </div>
                {!isEditingProfile ? (
                  <button onClick={() => setIsEditingProfile(true)} className="text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm">Edit Info</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} className="text-[9px] font-black text-green-700 uppercase tracking-widest border border-green-500/20 px-4 py-2.5 rounded-xl bg-green-50 shadow-sm">Save</button>
                    <button onClick={() => setIsEditingProfile(false)} className="text-[9px] font-black text-rose-700 uppercase tracking-widest border border-rose-500/20 px-4 py-2.5 rounded-xl bg-rose-50 shadow-sm">Cancel</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <p className={subLabelStyle}>Assigned Role</p>
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="space-y-1">
                  <p className={subLabelStyle}>Verified Mobile</p>
                  {isEditingProfile ? (
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold uppercase text-xs" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  ) : (
                    <p className={detailValueStyle}>{user.phone || 'NOT RECORDED'}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className={subLabelStyle}>Marital Status</p>
                    {isEditingProfile ? (
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold uppercase text-xs" value={editMaritalStatus} onChange={e => setEditMaritalStatus(e.target.value)}>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Separated">Separated</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    ) : (
                      <p className={detailValueStyle}>{user.maritalStatus || 'Single'}</p>
                    )}
                  </div>
                  <div>
                    <p className={subLabelStyle}>Parent Status</p>
                    {isEditingProfile ? (
                      <div className="flex items-center gap-3 mt-1.5">
                         <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" checked={editIsParent} onChange={e => setEditIsParent(e.target.checked)} />
                         <span className="text-[10px] font-bold uppercase text-slate-500">Apply Parent Rates</span>
                      </div>
                    ) : (
                      <p className={detailValueStyle}>{user.isParent ? 'YES (Maltese Parent Rate)' : 'NO'}</p>
                    )}
                  </div>
                </div>
                {isEditingProfile && (
                  <div className="pt-4 border-t border-slate-100 animate-in fade-in">
                     <p className={subLabelStyle}>Security Update</p>
                     <input type="password" placeholder="Enter New Access Key" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-indigo-600 text-xs" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Earnings Terminal</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentMonthStr}</p>
              </div>
              <button onClick={() => setShowDossier(true)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">VIEW DOSSIER</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className={subLabelStyle}>Income (Base Wage)</p>
                <p className="text-2xl font-bold text-slate-700">€{monthlyData.totalBase.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className={subLabelStyle}>Net Payout (Final)</p>
                <p className="text-3xl font-bold text-emerald-600">€{monthlyData.totalNet.toFixed(2)}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-8">
           <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Leave & Absence</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administrative Request Portal</p>
           </div>
           <div className="space-y-4">
              <div className="space-y-4">
                 <div>
                    <label className={subLabelStyle}>Category</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-[11px] font-bold uppercase tracking-widest outline-none focus:border-indigo-600" value={leaveType} onChange={e => setLeaveType(e.target.value as any)}>
                       <option value="Day Off">Standard Day Off</option>
                       <option value="Sick Leave">Medical/Sick Leave</option>
                       <option value="Vacation Leave">Vacation Leave</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className={subLabelStyle}>Commence</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[11px] font-bold uppercase outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                   </div>
                   <div>
                      <label className={subLabelStyle}>Conclude</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[11px] font-bold uppercase outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                   </div>
                 </div>
              </div>
              <button onClick={handleRequest} className="w-full bg-indigo-600 text-white font-black py-4.5 rounded-2xl uppercase tracking-widest text-[11px] shadow-xl active:scale-95 transition-all">Submit Request</button>
           </div>
           <div className="pt-6 border-t border-slate-50 space-y-4">
              <p className={subLabelStyle}>Request History</p>
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                 {myLeaves.length === 0 ? (
                   <p className="text-[10px] text-slate-300 italic text-center py-4">No historical logs.</p>
                 ) : myLeaves.map(l => (
                   <div key={l.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-colors">
                      <div className="text-left">
                         <p className="text-[11px] text-slate-900 font-bold uppercase">{l.type}</p>
                         <p className="text-[9px] text-slate-400 font-black uppercase mt-0.5">{l.startDate} TO {l.endDate}</p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border shadow-sm ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : l.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-white text-slate-400 border-slate-200'}`}>{l.status}</span>
                   </div>
                 ))}
              </div>
           </div>
        </section>
      </div>

      {showDossier && (
        <div className="fixed inset-0 bg-slate-900/40 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95 duration-500 overflow-y-auto">
           <div className={`bg-white rounded-[3rem] w-full max-w-4xl p-8 md:p-12 space-y-10 shadow-2xl relative text-left my-auto ${viewingDoc === 'fs3' ? 'bg-slate-200' : ''}`}>
              <button onClick={() => { setShowDossier(false); setViewingDoc(null); }} className="absolute top-10 right-10 text-slate-400 hover:text-slate-900 transition-colors no-print font-black text-xl">&times;</button>

              {viewingDoc ? (
                 <div className="space-y-8 animate-in fade-in">
                    <button onClick={() => setViewingDoc(null)} className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 no-print hover:text-slate-900">← Return to Dossier</button>
                    
                    <div ref={printContentRef} className={`bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-xl mx-auto max-w-3xl text-slate-900 ${viewingDoc === 'fs3' ? 'border-black rounded-none shadow-2xl' : ''}`}>
                       {viewingDoc === 'fs3' ? (
                         <div className="space-y-6 text-black">
                            <div className="flex justify-between items-start border-b-4 border-black pb-6">
                               <div>
                                  <h1 className="text-4xl font-black uppercase tracking-tighter">FS3</h1>
                                  <p className="text-[11px] uppercase font-black tracking-[0.2em] mt-1">Payee Statement of Earnings</p>
                               </div>
                               <div className="text-right flex flex-col items-end gap-3 no-print">
                                  <div className="flex items-center gap-4 bg-slate-100 rounded-xl p-2 border border-slate-200">
                                     <button onClick={() => setFs3Year(prev => prev - 1)} className="w-8 h-8 font-black hover:bg-slate-200 rounded-lg">-</button>
                                     <span className="text-sm font-black w-14 text-center">{fs3Year}</span>
                                     <button onClick={() => setFs3Year(prev => prev + 1)} className="w-8 h-8 font-black hover:bg-slate-200 rounded-lg">+</button>
                                  </div>
                                  <button onClick={handlePrint} className="bg-black text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Print Form</button>
                               </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="border-2 border-black p-5 space-y-3">
                                  <p className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 w-fit">A. Payer Information</p>
                                  <p className="text-sm font-black uppercase leading-tight">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                                  <p className="text-xs font-mono font-bold">PE NUMBER: {organization?.peNumber || '000000'}</p>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase">{organization?.address}</p>
                                </div>
                                <div className="border-2 border-black p-5 space-y-3">
                                  <p className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 w-fit">B. Payee Information</p>
                                  <p className="text-sm font-black uppercase leading-tight">{user.name}</p>
                                  <p className="text-xs font-mono font-bold">ID: {user.idPassportNumber || '---'}</p>
                                  <p className="text-xs font-mono font-bold">NI: {user.niNumber || '---'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                               <div className="border-2 border-black p-5 space-y-4">
                                  <p className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 w-fit">C. Gross Emoluments</p>
                                  <div className="flex justify-between text-xs font-bold border-b border-black/10 pb-2"><span>Gross Earnings</span><span className="font-black">€{fs3Data.grossPay.toFixed(2)}</span></div>
                                  <div className="flex justify-between text-xs font-bold border-b border-black/10 pb-2"><span>Fringe Benefits</span><span>€0.00</span></div>
                                  <div className="flex justify-between text-sm font-black pt-3 mt-1 bg-slate-50 px-2 py-2"><span>Total</span><span>€{fs3Data.grossPay.toFixed(2)}</span></div>
                               </div>
                               <div className="border-2 border-black p-5 space-y-4">
                                  <p className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 w-fit">D. Tax Deductions</p>
                                  <div className="flex justify-between text-xs font-bold border-b border-black/10 pb-2"><span>Tax Withheld</span><span className="font-black">€{fs3Data.tax.toFixed(2)}</span></div>
                                  <div className="flex justify-between text-sm font-black pt-3 mt-1 bg-slate-50 px-2 py-2"><span>Total Tax</span><span>€{fs3Data.tax.toFixed(2)}</span></div>
                               </div>
                            </div>
                            <div className="border-2 border-black p-6 space-y-5">
                               <p className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 w-fit">E. SSC & Maternity Fund</p>
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[10px] font-black text-center">
                                  <div className="space-y-1">SSC Employee<div className="text-sm">€{fs3Data.ni.toFixed(2)}</div></div>
                                  <div className="space-y-1">SSC Employer<div className="text-sm">€{fs3Data.employerShare.toFixed(2)}</div></div>
                                  <div className="space-y-1">Maternity Fund<div className="text-sm">€{fs3Data.maternity.toFixed(2)}</div></div>
                                  <div className="bg-black text-white p-2 flex flex-col justify-center">TOTAL SSC<div className="text-sm">€{fs3Data.totalSSC.toFixed(2)}</div></div>
                                </div>
                            </div>
                            <p className="text-[8px] font-black uppercase text-center text-slate-400 mt-8">Digitally Generated Statement • RESET Studio OOS</p>
                         </div>
                       ) : (
                         <>
                           <div className="flex justify-between border-b-2 border-slate-900 pb-8 mb-10">
                              <div className="text-left space-y-2">
                                 <h1 className="text-2xl font-bold uppercase tracking-tighter text-slate-900">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">PE Number: {organization?.peNumber || 'N/A'}</p>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Official Personnel Document</p>
                                 
                                 {/* NEW PERIOD & YEAR SECTION */}
                                 <div className="pt-4 border-t border-slate-100 mt-4">
                                    <div className="grid grid-cols-2 gap-6">
                                       <div>
                                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Pay Period From</p>
                                          <p className="text-[11px] font-black text-slate-900">{periodDisplay.from}</p>
                                       </div>
                                       <div>
                                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Pay Period Till</p>
                                          <p className="text-[11px] font-black text-slate-900">{periodDisplay.till}</p>
                                       </div>
                                    </div>
                                    <p className="text-[7px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-2">Fiscal/Tax Year: {periodDisplay.year}</p>
                                 </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-3">
                                 <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-900 bg-slate-50 px-4 py-1">
                                    {viewingDoc === 'payslip' ? `Payslip` : `Worksheet`}
                                 </h2>
                                 <div className="text-right">
                                     <p className="text-[11px] font-black uppercase text-slate-900">{user.name}</p>
                                     <p className="text-[9px] font-mono font-bold text-slate-400 mt-1">ID Card: {user.idPassportNumber || '---'}</p>
                                     <p className="text-[9px] font-mono font-bold text-slate-400">NI Number: {user.niNumber || '---'}</p>
                                 </div>
                                 <div className="no-print mt-2">
                                     <button onClick={handlePrint} className="bg-black text-white px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Print</button>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-10">
                              {viewingDoc === 'payslip' && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                                   <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-4 mb-4">
                                      <span>Line Item Description</span>
                                      <span className="text-center">Hours / Units</span>
                                      <span className="text-right">Net Value</span>
                                   </div>
                                   <div className="space-y-4 text-xs">
                                      <div className="grid grid-cols-3 font-bold text-slate-700">
                                         <span>Basic Remuneration</span>
                                         <span className="text-center text-slate-400">{monthlyData.totalHours.toFixed(1)} HRS</span>
                                         <span className="text-right font-black">€{monthlyData.totalBase.toFixed(2)}</span>
                                      </div>
                                      <div className="grid grid-cols-3 font-bold text-emerald-600">
                                         <span>Bonus & Performance Extra</span>
                                         <span className="text-center">-</span>
                                         <span className="text-right font-black">€{monthlyData.totalBonus.toFixed(2)}</span>
                                      </div>
                                      {monthlyData.govBonus > 0 && (
                                        <div className="grid grid-cols-3 font-bold text-blue-600">
                                           <span>Statutory Gov. Bonus</span>
                                           <span className="text-center">-</span>
                                           <span className="text-right font-black">€{monthlyData.govBonus.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-3 pt-6 border-t-4 border-slate-900 mt-6 font-black text-slate-900 text-lg">
                                         <span className="uppercase tracking-tighter">Gross Total</span>
                                         <span></span>
                                         <span className="text-right font-black">€{monthlyData.grossPay.toFixed(2)}</span>
                                      </div>
                                   </div>

                                   <div className="pt-8 space-y-6">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Deductions (Maltese Statutory)</p>
                                      <div className="space-y-4 text-xs font-bold">
                                         <div className="flex justify-between items-center">
                                            <span className="text-slate-500">FSS PAYE Tax ({user.isParent ? 'Parent' : 'Standard'} Rate)</span>
                                            <span className="text-rose-500 font-black">-€{monthlyData.tax.toFixed(2)}</span>
                                         </div>
                                         <div className="flex justify-between items-center">
                                            <span className="text-slate-500">SSC Social Security (Class 1)</span>
                                            <span className="text-rose-500 font-black">-€{monthlyData.ni.toFixed(2)}</span>
                                         </div>
                                         <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Maternity Fund Contribution</span>
                                            <span className="text-rose-500 font-black">-€{monthlyData.maternity.toFixed(2)}</span>
                                         </div>
                                         <div className="flex justify-between items-center pt-8 border-t-4 border-emerald-600 text-emerald-600 text-3xl">
                                            <span className="font-black uppercase tracking-tighter">Net Payout</span>
                                            <span className="font-black">€{monthlyData.totalNet.toFixed(2)}</span>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                              )}

                              {viewingDoc === 'worksheet' && (
                                <div className="pt-2 animate-in slide-in-from-bottom-4">
                                   <div className="mt-4 border-2 border-slate-900 overflow-hidden">
                                      <table className="w-full text-[10px] text-left">
                                         <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                                            <tr>
                                               <th className="p-4">Deployment Date</th>
                                               <th className="p-4">Asset / Property</th>
                                               <th className="p-4 text-right">Hours</th>
                                               <th className="p-4 text-right">Remuneration</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-100">
                                            {worksheetData.rows.length === 0 ? (
                                              <tr><td colSpan={4} className="p-8 text-center italic text-slate-300 font-bold uppercase">No deployment records found in period.</td></tr>
                                            ) : (
                                              worksheetData.rows.map((row, idx) => (
                                                  <tr key={row.shift.id + idx} className="hover:bg-slate-50 transition-colors">
                                                     <td className="p-4 font-black text-slate-900">{row.shift.date}</td>
                                                     <td className="p-4 uppercase font-bold text-slate-500 truncate max-w-[150px]">{row.propName}</td>
                                                     <td className="p-4 text-right font-mono font-bold">{row.hours.toFixed(1)}</td>
                                                     <td className="p-4 text-right font-black text-slate-900">€{row.finalPay.toFixed(2)}</td>
                                                  </tr>
                                              ))
                                            )}
                                         </tbody>
                                         <tfoot className="bg-slate-50 font-black border-t-2 border-slate-900">
                                            <tr>
                                              <td colSpan={2} className="p-4 text-right uppercase tracking-widest text-slate-400">Total Calculation</td>
                                              <td className="p-4 text-right font-black">{worksheetData.totalHours.toFixed(1)}</td>
                                              <td className="p-4 text-right text-emerald-600 font-black text-sm">€{(worksheetData.totalBase + worksheetData.totalBonus).toFixed(2)}</td>
                                            </tr>
                                         </tfoot>
                                      </table>
                                   </div>
                                </div>
                              )}
                           </div>
                         </>
                       )}
                    </div>
                 </div>
              ) : (
                <>
                  <header className="space-y-2 border-b border-slate-100 pb-8">
                    <h2 className="text-4xl font-bold text-slate-900 uppercase tracking-tighter leading-none">{user.name}</h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Personnel Ledger Archive</p>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Historical Pay Periods</p>
                        {['MAR 2026', 'FEB 2026', 'JAN 2026', 'DEC 2025'].map(p => (
                          <div key={p} className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-all shadow-sm">
                              <span className="text-xs font-black uppercase text-slate-900 tracking-widest">{p}</span>
                              <div className="flex gap-4">
                                  <button onClick={() => { setViewingDoc('payslip'); setSelectedDocMonth(p); }} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Download Payslip</button>
                                  <button onClick={() => { setViewingDoc('worksheet'); setSelectedDocMonth(p); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 underline">Worksheet</button>
                              </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-6">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Statutory Returns</p>
                        <div className="p-8 bg-slate-900 rounded-[2.5rem] flex flex-col justify-between h-48 shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setViewingDoc('fs3')}>
                           <div className="absolute -right-4 -bottom-4 text-white opacity-5 group-hover:opacity-10 transition-opacity">
                              <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                           </div>
                           <div className="relative z-10">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Annual Compliance</p>
                              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">FS3 Return</h3>
                           </div>
                           <button className="relative z-10 w-fit bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Generate Certificate</button>
                        </div>
                      </div>
                  </div>
                </>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;