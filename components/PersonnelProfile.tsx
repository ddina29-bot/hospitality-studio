
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

  const subLabelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 opacity-60";
  const detailValueStyle = "text-sm font-bold text-black uppercase tracking-tight";

  useEffect(() => {
    if (initialDocView) {
      setShowDossier(true);
      setViewingDoc(initialDocView);
      if (initialDocView === 'fs3') {
        setFs3Year(new Date().getFullYear());
      }
    }
  }, [initialDocView]);

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
      
      // Only update password if user typed something
      if (editPassword.trim()) {
        updates.password = editPassword.trim();
      }

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

  // --- MALTESE PAYROLL ENGINE 2026 ---
  const calculateMalteseTax = (annualGross: number, status: 'Single' | 'Married' | 'Parent') => {
    let tax = 0;
    
    // 2025/2026 Approximate Progressive Bands
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
    } else { // Single
        if (annualGross <= 9100) tax = 0;
        else if (annualGross <= 14500) tax = (annualGross - 9100) * 0.15;
        else if (annualGross <= 60000) tax = (annualGross - 14500) * 0.25 + 810;
        else tax = (annualGross - 60000) * 0.35 + 12185;
    }
    
    return Math.max(0, tax);
  };

  const calculateNI = (monthlyGross: number) => {
    // 10% of basic weekly wage, capped.
    // Approx Min €20/week, Max €58/week
    const weeklyGross = (monthlyGross * 12) / 52;
    const rate10 = weeklyGross * 0.10;
    
    // 2026 Projected Caps
    const minNI = 20.09; 
    const maxNI = 57.77; 
    
    let weeklyNI = rate10;
    if (weeklyNI < minNI && weeklyGross > 0) weeklyNI = minNI; 
    if (weeklyNI > maxNI) weeklyNI = maxNI;
    
    // Convert back to monthly
    return (weeklyNI * 52) / 12;
  };

  const getGovBonus = (monthStr: string) => {
    // March, June, September, December
    if (monthStr.includes('MAR')) return 121.02; // Cost of Living / Statutory
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
        const targetFee = prop.serviceRates?.[s.serviceType] !== undefined 
            ? prop.serviceRates[s.serviceType] 
            : prop.cleanerPrice;
        
        const targetPerPerson = targetFee / teamCount;

        if (user.role === 'supervisor') {
           if (s.serviceType === 'TO CHECK APARTMENT') {
              shiftBonus = prop.serviceRates?.['TO CHECK APARTMENT'] || 5.00;
           } else if (s.serviceType !== 'TO FIX') {
              shiftBonus = targetPerPerson; 
           }
           finalPay = shiftBonus; 
        } else if (user.role === 'cleaner') {
           if (user.paymentType === 'Per Clean' || user.paymentType === 'Per Hour') {
             shiftBonus = Math.max(0, targetPerPerson - shiftBasePay);
           }
           finalPay = targetPerPerson;
        } else {
           finalPay = shiftBasePay;
        }

        if (s.serviceType === 'TO FIX' && s.fixWorkPayment) {
            shiftBonus += s.fixWorkPayment;
            finalPay += s.fixWorkPayment;
        }
      } else {
         finalPay = (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') ? 0 : shiftBasePay;
      }

      // Add to running totals
      if (user.paymentType !== 'Fixed Wage' && user.role !== 'supervisor') {
          totalBase += shiftBasePay;
      }
      totalBonus += shiftBonus;

      return { shift: s, hours, finalPay, isApproved, propName: prop?.name || s.propertyName };
    });

    // Handle Fixed Wage
    if (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') {
        // If viewing FS3, multiply by 12 or active months. If Monthly, just base.
        totalBase = isMonthly ? (user.payRate || 1200) : (user.payRate || 1200) * 12;
    }

    const govBonus = isMonthly ? getGovBonus(selectedDocMonth) : 512.24; // Annual ~512
    const grossPay = totalBase + totalBonus + govBonus;
    
    // Taxes
    const ni = calculateNI(isMonthly ? grossPay : grossPay / 12) * (isMonthly ? 1 : 12);
    
    let taxCategory: 'Single' | 'Married' | 'Parent' = 'Single';
    if (user.maritalStatus === 'Married') taxCategory = 'Married';
    else if (user.isParent) taxCategory = 'Parent'; // Parent rate priority over single

    const annualProj = isMonthly ? grossPay * 12 : grossPay;
    const annualTax = calculateMalteseTax(annualProj, taxCategory);
    const tax = isMonthly ? annualTax / 12 : annualTax;

    const maternity = grossPay * 0.003; // 0.3% Maternity Fund

    return { 
      rows, 
      totalBase, 
      totalBonus, 
      govBonus,
      totalHours, 
      grossPay, 
      ni, 
      tax, 
      maternity, 
      totalNet: grossPay - ni - tax - maternity 
    };
  };

  const monthlyData = useMemo(() => calculatePayroll(monthlyShifts, true), [monthlyShifts, user, selectedDocMonth]);
  const worksheetData = useMemo(() => calculatePayroll(worksheetShifts, true), [worksheetShifts, user]);
  
  const fs3Data = useMemo(() => {
     const data = calculatePayroll(fs3Shifts, false);
     const employerShare = data.ni; // 10% Employer Share usually matches Employee 10%
     const totalSSC = data.ni + employerShare;
     return { ...data, employerShare, totalSSC };
  }, [fs3Shifts, user, fs3Year]);

  const dashboardStats = monthlyData; 

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
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif-brand text-black uppercase font-bold tracking-tight">Studio Details</h2>
        <p className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80">Personnel Records & Ledger</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-10">
          <section className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 space-y-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className={subLabelStyle}>Full Legal Name</p>
                  <h3 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{user.name}</h3>
                </div>
                {!isEditingProfile ? (
                  <button onClick={() => setIsEditingProfile(true)} className="text-[9px] font-black text-[#8B6B2E] uppercase tracking-widest border border-[#D4B476]/30 px-4 py-2 rounded-xl hover:bg-white transition-all">Edit Info</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} className="text-[9px] font-black text-green-700 uppercase tracking-widest border border-green-500/20 px-4 py-2 rounded-xl bg-green-50">Save</button>
                    <button onClick={() => setIsEditingProfile(false)} className="text-[9px] font-black text-red-700 uppercase tracking-widest border border-red-500/20 px-4 py-2 rounded-xl bg-red-50">Cancel</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-8">
                <div>
                  <p className={subLabelStyle}>Assigned Function</p>
                  <p className="text-sm font-black text-[#8B6B2E] uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="flex flex-col gap-6">
                   <div className="space-y-1">
                      <p className={subLabelStyle}>Verified Mobile</p>
                      {isEditingProfile ? (
                        <input type="text" className="w-full bg-white border border-[#D4B476]/20 rounded-lg px-2 py-1 text-black font-bold uppercase" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                      ) : (
                        <p className={detailValueStyle}>{user.phone || 'NOT RECORDED'}</p>
                      )}
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className={subLabelStyle}>Marital Status</p>
                    {isEditingProfile ? (
                      <select className="w-full bg-white border border-[#D4B476]/20 rounded-lg px-2 py-1 text-black font-bold uppercase" value={editMaritalStatus} onChange={e => setEditMaritalStatus(e.target.value)}>
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
                      <div className="flex items-center gap-2 mt-1">
                         <input type="checkbox" className="w-4 h-4 accent-[#C5A059]" checked={editIsParent} onChange={e => setEditIsParent(e.target.checked)} />
                         <span className="text-[10px] font-bold uppercase">Apply Parent Rates</span>
                      </div>
                    ) : (
                      <p className={detailValueStyle}>{user.isParent ? 'YES (Parent Rate)' : 'NO'}</p>
                    )}
                  </div>
                </div>
                
                {/* PASSWORD CHANGE SECTION */}
                {isEditingProfile && (
                  <div className="pt-4 border-t border-[#D4B476]/20 animate-in fade-in">
                     <p className={subLabelStyle}>Security Update (Optional)</p>
                     <input 
                        type="password" 
                        placeholder="Enter New Password" 
                        className="w-full bg-white border border-[#D4B476]/20 rounded-lg px-2 py-2 text-black font-bold outline-none focus:border-[#C5A059]"
                        value={editPassword}
                        onChange={e => setEditPassword(e.target.value)}
                     />
                     <p className="text-[7px] text-[#8B6B2E] mt-1 italic">Leave blank to keep current password.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] p-8 md:p-12 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Earnings Dashboard</h3>
                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Current Month ({currentMonthStr})</p>
              </div>
              <button onClick={() => setShowDossier(true)} className="bg-black text-[#C5A059] px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-2xl active:scale-95 transition-all">DETAILS / DOSSIER</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/60 p-6 rounded-3xl border border-[#D4B476]/20">
                <p className={subLabelStyle}>Base Pay (Gross)</p>
                <p className="text-2xl font-serif-brand font-bold text-black uppercase">€{dashboardStats.totalBase.toFixed(2)}</p>
              </div>
              <div className="bg-white/60 p-6 rounded-3xl border border-[#D4B476]/20">
                <p className={subLabelStyle}>Total Net Payout</p>
                <p className="text-2xl font-serif-brand font-bold text-green-700 uppercase">€{dashboardStats.totalNet.toFixed(2)}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Leave Section */}
        <section className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] p-8 md:p-12 shadow-2xl space-y-8">
           <div className="space-y-1">
              <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Leave & Absence</h3>
              <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Administrative Request Portal</p>
           </div>
           <div className="space-y-4">
              <div className="space-y-3">
                 <div>
                    <label className={subLabelStyle}>Leave Category</label>
                    <select className="w-full bg-white border border-[#D4B476]/20 rounded-xl px-4 py-3 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059]" value={leaveType} onChange={e => setLeaveType(e.target.value as any)}>
                       <option value="Day Off">Standard Day Off</option>
                       <option value="Sick Leave">Medical/Sick Leave</option>
                       <option value="Vacation Leave">Vacation Leave</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className={subLabelStyle}>Start Date</label>
                      <input type="date" className="w-full bg-white border border-[#D4B476]/20 rounded-xl px-4 py-3 text-black text-[10px] font-bold uppercase outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                   </div>
                   <div>
                      <label className={subLabelStyle}>End Date</label>
                      <input type="date" className="w-full bg-white border border-[#D4B476]/20 rounded-xl px-4 py-3 text-black text-[10px] font-bold uppercase outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                   </div>
                 </div>
              </div>
              <button onClick={handleRequest} className="w-full bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all">Submit Request</button>
           </div>
           <div className="pt-6 border-t border-black/5 space-y-4">
              <p className={subLabelStyle}>Request History</p>
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                 {myLeaves.length === 0 ? (
                   <p className="text-[10px] text-black/20 italic">No history of absence requests.</p>
                 ) : myLeaves.map(l => (
                   <div key={l.id} className="bg-white/40 p-4 rounded-2xl border border-[#D4B476]/10 flex justify-between items-center">
                      <div className="text-left">
                         <p className="text-[10px] text-black font-bold uppercase">{l.type}</p>
                         <p className="text-[8px] text-black/40 uppercase mt-0.5">{l.startDate} to {l.endDate}</p>
                      </div>
                      <span className={`text-[7px] font-black uppercase px-3 py-1.5 rounded-lg ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-black/40'}`}>{l.status}</span>
                   </div>
                 ))}
              </div>
           </div>
        </section>
      </div>

      {showDossier && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-500 overflow-y-auto">
           <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-4xl p-8 md:p-12 space-y-10 shadow-[0_30px_100px_rgba(0,0,0,0.3)] relative text-left my-auto">
              <button onClick={() => { setShowDossier(false); setViewingDoc(null); }} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors no-print">Close</button>

              {viewingDoc ? (
                 <div className="space-y-8 animate-in fade-in">
                    <button onClick={() => setViewingDoc(null)} className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.4em] flex items-center gap-2 mb-4 no-print">Back to Menu</button>
                    
                    <div ref={printContentRef} className="bg-white border border-[#D4B476]/20 p-8 rounded-[32px] shadow-xl mx-auto max-w-3xl text-[#1A1A1A]">
                       {viewingDoc === 'fs3' ? (
                         <div className="space-y-6 text-black">
                            <div className="flex justify-between items-start border-b-2 border-black pb-4">
                               <div>
                                  <h1 className="text-2xl font-serif-brand font-bold uppercase tracking-tight">FS3</h1>
                                  <p className="text-[10px] uppercase font-bold tracking-widest">Payee Statement of Earnings</p>
                               </div>
                               <div className="text-right flex flex-col items-end gap-2 no-print">
                                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                     <button onClick={() => setFs3Year(prev => prev - 1)} className="p-1 hover:bg-gray-200 rounded">-</button>
                                     <span className="text-sm font-bold w-12 text-center">{fs3Year}</span>
                                     <button onClick={() => setFs3Year(prev => prev + 1)} className="p-1 hover:bg-gray-200 rounded">+</button>
                                  </div>
                                  <button onClick={handlePrint} className="bg-black text-white px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest">Print</button>
                               </div>
                            </div>

                            {/* FS3 Body */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">A. Payer Information</p>
                                  <p className="text-xs font-bold uppercase">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                                  <p className="text-xs font-mono">PE Number: {organization?.peNumber || '000000'}</p>
                                </div>
                                <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">B. Payee Information</p>
                                  <p className="text-xs font-bold uppercase">{user.name}</p>
                                  <p className="text-xs font-mono">ID: {user.idPassportNumber || '---'}</p>
                                  <p className="text-xs font-mono">NI: {user.niNumber || '---'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">C. Gross Emoluments</p>
                                  <div className="flex justify-between text-xs"><span>C1. Gross</span><span className="font-bold">€{fs3Data.grossPay.toFixed(2)}</span></div>
                                  <div className="flex justify-between text-xs"><span>C2. Fringe</span><span>€0.00</span></div>
                                  <div className="flex justify-between text-sm font-bold pt-2 border-t"><span>C4. Total</span><span>€{fs3Data.grossPay.toFixed(2)}</span></div>
                               </div>
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">D. Tax Deductions</p>
                                  <div className="flex justify-between text-xs"><span>D1. Tax</span><span className="font-bold">€{fs3Data.tax.toFixed(2)}</span></div>
                                  <div className="flex justify-between text-sm font-bold pt-2 border-t"><span>D3. Total</span><span>€{fs3Data.tax.toFixed(2)}</span></div>
                               </div>
                            </div>

                            <div className="border border-black p-3 space-y-3">
                               <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">E. SSC & Maternity</p>
                               <div className="grid grid-cols-4 gap-4 text-[9px] font-bold text-center">
                                  <div>SSC Employee<br/>€{fs3Data.ni.toFixed(2)}</div>
                                  <div>SSC Employer<br/>€{fs3Data.employerShare.toFixed(2)}</div>
                                  <div>Maternity<br/>€{fs3Data.maternity.toFixed(2)}</div>
                                  <div className="bg-gray-100">Total SSC<br/>€{fs3Data.totalSSC.toFixed(2)}</div>
                                </div>
                            </div>
                         </div>
                       ) : (
                         <>
                           <div className="flex justify-between border-b border-black/5 pb-6 mb-6">
                              <div className="text-left space-y-1">
                                 <h1 className="text-lg font-serif-brand font-bold uppercase tracking-tight">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-[#8B6B2E]">PE: {organization?.peNumber || 'N/A'}</p>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                 <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A1A]">
                                    {viewingDoc === 'payslip' ? `PAYSLIP ${selectedDocMonth}` : `WORKSHEET`}
                                 </h2>
                                 <div className="text-right mt-1">
                                     <p className="text-[8px] font-bold uppercase">{user.name}</p>
                                     <p className="text-[8px] font-mono text-black/60">ID: {user.idPassportNumber} | NI: {user.niNumber}</p>
                                 </div>
                                 {viewingDoc === 'worksheet' && (
                                    <div className="flex gap-2 items-center mt-1 no-print">
                                       <input type="date" className="text-[9px] border rounded px-1 py-0.5" value={worksheetStart} onChange={e => setWorksheetStart(e.target.value)} />
                                       <span className="text-[8px]">-</span>
                                       <input type="date" className="text-[9px] border rounded px-1 py-0.5" value={worksheetEnd} onChange={e => setWorksheetEnd(e.target.value)} />
                                    </div>
                                 )}
                                 <button onClick={handlePrint} className="bg-black text-white px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest mt-2 no-print">Print</button>
                              </div>
                           </div>

                           <div className="space-y-8">
                              {viewingDoc === 'payslip' && (
                                <div className="space-y-4">
                                   <div className="grid grid-cols-3 text-[8px] font-black text-black/30 uppercase tracking-widest border-b border-black/5 pb-2 mb-2">
                                      <span>Description</span>
                                      <span className="text-center">Details</span>
                                      <span className="text-right">Total</span>
                                   </div>
                                   <div className="space-y-2 text-[10px]">
                                      <div className="grid grid-cols-3">
                                         <span className="font-bold">Basic Wage</span>
                                         <span className="text-center text-black/60">{monthlyData.totalHours.toFixed(1)} hrs</span>
                                         <span className="text-right font-mono">€{monthlyData.totalBase.toFixed(2)}</span>
                                      </div>
                                      <div className="grid grid-cols-3">
                                         <span className="font-bold text-green-700">Bonus/Extra</span>
                                         <span className="text-center text-black/60">-</span>
                                         <span className="text-right font-mono text-green-700">€{monthlyData.totalBonus.toFixed(2)}</span>
                                      </div>
                                      {monthlyData.govBonus > 0 && (
                                        <div className="grid grid-cols-3">
                                           <span className="font-bold text-blue-700">Gov. Statutory Bonus</span>
                                           <span className="text-center text-black/60">-</span>
                                           <span className="text-right font-mono text-blue-700">€{monthlyData.govBonus.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-3 pt-2 border-t border-black/5 mt-2 font-bold text-black">
                                         <span>GROSS TOTAL</span>
                                         <span></span>
                                         <span className="text-right font-mono">€{monthlyData.grossPay.toFixed(2)}</span>
                                      </div>
                                   </div>

                                   <div className="pt-2">
                                      <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-2 border-b border-black/5 pb-1">Deductions (Maltese Law 2026)</p>
                                      <div className="space-y-2 text-[10px]">
                                         <div className="flex justify-between">
                                            <span className="text-black/60">FSS Tax ({user.isParent ? 'Parent' : user.maritalStatus === 'Married' ? 'Married' : 'Single'} Rate)</span>
                                            <span className="text-red-500 font-mono">-€{monthlyData.tax.toFixed(2)}</span>
                                         </div>
                                         <div className="flex justify-between">
                                            <span className="text-black/60">SSC (10% Capped)</span>
                                            <span className="text-red-500 font-mono">-€{monthlyData.ni.toFixed(2)}</span>
                                         </div>
                                         <div className="flex justify-between">
                                            <span className="text-black/60">Maternity Fund (0.3%)</span>
                                            <span className="text-red-500 font-mono">-€{monthlyData.maternity.toFixed(2)}</span>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                              )}

                              {viewingDoc === 'worksheet' && (
                                <div className="pt-2">
                                   <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                                      <table className="w-full text-[9px] text-left">
                                         <thead className="bg-gray-50 border-b border-gray-200 text-black/40 font-black uppercase tracking-widest">
                                            <tr>
                                               <th className="p-3">Date</th>
                                               <th className="p-3">Property</th>
                                               <th className="p-3 text-right">Hrs</th>
                                               <th className="p-3 text-right">Pay</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-100">
                                            {worksheetData.rows.length === 0 ? (
                                              <tr><td colSpan={4} className="p-4 text-center italic text-black/20">No shifts.</td></tr>
                                            ) : (
                                              worksheetData.rows.map((row, idx) => (
                                                  <tr key={row.shift.id + idx}>
                                                     <td className="p-3 font-bold">{row.shift.date}</td>
                                                     <td className="p-3 uppercase truncate max-w-[120px]">{row.propName}</td>
                                                     <td className="p-3 text-right font-mono">{row.hours.toFixed(1)}</td>
                                                     <td className="p-3 text-right font-bold">€{row.finalPay.toFixed(2)}</td>
                                                  </tr>
                                              ))
                                            )}
                                         </tbody>
                                         <tfoot className="bg-gray-50 font-black">
                                            <tr>
                                              <td colSpan={2} className="p-3 text-right uppercase tracking-widest">Totals</td>
                                              <td className="p-3 text-right">{worksheetData.totalHours.toFixed(1)}</td>
                                              <td className="p-3 text-right text-green-700">€{(worksheetData.totalBase + worksheetData.totalBonus).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                              <td colSpan={2} className="p-3 text-right uppercase tracking-widest text-black/40">Total Hours</td>
                                              <td className="p-3 text-right text-black">{worksheetData.totalHours.toFixed(1)}</td>
                                              <td></td>
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
                  <header className="space-y-1">
                    <h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{user.name}</h2>
                    <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Document Center</p>
                  </header>
                  <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        {['MAR 2026', 'FEB 2026', 'JAN 2026', 'DEC 2025'].map(p => (
                          <div key={p} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                              <span className="text-[9px] font-bold uppercase">{p}</span>
                              <div className="flex gap-2">
                                  <button onClick={() => { setViewingDoc('payslip'); setSelectedDocMonth(p); }} className="text-[7px] font-black uppercase underline">Payslip</button>
                                  <button onClick={() => { setViewingDoc('worksheet'); setSelectedDocMonth(p); }} className="text-[7px] font-black uppercase underline">Sheet</button>
                              </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center h-fit">
                        <span className="text-[9px] font-bold uppercase">ANNUAL FS3</span>
                        <button onClick={() => setViewingDoc('fs3')} className="text-[7px] font-black uppercase underline">VIEW</button>
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
