
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
  
  // Ref for the printable content container
  const printContentRef = useRef<HTMLDivElement>(null);
  
  // Default to current month string like "OCT 2025"
  const currentMonthStr = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
  }, []);

  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(currentMonthStr);
  
  // Custom Date Range for Worksheet
  const [worksheetStart, setWorksheetStart] = useState('');
  const [worksheetEnd, setWorksheetEnd] = useState('');

  // New state for FS3 Year Selection
  const [fs3Year, setFs3Year] = useState<number>(new Date().getFullYear());

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Editable local state
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editMaritalStatus, setEditMaritalStatus] = useState(user.maritalStatus || 'Single');

  const subLabelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 opacity-60";
  const detailValueStyle = "text-sm font-bold text-black uppercase tracking-tight";

  // Auto-open specific document if requested via props
  useEffect(() => {
    if (initialDocView) {
      setShowDossier(true);
      setViewingDoc(initialDocView);
      if (initialDocView === 'fs3') {
        setFs3Year(new Date().getFullYear()); // Reset to current year on open
      }
    }
  }, [initialDocView]);

  // Sync worksheet dates with selected month when it changes
  useEffect(() => {
    if (viewingDoc === 'payslip' || viewingDoc === 'worksheet') {
      const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
      if (!isNaN(d.getTime())) {
         const y = d.getFullYear();
         const m = d.getMonth();
         // Start of month
         const start = new Date(Date.UTC(y, m, 1));
         // End of month
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
      onUpdateUser({
        ...user,
        phone: editPhone,
        maritalStatus: editMaritalStatus
      });
    }
    setIsEditingProfile(false);
  };

  const myLeaves = leaveRequests.filter(l => l.userId === user.id);

  // Helper to parse dates from shifts (handles "YYYY-MM-DD" and "DD MMM")
  const getShiftDateObj = (dateStr: string) => {
    const currentYear = new Date().getFullYear();
    if (dateStr.includes('-')) return new Date(dateStr);
    return new Date(`${dateStr} ${currentYear}`);
  };

  // 1. All Completed Shifts for User
  const allMyShifts = useMemo(() => {
    return (shifts || []).filter(s => s.userIds?.includes(user.id) && s.status === 'completed');
  }, [shifts, user.id]);

  // 2. FS3 Shifts: Filter by selected FS3 Year
  const fs3Shifts = useMemo(() => {
    const startOfYear = new Date(fs3Year, 0, 1);
    
    // If selecting a past year, end date is Dec 31st. If current year, end date is Now.
    const isCurrentYear = fs3Year === new Date().getFullYear();
    const endOfYear = isCurrentYear ? new Date() : new Date(fs3Year, 11, 31, 23, 59, 59);

    return allMyShifts.filter(s => {
      const d = getShiftDateObj(s.date);
      if (!s.date.includes('-')) {
         d.setFullYear(fs3Year); 
      }
      return d >= startOfYear && d <= endOfYear;
    });
  }, [allMyShifts, fs3Year]);

  // 3. Monthly Shifts: Filter by selectedDocMonth (Strictly Month Based for Payslips)
  const monthlyShifts = useMemo(() => {
    return allMyShifts.filter(s => {
      const d = getShiftDateObj(s.date);
      const monthStr = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
      return monthStr === selectedDocMonth;
    });
  }, [allMyShifts, selectedDocMonth]);

  // 4. Worksheet Shifts: Filter by custom date range
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

  // CALCULATION ENGINE
  const calculatePayroll = (targetShifts: Shift[]) => {
    let totalBase = 0;
    let totalBonus = 0;
    let totalHours = 0;

    const rows = targetShifts.map(s => {
      const prop = properties?.find(p => p.id === s.propertyId);
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = durationMs / (1000 * 60 * 60);
      totalHours += hours;

      const hourlyRate = user.payRate || 5.00;
      let shiftBasePay = hours * hourlyRate;
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

      totalBase += (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') ? 0 : shiftBasePay;
      totalBonus += shiftBonus;

      return { shift: s, hours, finalPay, isApproved, propName: prop?.name || s.propertyName };
    });

    const govBonus = 0; 
    let baseDisplay = totalBase;
    
    const grossPay = baseDisplay + totalBonus + govBonus;
    const ni = Math.min(grossPay * 0.10, 52.40); 
    const maternity = grossPay * 0.003;
    
    let tax = 0;
    const annualProj = grossPay * 12; 
    if (annualProj > 10000) tax = grossPay * 0.10;

    return { 
      rows, 
      totalBase, 
      totalBonus, 
      totalHours, 
      grossPay, 
      ni, 
      tax, 
      maternity, 
      totalNet: grossPay - ni - tax - maternity 
    };
  };

  // Specific Data Sets
  const monthlyData = useMemo(() => {
     const data = calculatePayroll(monthlyShifts);
     if (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') {
       data.totalBase = user.payRate || 1200;
       data.grossPay = data.totalBase + data.totalBonus;
       data.totalNet = data.grossPay - data.ni - data.tax - data.maternity;
     }
     return data;
  }, [monthlyShifts, user]);

  const worksheetData = useMemo(() => {
     const data = calculatePayroll(worksheetShifts);
     if (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') {
        data.totalBase = user.payRate || 1200; 
     }
     return data;
  }, [worksheetShifts, user]);

  const fs3Data = useMemo(() => {
     const data = calculatePayroll(fs3Shifts);
     
     // Logic for FS3 Fixed Wage
     if (user.paymentType === 'Fixed Wage' || user.role === 'supervisor') {
        const isCurrentYear = fs3Year === new Date().getFullYear();
        let monthsPassed = 12;
        
        if (isCurrentYear) {
            const now = new Date();
            monthsPassed = now.getMonth() + 1;
        }

        data.totalBase = (user.payRate || 1200) * monthsPassed;
        data.grossPay = data.totalBase + data.totalBonus;
        
        data.ni = Math.min(data.grossPay * 0.10, 52.40 * 52); 
        data.maternity = data.grossPay * 0.003;
        data.tax = data.grossPay > 9100 ? (data.grossPay * 0.10) : 0;
        data.totalNet = data.grossPay - data.ni - data.tax - data.maternity;
     }

     // Add Employer Share Calculation (Assuming match with Employee for FS3 representation)
     const employerShare = data.ni; // Standard Class 1 is typically 10% Employee / 10% Employer
     const totalSSC = data.ni + employerShare;

     return { ...data, employerShare, totalSSC };
  }, [fs3Shifts, user, fs3Year]);

  const dashboardStats = monthlyData; 

  const handlePrint = () => {
    if (!printContentRef.current) return;
    setIsPrinting(true);

    const content = printContentRef.current.innerHTML;
    
    // Open a new window for printing to ensure clean isolation
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Studio Document - ${user.name}</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
                    <style>
                        /* Screen Styles for the Print Window Preview */
                        body { 
                            font-family: 'Inter', sans-serif; 
                            background: #525659; /* Document viewer grey */
                            color: #1A1A1A; 
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            min-height: 100vh;
                        }
                        
                        /* A4 Page Simulation */
                        .a4-page {
                            width: 210mm;
                            min-height: 297mm;
                            background: white;
                            margin: 40px auto;
                            padding: 15mm; /* Inner padding */
                            box-sizing: border-box;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                            position: relative;
                        }

                        .font-serif-brand { font-family: 'Libre Baskerville', serif; }
                        .no-print { display: none !important; }
                        
                        /* Print Specific Styles */
                        @media print {
                            @page {
                                size: A4;
                                margin: 0;
                            }
                            body {
                                background: white;
                                margin: 0;
                                padding: 0;
                                display: block;
                            }
                            .a4-page {
                                margin: 0;
                                box-shadow: none;
                                width: 100%;
                                min-height: 100%;
                                padding: 10mm; /* Safe print margin */
                                page-break-after: always;
                            }
                            /* Ensure background colors/graphics print */
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="a4-page">
                        ${content}
                    </div>
                    <script>
                        // Wait for fonts and tailwind to parse
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                            }, 800);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
        
        // Reset button state
        setTimeout(() => setIsPrinting(false), 1000);
    } else {
        alert("Pop-up blocked! Please allow pop-ups for this site to print documents.");
        setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="space-y-2">
        <h2 className="text-4xl font-serif-brand text-black uppercase font-bold tracking-tight">Studio Details</h2>
        <p className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80">Personnel Records & Ledger</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Profile Card */}
        <div className="space-y-10">
          <section className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-black pointer-events-none">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
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
                      <p className={subLabelStyle}>Contact Email</p>
                      <p className={detailValueStyle}>{user.email}</p>
                   </div>
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
                      </select>
                    ) : (
                      <p className={detailValueStyle}>{user.maritalStatus || 'Single'}</p>
                    )}
                  </div>
                  <div>
                    <p className={subLabelStyle}>ID / Passport</p>
                    <p className={detailValueStyle}>{user.idPassportNumber || user.niNumber || 'PENDING'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] p-8 md:p-12 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Earnings Dashboard</h3>
                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Current Month Tracker ({currentMonthStr})</p>
              </div>
              <button 
                onClick={() => setShowDossier(true)}
                className="bg-black text-[#C5A059] px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-zinc-900 flex items-center justify-center gap-3"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y2="13"/><line x1="16" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                DETAILS / DOSSIER
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/60 p-6 rounded-3xl border border-[#D4B476]/20">
                <p className={subLabelStyle}>
                  {(user.paymentType === 'Fixed Wage' || user.role === 'supervisor') ? 'Monthly Salary' : 'Base Pay (Gross)'}
                </p>
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

      {/* PERSONNEL DOSSIER MODAL */}
      {showDossier && (
        <div 
          id="dossier-modal-overlay" 
          className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-500 overflow-y-auto"
        >
           <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-4xl p-8 md:p-12 space-y-10 shadow-[0_30px_100px_rgba(0,0,0,0.3)] relative text-left my-auto">
              <button onClick={() => { setShowDossier(false); setViewingDoc(null); }} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors no-print">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              {viewingDoc ? (
                 <div className="space-y-8 animate-in fade-in">
                    <button onClick={() => setViewingDoc(null)} className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.4em] flex items-center gap-2 mb-4 no-print">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg> Back to Menu
                    </button>
                    
                    {/* PRINTABLE AREA CONTAINER */}
                    <div ref={printContentRef} className="bg-white border border-[#D4B476]/20 p-8 rounded-[32px] shadow-xl mx-auto max-w-3xl text-[#1A1A1A]">
                       {viewingDoc === 'fs3' ? (
                         <div className="space-y-6 text-black">
                            <div className="flex justify-between items-start border-b-2 border-black pb-4">
                               <div>
                                  <h1 className="text-2xl font-serif-brand font-bold uppercase tracking-tight">FS3</h1>
                                  <p className="text-[10px] uppercase font-bold tracking-widest">Payee Statement of Earnings</p>
                                  <p className="text-[8px] uppercase tracking-widest text-[#8B6B2E] mt-1">
                                    PERIOD: 01/01/{fs3Year} - {fs3Year === new Date().getFullYear() ? new Date().toLocaleDateString() + ' (YTD)' : `31/12/${fs3Year} (FINAL)`}
                                  </p>
                               </div>
                               <div className="text-right flex flex-col items-end gap-2 no-print">
                                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                     <button onClick={() => setFs3Year(prev => prev - 1)} className="p-1 hover:bg-gray-200 rounded"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
                                     <span className="text-sm font-bold w-12 text-center">{fs3Year}</span>
                                     <button onClick={() => setFs3Year(prev => prev + 1)} className="p-1 hover:bg-gray-200 rounded"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg></button>
                                  </div>
                                  <p className="text-[8px] uppercase tracking-widest opacity-60">Year of Assessment: {fs3Year + 1}</p>
                                  <button 
                                    onClick={handlePrint} 
                                    disabled={isPrinting}
                                    className="bg-black text-white px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 mt-1 disabled:opacity-50"
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    {isPrinting ? 'Preparing...' : 'Print / Save PDF'}
                                  </button>
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                               {/* PART A: PAYER */}
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">A. Payer Information</p>
                                  <div className="space-y-1">
                                     <p className="text-[8px] uppercase tracking-widest text-gray-500">Name of Payer</p>
                                     <p className="text-xs font-bold uppercase">{organization?.name || 'RESET STUDIO LTD'}</p>
                                  </div>
                                  <div className="space-y-1">
                                     <p className="text-[8px] uppercase tracking-widest text-gray-500">PE Number</p>
                                     <p className="text-xs font-bold font-mono">{organization?.peNumber || '000000'}</p>
                                  </div>
                               </div>

                               {/* PART B: PAYEE */}
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">B. Payee Information</p>
                                  <div className="space-y-1">
                                     <p className="text-[8px] uppercase tracking-widest text-gray-500">ID / Passport No.</p>
                                     <p className="text-xs font-bold font-mono">{user.idPassportNumber || '---'}</p>
                                  </div>
                                  <div className="space-y-1">
                                     <p className="text-[8px] uppercase tracking-widest text-gray-500">Full Name</p>
                                     <p className="text-xs font-bold uppercase">{user.name}</p>
                                  </div>
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                               {/* PART C: EMOLUMENTS */}
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">C. Gross Emoluments</p>
                                  <div className="flex justify-between items-end border-b border-dashed border-gray-300 pb-1">
                                     <span className="text-[8px] uppercase font-bold">C1. Gross (FSS Main)</span>
                                     <span className="text-xs font-mono font-bold">€{fs3Data.grossPay.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-end border-b border-dashed border-gray-300 pb-1">
                                     <span className="text-[8px] uppercase font-bold">C2. Fringe Benefits</span>
                                     <span className="text-xs font-mono font-bold">€0.00</span>
                                  </div>
                                  <div className="flex justify-between items-end pt-1">
                                     <span className="text-[9px] uppercase font-black">C4. Total Gross</span>
                                     <span className="text-sm font-mono font-bold">€{fs3Data.grossPay.toFixed(2)}</span>
                                  </div>
                               </div>

                               {/* PART D: TAX DEDUCTIONS */}
                               <div className="border border-black p-3 space-y-2">
                                  <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">D. Tax Deductions</p>
                                  <div className="flex justify-between items-end border-b border-dashed border-gray-300 pb-1">
                                     <span className="text-[8px] uppercase font-bold">D1. Tax Deducted (Main)</span>
                                     <span className="text-xs font-mono font-bold">€{fs3Data.tax.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-end pt-1">
                                     <span className="text-[9px] uppercase font-black">D3. Total Tax</span>
                                     <span className="text-sm font-mono font-bold">€{fs3Data.tax.toFixed(2)}</span>
                                  </div>
                               </div>
                            </div>

                            {/* PART E: SOCIAL SECURITY & MATERNITY (Combined as per FS3 Spec) */}
                            <div className="border border-black p-3 space-y-3">
                               <p className="text-[9px] font-bold uppercase bg-gray-100 px-1">E. Social Security & Maternity Fund Information</p>
                               
                               <div className="w-full text-left">
                                  {/* Table Header */}
                                  <div className="grid grid-cols-4 gap-2 text-[7px] font-black uppercase tracking-widest bg-gray-50 border-b border-black/20 pb-1 mb-2 text-center">
                                     <div className="text-left pl-2">Basic Weekly Wage</div>
                                     <div className="border-l border-black/10">Social Security</div>
                                     <div className="border-l border-black/10">Maternity Fund</div>
                                     <div className="border-l border-black/10">Weeks</div>
                                  </div>

                                  {/* Columns Headers */}
                                  <div className="grid grid-cols-7 gap-1 text-[7px] font-bold uppercase text-black/60 text-center mb-2">
                                     <div className="col-span-1"></div>
                                     <div className="col-span-1 border-l border-black/5">Payee</div>
                                     <div className="col-span-1 border-l border-black/5">Payer</div>
                                     <div className="col-span-1 border-l border-black/5 text-black">Total SSC</div>
                                     <div className="col-span-1 border-l border-black/5">Payer</div>
                                     <div className="col-span-2 border-l border-black/5">No Pay</div>
                                  </div>

                                  {/* Data Row (Total) */}
                                  <div className="grid grid-cols-7 gap-1 items-center text-[9px] font-mono font-bold text-center py-2 border-t border-dashed border-gray-300">
                                     <div className="col-span-1 text-left pl-2 font-sans font-black uppercase text-[7px]">E1. Total</div>
                                     <div className="col-span-1 border-l border-black/5">€{fs3Data.ni.toFixed(2)}</div>
                                     <div className="col-span-1 border-l border-black/5">€{fs3Data.employerShare.toFixed(2)}</div>
                                     <div className="col-span-1 border-l border-black/5 font-black bg-gray-50">€{fs3Data.totalSSC.toFixed(2)}</div>
                                     <div className="col-span-1 border-l border-black/5">€{fs3Data.maternity.toFixed(2)}</div>
                                     <div className="col-span-2 border-l border-black/5 text-gray-300">--</div>
                                  </div>
                               </div>
                            </div>

                            <div className="pt-8 flex justify-between items-end">
                               <div className="space-y-1">
                                  <div className="h-px w-48 bg-black"></div>
                                  <p className="text-[7px] uppercase font-bold">Signature of Payer</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[8px] uppercase font-bold">Date: {new Date().toLocaleDateString()}</p>
                               </div>
                            </div>
                         </div>
                       ) : (
                         <>
                           <div className="flex justify-between border-b border-black/5 pb-6 mb-6">
                              <div className="text-left space-y-1">
                                 <h1 className="text-lg font-serif-brand font-bold uppercase tracking-tight">{organization?.name || 'RESET STUDIO'}</h1>
                                 <p className="text-[8px] font-black uppercase tracking-widest text-[#8B6B2E]">{organization?.address || 'MALTA'}</p>
                                 <p className="text-[7px] font-black uppercase tracking-widest text-black/40">PE NO: {organization?.peNumber || 'N/A'}</p>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                 <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A1A]">
                                    {viewingDoc === 'payslip' ? `PAYSLIP ${selectedDocMonth}` : `WORKSHEET`}
                                 </h2>
                                 {viewingDoc === 'worksheet' ? (
                                    <div className="flex gap-2 items-center mt-1 no-print">
                                       <input type="date" className="text-[9px] border rounded px-1 py-0.5" value={worksheetStart} onChange={e => setWorksheetStart(e.target.value)} />
                                       <span className="text-[8px]">-</span>
                                       <input type="date" className="text-[9px] border rounded px-1 py-0.5" value={worksheetEnd} onChange={e => setWorksheetEnd(e.target.value)} />
                                    </div>
                                 ) : (
                                    <p className="text-[7px] text-black/40 font-black uppercase tracking-widest mt-1">Compliance: Malta Law</p>
                                 )}
                                 <button 
                                   onClick={handlePrint} 
                                   disabled={isPrinting}
                                   className="bg-black text-white px-3 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 mt-2 no-print disabled:opacity-50"
                                 >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    {isPrinting ? 'Preparing...' : 'Print / Save PDF'}
                                 </button>
                              </div>
                           </div>

                           <div className="space-y-8">
                              <div className="grid grid-cols-2 gap-4 border-b border-black/5 pb-6">
                                 <div className="text-left space-y-0.5">
                                    <p className={subLabelStyle}>Employee</p>
                                    <p className="text-xs font-bold uppercase">{user.name}</p>
                                    <p className="text-[8px] text-black/60 font-medium uppercase">{user.address || 'Address N/A'}</p>
                                 </div>
                                 <div className="text-right space-y-0.5">
                                    <p className={subLabelStyle}>ID No.</p>
                                    <p className="text-xs font-mono font-bold">{user.idPassportNumber || user.niNumber || '---'}</p>
                                    <p className="text-[8px] font-bold uppercase text-black/60">{user.role}</p>
                                 </div>
                              </div>

                              {viewingDoc === 'payslip' && (
                                <>
                                  <div className="space-y-4">
                                     {/* EARNINGS */}
                                     <div>
                                        <div className="grid grid-cols-3 text-[8px] font-black text-black/30 uppercase tracking-widest border-b border-black/5 pb-2 mb-2">
                                           <span>Description</span>
                                           <span className="text-center">Rate / Hrs</span>
                                           <span className="text-right">Total</span>
                                        </div>
                                        <div className="space-y-2 text-[10px]">
                                           <div className="grid grid-cols-3">
                                              <span className="font-bold">Basic Wage</span>
                                              <span className="text-center text-black/60">
                                                {user.paymentType === 'Fixed Wage' || user.role === 'supervisor' ? 'Monthly Salary' : `${monthlyData.totalHours.toFixed(1)} hrs @ €${(user.payRate || 5).toFixed(2)}`}
                                              </span>
                                              <span className="text-right font-mono">€{monthlyData.totalBase.toFixed(2)}</span>
                                           </div>
                                           <div className="grid grid-cols-3">
                                              <span className="font-bold text-green-700">Performance Bonus</span>
                                              <span className="text-center text-black/60">-</span>
                                              <span className="text-right font-mono text-green-700">€{monthlyData.totalBonus.toFixed(2)}</span>
                                           </div>
                                           <div className="grid grid-cols-3 pt-2 border-t border-black/5 mt-2 font-bold text-black">
                                              <span>GROSS TOTAL</span>
                                              <span></span>
                                              <span className="text-right font-mono">€{monthlyData.grossPay.toFixed(2)}</span>
                                           </div>
                                        </div>
                                     </div>

                                     {/* DEDUCTIONS */}
                                     <div className="pt-2">
                                        <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-2 border-b border-black/5 pb-1">Deductions</p>
                                        <div className="space-y-2 text-[10px]">
                                           <div className="flex justify-between">
                                              <span className="text-black/60">FSS Tax (10%)</span>
                                              <span className="text-red-500 font-mono">-€{monthlyData.tax.toFixed(2)}</span>
                                           </div>
                                           <div className="flex justify-between">
                                              <span className="text-black/60">SSC (Social Security)</span>
                                              <span className="text-red-500 font-mono">-€{monthlyData.ni.toFixed(2)}</span>
                                           </div>
                                           <div className="flex justify-between">
                                              <span className="text-black/60">Maternity Fund</span>
                                              <span className="text-red-500 font-mono">-€{monthlyData.maternity.toFixed(2)}</span>
                                           </div>
                                        </div>
                                     </div>
                                  </div>

                                  <div className="bg-[#FDF8EE] border border-[#C5A059] p-6 rounded-2xl flex justify-between items-center shadow-md">
                                     <p className="text-[9px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">NET PAYMENT</p>
                                     <p className="text-2xl font-serif-brand font-bold text-black">€{monthlyData.totalNet.toFixed(2)}</p>
                                  </div>
                                </>
                              )}

                              {viewingDoc === 'worksheet' && (
                                <div className="pt-2">
                                   <p className={subLabelStyle}>WORK SHEET ({worksheetStart} to {worksheetEnd})</p>
                                   <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                                      <table className="w-full text-[9px] text-left">
                                         <thead className="bg-gray-50 border-b border-gray-200 text-black/40 font-black uppercase tracking-widest">
                                            <tr>
                                               <th className="p-3">Date</th>
                                               <th className="p-3">Property</th>
                                               <th className="p-3">Type</th>
                                               <th className="p-3 text-right">Hrs</th>
                                               <th className="p-3 text-right">Status</th>
                                               <th className="p-3 text-right">Pay</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-100">
                                            {worksheetData.rows.length === 0 ? (
                                              <tr><td colSpan={6} className="p-4 text-center italic text-black/20">No shifts recorded in this period.</td></tr>
                                            ) : (
                                              worksheetData.rows.map((row, idx) => (
                                                  <tr key={row.shift.id + idx}>
                                                     <td className="p-3 font-bold">{row.shift.date}</td>
                                                     <td className="p-3 uppercase truncate max-w-[80px] sm:max-w-[120px]">{row.propName}</td>
                                                     <td className="p-3 uppercase truncate max-w-[80px] sm:max-w-[100px] text-black/60">{row.shift.serviceType}</td>
                                                     <td className="p-3 text-right font-mono">{row.hours.toFixed(1)}</td>
                                                     <td className="p-3 text-right font-black uppercase">
                                                        <span className={row.isApproved ? 'text-green-600' : 'text-red-600'}>
                                                           {row.shift.approvalStatus}
                                                        </span>
                                                     </td>
                                                     <td className="p-3 text-right font-bold">€{row.finalPay.toFixed(2)}</td>
                                                  </tr>
                                              ))
                                            )}
                                         </tbody>
                                         <tfoot className="bg-gray-50 font-black">
                                            <tr>
                                              <td colSpan={5} className="p-3 text-right uppercase tracking-widest">Total Pay</td>
                                              <td className="p-3 text-right text-green-700">€{(worksheetData.totalBase + worksheetData.totalBonus).toFixed(2)}</td>
                                            </tr>
                                         </tfoot>
                                      </table>
                                   </div>
                                   <p className="text-[7px] text-black/40 mt-3 text-center italic">* Approved shifts paid at property rate. Rejected shifts revert to base rate logic.</p>
                                </div>
                              )}
                           </div>

                           <div className="mt-10 pt-6 border-t border-black/5 text-center">
                              <p className="text-[7px] font-black text-black/20 uppercase tracking-[0.6em]">Digitally Certified by Reset Hospitality Studio Core Ledger</p>
                           </div>
                         </>
                       )}
                    </div>
                 </div>
              ) : (
                <>
                  <header className="space-y-1">
                    <p className="text-[10px] font-black text-[#A68342] uppercase tracking-[0.6em] mb-2">Personnel Intelligence Dossier</p>
                    <h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{user.name}</h2>
                    <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Employee Ref: {user.id.toUpperCase()}</p>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <h3 className="text-xs font-serif-brand font-bold text-black uppercase tracking-widest">Official Ledger</h3>
                          <div className="h-px flex-1 bg-black/5"></div>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-white border border-[#D4B476]/20 p-6 rounded-[32px] space-y-4 shadow-sm">
                              <p className={subLabelStyle}>Monthly Documents</p>
                              <div className="space-y-2">
                                {['MAR 2026 (PENDING)', 'FEB 2026', 'JAN 2026', 'DEC 2025', 'NOV 2025', 'OCT 2025'].map(p => (
                                  <div key={p} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-transparent">
                                      <span className="text-[10px] font-bold text-black uppercase tracking-tight">{p}</span>
                                      {!p.includes('PENDING') && (
                                        <div className="flex gap-2">
                                            <button 
                                              onClick={() => { setViewingDoc('payslip'); setSelectedDocMonth(p); }} 
                                              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[7px] font-black uppercase hover:border-[#C5A059] transition-all"
                                            >
                                              Payslip
                                            </button>
                                            <button 
                                              onClick={() => { setViewingDoc('worksheet'); setSelectedDocMonth(p); }} 
                                              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[7px] font-black uppercase hover:border-[#C5A059] transition-all"
                                            >
                                              Work Sheet
                                            </button>
                                        </div>
                                      )}
                                  </div>
                                ))}
                              </div>
                          </div>

                          <div className="bg-white border border-[#D4B476]/20 p-6 rounded-[32px] space-y-4 shadow-sm">
                              <p className={subLabelStyle}>Tax Certification (FS3)</p>
                              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                                <span className="text-[10px] font-bold text-black uppercase tracking-tight">ANNUAL FS3</span>
                                <button onClick={() => setViewingDoc('fs3')} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[7px] font-black uppercase hover:border-[#C5A059] transition-all">VIEW</button>
                              </div>
                          </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-orange-50 border border-orange-200 p-8 rounded-[32px] space-y-4">
                            <p className="text-[8px] font-black text-orange-700 uppercase tracking-widest">Payroll Notice</p>
                            <p className="text-[10px] text-orange-900/60 italic leading-relaxed">
                              "Performance bonuses are calculated as the difference between the Property Rate and your Base Hourly Pay for approved shifts. Rejected shifts revert to Base Hourly Pay."
                            </p>
                        </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-black/5 flex justify-center">
                    <button onClick={() => setShowDossier(false)} className="text-[10px] font-black text-[#A68342] uppercase tracking-[0.5em] underline underline-offset-8 hover:text-black transition-all">Close Dossier</button>
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
