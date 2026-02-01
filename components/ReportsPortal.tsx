
import React, { useState, useMemo } from 'react';
import { AuditReport, User, UserRole, SupplyRequest, Shift, LeaveRequest } from '../types';

interface ReportsPortalProps {
  auditReports?: AuditReport[];
  users?: User[];
  supplyRequests?: SupplyRequest[];
  shifts?: Shift[];
  leaveRequests?: LeaveRequest[];
  userRole: UserRole;
}

type ReportTab = 'audit' | 'employees' | 'incidents';
type SortOrder = 'newest' | 'oldest' | 'type';
type GroupMode = 'none' | 'property';

const ReportsPortal: React.FC<ReportsPortalProps> = ({ 
  auditReports = [], 
  users = [], 
  supplyRequests = [], 
  shifts = [],
  leaveRequests = [],
  userRole 
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('audit'); // Default to Audit for easier access
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Sorting & Grouping State
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  const isHousekeeping = userRole === 'housekeeping';

  // --- HELPER FUNCTIONS ---
  const getUserLeaveHistory = (userId: string) => {
    return (leaveRequests || [])
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  };

  const calculateAttendanceGaps = (userId: string) => {
    const gaps: { date: string; replacedBy: string }[] = [];
    shifts.forEach((s) => {
      if (s.replacedUserId === userId) {
        const replacementNames = s.userIds
          .map((id) => users.find((u) => u.id === id)?.name || 'Unknown')
          .join(', ');
        gaps.push({ date: s.date, replacedBy: replacementNames || 'Team' });
      }
    });
    return gaps;
  };

  // --- PDF GENERATOR ENGINE ---
  const handleGeneratePDF = (shift: Shift, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent opening modal when clicking PDF
    const cleanerNames = shift.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(', ');
    const inspectorName = shift.decidedBy || 'System/Admin';
    const date = shift.date;
    const formatTime = (ts?: number, str?: string) => {
       if (ts) return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
       return str || 'N/A';
    };
    const timeRange = `${formatTime(shift.actualStartTime, shift.startTime)} - ${formatTime(shift.actualEndTime, shift.endTime)}`;

    const allPhotos = [
        ...(shift.tasks?.flatMap(t => t.photos) || []),
        ...(shift.checkoutPhotos?.keyInBox || []),
        ...(shift.checkoutPhotos?.boxClosed || [])
    ];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to generate the PDF.");
        return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report - ${shift.propertyName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Libre+Baskerville:wght@700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; padding: 40px; }
          .brand-font { font-family: 'Libre Baskerville', serif; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body class="bg-white text-black max-w-4xl mx-auto">
        <div class="border-b-4 border-[#C5A059] pb-6 mb-8 flex justify-between items-start">
           <div>
              <p class="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.4em] mb-2">RESET HOSPITALITY STUDIO</p>
              <h1 class="text-3xl brand-font font-bold uppercase tracking-tight mb-4">${shift.propertyName}</h1>
              
              <div class="flex flex-col gap-1">
                 <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-400 w-16">DATE</span>
                    <span class="text-sm font-bold text-black uppercase tracking-widest bg-gray-50 px-2 rounded">${date}</span>
                 </div>
                 <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-400 w-16">TIME</span>
                    <span class="text-xs font-bold text-black uppercase tracking-widest">${timeRange}</span>
                 </div>
                 <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-400 w-16">SERVICE</span>
                    <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">${shift.serviceType}</span>
                 </div>
              </div>
           </div>
           <div class="text-right">
              <span class="bg-[#C5A059] text-black px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-black">
                ${shift.approvalStatus === 'approved' ? 'VERIFIED' : 'REPORT'}
              </span>
           </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
           <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Staff Executed</p>
              <p class="text-xs font-bold uppercase">${cleanerNames}</p>
           </div>
           <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Signed Off By</p>
              <p class="text-xs font-bold uppercase">${inspectorName}</p>
           </div>
        </div>

        ${shift.approvalComment ? `
        <div class="mb-10">
           <h3 class="text-xs font-black uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Notes</h3>
           <p class="text-xs italic text-gray-600 bg-[#FDF8EE] p-4 rounded-xl border border-[#D4B476]/30">"${shift.approvalComment}"</p>
        </div>` : ''}

        <div class="mb-10">
           <h3 class="text-xs font-black uppercase tracking-widest border-b border-gray-100 pb-2 mb-6">Visual Evidence</h3>
           <div class="grid grid-cols-3 gap-4">
              ${allPhotos.length > 0 ? allPhotos.map(p => `
                <div class="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                   <img src="${p.url}" class="w-full h-full object-cover" />
                </div>
              `).join('') : '<p class="text-xs text-gray-400 italic col-span-3">No photos attached to this report.</p>'}
           </div>
        </div>

        <div class="text-center pt-10 border-t border-gray-100">
           <p class="text-[7px] font-black text-gray-300 uppercase tracking-[0.5em]">Generated via Studio Intelligence</p>
        </div>

        <script>
           window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const currentYear = new Date().getFullYear();
    if (dateStr.includes('-')) return new Date(dateStr);
    const parts = dateStr.trim().split(' ');
    if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1].toLowerCase();
        const months: {[key: string]: number} = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        if (months[monthStr] !== undefined && !isNaN(day)) return new Date(currentYear, months[monthStr], day);
    }
    const d = new Date(`${dateStr} ${currentYear}`);
    return isNaN(d.getTime()) ? null : d;
  };

  const groupShiftsByMonthDay = (shiftList: Shift[]) => {
    const groups: { monthLabel: string; year: number; monthIndex: number; days: { date: string; shifts: Shift[] }[] }[] = [];
    shiftList.forEach(shift => {
        let d = parseDate(shift.date);
        if (!d) d = new Date(0);
        const monthLabel = d.getTime() === 0 ? "ARCHIVED / UNDATED" : d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        let mGroup = groups.find(g => g.monthLabel === monthLabel);
        if (!mGroup) {
            mGroup = { monthLabel, year, monthIndex, days: [] };
            groups.push(mGroup);
        }
        let dGroup = mGroup.days.find(day => day.date === shift.date);
        if (!dGroup) {
            dGroup = { date: shift.date, shifts: [] };
            mGroup.days.push(dGroup);
        }
        dGroup.shifts.push(shift);
    });
    return groups.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthIndex - a.monthIndex;
    });
  };

  const auditHistory = useMemo(() => {
    const lowerSearch = auditSearch.toLowerCase();
    
    return shifts.filter(s => {
        if (s.status !== 'completed' || s.approvalStatus !== 'approved') return false;
        
        if (!lowerSearch) return true;

        const propName = s.propertyName?.toLowerCase() || '';
        const dateStr = s.date.toLowerCase();
        
        const dateObj = parseDate(s.date);
        const monthName = dateObj ? dateObj.toLocaleString('default', { month: 'long' }).toLowerCase() : '';
        
        const cleanerNames = s.userIds.map(id => users.find(u => u.id === id)?.name.toLowerCase() || '').join(' ');

        return propName.includes(lowerSearch) || 
               dateStr.includes(lowerSearch) || 
               cleanerNames.includes(lowerSearch) || 
               monthName.includes(lowerSearch);
    }).sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }, [shifts, auditSearch, users]);

  const auditMonthGroups = useMemo(() => groupShiftsByMonthDay(auditHistory), [auditHistory]);

  const incidentReports = useMemo(() => {
    const all: any[] = [];
    shifts.forEach(s => {
       const date = s.date;
       const prop = s.propertyName || 'Unknown';
       s.maintenanceReports?.forEach(r => all.push({ ...r, type: 'Maintenance', date, propertyName: prop, shiftId: s.id, resolved: r.status === 'resolved', assignedTo: r.assignedTo }));
       s.damageReports?.forEach(r => all.push({ ...r, type: 'Damage', date, propertyName: prop, shiftId: s.id, resolved: r.status === 'resolved', assignedTo: r.assignedTo }));
       s.missingReports?.forEach(r => all.push({ ...r, type: 'Missing Item', date, propertyName: prop, shiftId: s.id, resolved: r.status === 'resolved', assignedTo: r.assignedTo }));
    });
    return all;
  }, [shifts]);

  const filteredIncidents = useMemo(() => {
      let list = incidentReports;
      if (incidentSearch) {
        const q = incidentSearch.toLowerCase();
        list = list.filter(i => i.propertyName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
      }
      list = list.sort((a, b) => {
         if (sortOrder === 'newest') return b.timestamp - a.timestamp;
         if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
         if (sortOrder === 'type') return a.type.localeCompare(b.type);
         return 0;
      });
      return list;
  }, [incidentReports, incidentSearch, sortOrder]);

  const filteredPersonnel = useMemo(() => {
    if (!personnelSearch) return users;
    const s = personnelSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(s) || u.role.toLowerCase().includes(s));
  }, [users, personnelSearch]);

  const personnelGroups = useMemo(() => {
    return [
      { title: 'Cleaning & Supervision', members: filteredPersonnel.filter(u => ['cleaner', 'supervisor'].includes(u.role)) },
      { title: 'Logistics & Technical', members: filteredPersonnel.filter(u => ['driver', 'maintenance', 'laundry', 'outsourced_maintenance'].includes(u.role)) },
      { title: 'Management & Admin', members: filteredPersonnel.filter(u => ['admin', 'housekeeping', 'hr', 'finance', 'client'].includes(u.role)) }
    ].filter(g => g.members.length > 0);
  }, [filteredPersonnel]);

  const calculateUserMetrics = (userId: string) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj || ['admin', 'housekeeping', 'driver', 'hr', 'finance', 'client', 'maintenance', 'laundry', 'outsourced_maintenance'].includes(userObj.role)) return null;
    
    const userShifts = shifts.filter(s => s.userIds?.includes(userId) && s.status === 'completed' && (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected'));
    const approved = userShifts.filter(s => s.approvalStatus === 'approved').length;
    const total = userShifts.length;
    let totalHours = 0;
    userShifts.forEach(s => { if (s.actualStartTime && s.actualEndTime) totalHours += (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60); });
    let score = 5.0;
    if (total > 0) score = 1 + (approved / total) * 4;
    return { approved, rejected: total - approved, score: parseFloat(score.toFixed(1)), total, totalHours: totalHours.toFixed(1) };
  };

  const inputStyle = "bg-white border border-gray-300 rounded-full px-5 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20 shadow-sm";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">INTELLIGENCE PORTAL</h2>
           <p className="text-[9px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Operations Data Center</p>
        </div>
        <nav className="p-1 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'audit', label: 'Quality Audits' },
              { id: 'incidents', label: 'Incidents' },
              { id: 'employees', label: 'Personnel' },
            ].map((t) => (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id as any)} 
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === t.id ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/30 hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* --- AUDIT TAB (Approved Shifts - List View) --- */}
      {activeTab === 'audit' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           {/* Search Bar for Month, Date, Name, Apt */}
           <div className="relative w-full">
              <input type="text" placeholder="SEARCH MONTH, DATE, APARTMENT, OR STAFF..." className={`${inputStyle} w-full pl-12`} value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
              <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-12">
              {auditMonthGroups.length === 0 ? (
                 <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No approved records found.</div>
              ) : (
                 auditMonthGroups.map((monthGroup, mIdx) => (
                    <div key={mIdx} className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-md mb-8">
                       <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xl font-serif-brand font-bold text-black uppercase tracking-tight">{monthGroup.monthLabel}</h2>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-200 text-[#C5A059]">
                              {monthGroup.days.reduce((acc, d) => acc + d.shifts.length, 0)} Records
                          </span>
                       </div>
                       
                       <div className="p-6 md:p-8 space-y-8">
                          {monthGroup.days.map((dayGroup, dIdx) => (
                             <div key={dIdx} className="space-y-4">
                                <div className="flex items-center gap-4">
                                   <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.2em]">{dayGroup.date}</span>
                                   <div className="h-px flex-1 bg-gray-100"></div>
                                </div>
                                <div className="space-y-3">
                                   {dayGroup.shifts.map(shift => {
                                      const durationText = shift.actualStartTime && shift.actualEndTime 
                                        ? `${new Date(shift.actualStartTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(shift.actualEndTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` 
                                        : `${shift.startTime} - ${shift.endTime}`;
                                      const cleaners = shift.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).join(', ');

                                      return (
                                         <div key={shift.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-[#C5A059]/30 transition-all shadow-sm group gap-4">
                                            {/* Left: Info */}
                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 bg-[#FDF8EE] rounded-xl border border-[#D4B476]/20 text-[#C5A059]">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-black uppercase truncate">{shift.propertyName}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className="text-[8px] font-black bg-green-50 text-green-700 px-2 py-0.5 rounded uppercase border border-green-100">Verified</span>
                                                        <span className="text-[8px] text-black/40 font-bold uppercase">{shift.serviceType}</span>
                                                        <span className="text-[8px] text-black/30 uppercase font-medium hidden md:inline-block">• {cleaners}</span>
                                                        <span className="text-[8px] text-black/30 uppercase font-medium hidden md:inline-block">• {durationText}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex items-center gap-2 w-full md:w-auto">
                                                <button 
                                                    onClick={(e) => handleGeneratePDF(shift, e)} 
                                                    className="flex-1 md:flex-none px-4 py-2 bg-black text-[#C5A059] rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-800 transition-all"
                                                >
                                                    PDF Report
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setSelectedAuditShift(shift); }} 
                                                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-gray-200 text-black/60 rounded-xl text-[8px] font-black uppercase tracking-widest hover:text-black hover:border-[#C5A059] active:scale-95 transition-all"
                                                >
                                                    Details
                                                </button>
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      )}

      {/* --- EMPLOYEES TAB (PERSONNEL) --- */}
      {activeTab === 'employees' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <div className="relative w-full">
              <input type="text" placeholder="SEARCH STAFF..." className={`${inputStyle} w-full pl-12`} value={personnelSearch} onChange={(e) => setPersonnelSearch(e.target.value)} />
              <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-12">
              {personnelGroups.map((group, idx) => (
                 <section key={idx} className="space-y-6">
                    <div className="flex items-center gap-4 px-1">
                       <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-black/30">{group.title}</h3>
                       <div className="h-px flex-1 bg-black/5"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {group.members.map(u => {
                          const metrics = calculateUserMetrics(u.id);
                          return (
                             <div key={u.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-md hover:shadow-xl transition-all flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg ${u.status === 'active' ? 'bg-[#C5A059]' : 'bg-gray-300'}`}>
                                      {u.name.charAt(0)}
                                   </div>
                                   <div>
                                      <h4 className="text-sm font-bold text-black uppercase">{u.name}</h4>
                                      <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">{u.role}</p>
                                   </div>
                                </div>
                                
                                {metrics && (
                                   <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                      <div className="text-center">
                                         <p className="text-[7px] font-black text-black/30 uppercase tracking-widest">Rating</p>
                                         <p className="text-lg font-bold text-black">{metrics.score}</p>
                                      </div>
                                      <div className="text-center border-l border-gray-200">
                                         <p className="text-[7px] font-black text-black/30 uppercase tracking-widest">Jobs</p>
                                         <p className="text-lg font-bold text-black">{metrics.total}</p>
                                      </div>
                                      <div className="text-center border-l border-gray-200">
                                         <p className="text-[7px] font-black text-black/30 uppercase tracking-widest">Hours</p>
                                         <p className="text-lg font-bold text-black">{metrics.totalHours}</p>
                                      </div>
                                   </div>
                                )}
                                
                                <button onClick={() => setSelectedUser(u)} className="w-full bg-black text-[#C5A059] py-3 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">
                                   View Profile
                                </button>
                             </div>
                          );
                       })}
                    </div>
                 </section>
              ))}
           </div>
        </div>
      )}

      {/* --- INCIDENTS TAB --- */}
      {activeTab === 'incidents' && (
         <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="relative flex-1">
                    <input type="text" placeholder="SEARCH INCIDENTS..." className={`${inputStyle} w-full pl-12 h-11`} value={incidentSearch} onChange={(e) => setIncidentSearch(e.target.value)} />
                    <div className="absolute left-4 top-3.5 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                </div>
            </div>
            
            <div className="space-y-4">
               {filteredIncidents.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">Log Clear.</div>
               ) : (
                  <>
                    {filteredIncidents.map((inc, i) => (
                        <div key={`${inc.shiftId}-${i}`} className={`p-6 rounded-[32px] border flex flex-col md:flex-row items-center justify-between gap-6 shadow-md transition-all ${inc.resolved ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-red-100 hover:border-red-300'}`}>
                            <div className="flex items-center gap-6 w-full md:w-auto">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg shadow-lg ${inc.type === 'Maintenance' ? 'bg-blue-500' : inc.type === 'Damage' ? 'bg-orange-500' : 'bg-purple-500'}`}>{inc.type.charAt(0)}</div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-black uppercase tracking-tight">{inc.propertyName}</h4>
                                <p className="text-[9px] text-black/40 font-black uppercase tracking-widest">{inc.date} • {inc.type}</p>
                                <p className="text-[10px] text-black/80 italic line-clamp-1">"{inc.description}"</p>
                            </div>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                            <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${inc.resolved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}>{inc.resolved ? 'RESOLVED' : 'OPEN TICKET'}</span>
                            {inc.photos.length > 0 && (
                                <button onClick={() => setZoomedImage(inc.photos[0])} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-black/40 hover:bg-gray-200 hover:text-black transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M20.4 14.5L16 10 4 20"/></svg></button>
                            )}
                            </div>
                        </div>
                    ))}
                  </>
               )}
            </div>
         </div>
      )}

      {selectedAuditShift && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedAuditShift(null)}>
           <div className="bg-[#FDF8EE] border border-[#C5A059]/40 rounded-[40px] w-full max-w-4xl p-8 md:p-10 space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedAuditShift(null)} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-1">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">{selectedAuditShift.propertyName}</h2>
                 <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Historical Record • {selectedAuditShift.date}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                       <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em]">Visual Evidence</p>
                       <div className="grid grid-cols-3 gap-2">
                          {[
                             ...(selectedAuditShift.tasks?.flatMap(t => t.photos) || []), 
                             ...(selectedAuditShift.checkoutPhotos?.keyInBox || []),
                             ...(selectedAuditShift.checkoutPhotos?.boxClosed || [])
                          ].map((p, i) => (
                             <img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" />
                          ))}
                          {[
                             ...(selectedAuditShift.tasks?.flatMap(t => t.photos) || []), 
                             ...(selectedAuditShift.checkoutPhotos?.keyInBox || []),
                             ...(selectedAuditShift.checkoutPhotos?.boxClosed || [])
                          ].length === 0 && (
                             <p className="col-span-3 text-[9px] italic text-center py-4 opacity-30">No photos.</p>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                       <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em] mb-4">Audit Metadata</p>
                       <div className="space-y-3">
                          <div>
                             <p className="text-[8px] font-bold text-[#8B6B2E] uppercase">Decided By</p>
                             <p className="text-sm font-bold text-black uppercase">{selectedAuditShift.decidedBy || 'System'}</p>
                          </div>
                          <div>
                             <p className="text-[8px] font-bold text-[#8B6B2E] uppercase">Comment</p>
                             <p className="text-xs font-medium text-black/80 italic">"{selectedAuditShift.approvalComment || 'No comments'}"</p>
                          </div>
                          <div>
                             <p className="text-[8px] font-bold text-[#8B6B2E] uppercase">Status</p>
                             <p className={`text-xs font-black uppercase ${selectedAuditShift.approvalStatus === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{selectedAuditShift.approvalStatus}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95" onClick={() => setSelectedUser(null)}>
           <div className="bg-white rounded-[40px] w-full max-w-lg p-10 space-y-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                 <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white shadow-xl mb-4 ${selectedUser.status === 'active' ? 'bg-[#C5A059]' : 'bg-gray-400'}`}>
                    {selectedUser.name.charAt(0)}
                 </div>
                 <h2 className="text-2xl font-serif-brand font-bold text-black uppercase">{selectedUser.name}</h2>
                 <p className="text-[9px] font-black text-black/30 uppercase tracking-widest">{selectedUser.role} • {selectedUser.email}</p>
              </div>
              
              <div className="space-y-4">
                 <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Leave History</p>
                 <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                    {getUserLeaveHistory(selectedUser.id).length === 0 ? (
                       <p className="text-[10px] text-black/20 italic text-center">No leave records.</p>
                    ) : (
                       getUserLeaveHistory(selectedUser.id).map(l => (
                          <div key={l.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                             <div>
                                <p className="text-[9px] font-bold uppercase text-black">{l.type}</p>
                                <p className="text-[8px] text-black/40 uppercase">{l.startDate} - {l.endDate}</p>
                             </div>
                             <span className={`text-[7px] font-black uppercase px-2 py-1 rounded ${l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{l.status}</span>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              <div className="space-y-4">
                 <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Attendance Gaps (Replacements)</p>
                 <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                    {calculateAttendanceGaps(selectedUser.id).length === 0 ? (
                       <p className="text-[10px] text-black/20 italic text-center">Perfect attendance record.</p>
                    ) : (
                       calculateAttendanceGaps(selectedUser.id).map((gap, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                             <p className="text-[9px] font-bold uppercase text-red-700">{gap.date}</p>
                             <p className="text-[8px] text-red-500 uppercase font-black">Covered by: {gap.replacedBy}</p>
                          </div>
                       ))
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" alt="Preview" /></div>}
    </div>
  );
};

export default ReportsPortal;
