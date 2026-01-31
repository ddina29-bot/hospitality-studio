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

type ReportTab = 'audit' | 'activity' | 'employees' | 'incidents';
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
  const [activeTab, setActiveTab] = useState<ReportTab>('incidents'); // Default to incidents for better visibility
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Sorting & Grouping State
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  const isHousekeeping = userRole === 'housekeeping';

  // --- PDF GENERATOR ENGINE ---
  const handleGeneratePDF = (shift: Shift) => {
    const cleanerNames = shift.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(', ');
    const inspectorName = shift.decidedBy || 'System/Admin';
    const date = shift.date;
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
        <div class="border-b-4 border-[#C5A059] pb-6 mb-8 flex justify-between items-end">
           <div>
              <p class="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.4em] mb-2">RESET HOSPITALITY STUDIO</p>
              <h1 class="text-3xl brand-font font-bold uppercase tracking-tight">${shift.propertyName}</h1>
              <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">${date} • ${shift.serviceType}</p>
           </div>
           <div class="text-right">
              <span class="bg-[#C5A059] text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">
                ${shift.approvalStatus === 'approved' ? 'VERIFIED' : shift.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
              </span>
           </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
           <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Staff</p>
              <p class="text-sm font-bold uppercase">${cleanerNames}</p>
           </div>
           <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Signed Off By</p>
              <p class="text-sm font-bold uppercase">${inspectorName}</p>
           </div>
        </div>

        ${shift.approvalComment ? `
        <div class="mb-10">
           <h3 class="text-sm font-black uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Notes</h3>
           <p class="text-sm italic text-gray-600 bg-[#FDF8EE] p-6 rounded-2xl border border-[#D4B476]/30">"${shift.approvalComment}"</p>
        </div>` : ''}

        <div class="mb-10">
           <h3 class="text-sm font-black uppercase tracking-widest border-b border-gray-100 pb-2 mb-6">Visual Evidence</h3>
           <div class="grid grid-cols-3 gap-4">
              ${allPhotos.length > 0 ? allPhotos.map(p => `
                <div class="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                   <img src="${p.url}" class="w-full h-full object-cover" />
                </div>
              `).join('') : '<p class="text-xs text-gray-400 italic col-span-3">No photos attached to this report.</p>'}
           </div>
        </div>

        <div class="text-center pt-10 border-t border-gray-100">
           <p class="text-[8px] font-black text-gray-300 uppercase tracking-[0.5em]">Generated via Studio Intelligence</p>
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

  const handleExportCSV = () => {
    if (activeTab !== 'incidents') return;
    
    const headers = ['Date', 'Property', 'Type', 'Status', 'Description', 'Assigned To'];
    const rows = filteredIncidents.map(inc => [
      inc.date,
      inc.propertyName,
      inc.type,
      inc.resolved ? 'Resolved' : 'Open',
      `"${inc.description.replace(/"/g, '""')}"`, // Escape quotes
      users.find(u => u.id === inc.assignedTo)?.name || 'Unassigned'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Incidents_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // --- AUDIT HISTORY ---
  const auditHistory = useMemo(() => {
    return shifts.filter(s => s.status === 'completed' && (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected'))
      .filter(s => !auditSearch || s.propertyName?.toLowerCase().includes(auditSearch.toLowerCase()))
      .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }, [shifts, auditSearch]);

  const auditMonthGroups = useMemo(() => groupShiftsByMonthDay(auditHistory), [auditHistory]);

  const auditStats = useMemo(() => {
    const total = auditHistory.length;
    const passed = auditHistory.filter(s => s.approvalStatus === 'approved').length;
    const failed = total - passed;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 100;
    return { total, passed, failed, rate };
  }, [auditHistory]);

  // --- CLEANER ACTIVITY HISTORY ---
  const activityHistory = useMemo(() => {
    return shifts.filter(s => s.status === 'completed' && s.serviceType !== 'TO CHECK APARTMENT') 
      .filter(s => !activitySearch || s.propertyName?.toLowerCase().includes(activitySearch.toLowerCase()) || s.userIds.some(uid => users.find(u => u.id === uid)?.name.toLowerCase().includes(activitySearch.toLowerCase())))
      .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }, [shifts, activitySearch, users]);

  const activityMonthGroups = useMemo(() => groupShiftsByMonthDay(activityHistory), [activityHistory]);

  // --- INCIDENTS & PERSONNEL ---
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
      
      // Sorting Logic
      list = list.sort((a, b) => {
         if (sortOrder === 'newest') return b.timestamp - a.timestamp;
         if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
         if (sortOrder === 'type') return a.type.localeCompare(b.type);
         return 0;
      });

      return list;
  }, [incidentReports, incidentSearch, sortOrder]);

  const groupedIncidents = useMemo(() => {
     if (groupMode === 'none') return null;
     
     const groups: Record<string, typeof filteredIncidents> = {};
     filteredIncidents.forEach(inc => {
        const key = groupMode === 'property' ? inc.propertyName : 'All';
        if (!groups[key]) groups[key] = [];
        groups[key].push(inc);
     });
     return groups;
  }, [filteredIncidents, groupMode]);

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
    // HIDE METRICS FOR NON-CLEANING ROLES
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

  const getUserLeaveHistory = (userId: string) => {
    return leaveRequests.filter(l => l.userId === userId).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  };

  const calculateAttendanceGaps = (userId: string) => {
    const gaps: { date: string, type: string, replacedBy?: string }[] = [];
    shifts.forEach(s => {
      if (s.userIds.includes(userId) && s.replacedUserId) {
        gaps.push({ date: s.date, type: "REPLACED", replacedBy: users.find(u => u.id === s.replacedUserId)?.name || "ADMIN" });
      }
    });
    return gaps;
  };

  const subLabelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1 opacity-60 block px-1";
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
              { id: 'incidents', label: 'Incidents' },
              { id: 'audit', label: 'Quality Audits' },
              { id: 'activity', label: 'Cleaner Logs' },
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

      {/* --- INCIDENTS TAB (Enhanced) --- */}
      {activeTab === 'incidents' && (
         <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="relative flex-1">
                    <input type="text" placeholder="SEARCH INCIDENTS..." className={`${inputStyle} w-full pl-12 h-11`} value={incidentSearch} onChange={(e) => setIncidentSearch(e.target.value)} />
                    <div className="absolute left-4 top-3.5 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                </div>
                
                <div className="flex gap-2">
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="bg-white border border-gray-200 rounded-xl px-4 text-[9px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] h-11"
                    >
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                        <option value="type">Sort: By Type</option>
                    </select>

                    <button 
                        onClick={() => setGroupMode(groupMode === 'none' ? 'property' : 'none')}
                        className={`px-6 h-11 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${groupMode === 'property' ? 'bg-[#C5A059] text-black border-[#C5A059]' : 'bg-white text-black/40 border-gray-200 hover:text-black'}`}
                    >
                        {groupMode === 'property' ? 'Grouped by Unit' : 'Flat List'}
                    </button>

                    <button 
                        onClick={handleExportCSV}
                        className="bg-black text-[#C5A059] h-11 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="space-y-4">
               {filteredIncidents.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">Log Clear.</div>
               ) : (
                  <>
                    {groupMode === 'none' ? (
                        filteredIncidents.map((inc, i) => (
                            <div key={`${inc.id}-${i}`} className={`p-6 rounded-[32px] border flex flex-col md:flex-row items-center justify-between gap-6 shadow-md transition-all ${inc.resolved ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-red-100 hover:border-red-300'}`}>
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
                        ))
                    ) : (
                        Object.entries(groupedIncidents || {}).map(([propName, items]: [string, any[]]) => (
                            <div key={propName} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-black text-black/80 uppercase tracking-widest bg-gray-100 px-4 py-2 rounded-xl">{propName}</h3>
                                    <div className="h-px flex-1 bg-gray-200"></div>
                                </div>
                                {items.map((inc, i) => (
                                    <div key={`${inc.id}-${i}`} className={`p-5 rounded-[24px] border flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm ml-4 ${inc.resolved ? 'bg-gray-50 border-gray-100' : 'bg-white border-red-50'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${inc.type === 'Maintenance' ? 'bg-blue-500' : inc.type === 'Damage' ? 'bg-orange-500' : 'bg-purple-500'}`}>{inc.type.charAt(0)}</div>
                                            <div>
                                                <p className="text-[9px] font-black text-black uppercase">{inc.date} • {inc.type}</p>
                                                <p className="text-[10px] text-black/60 italic">"{inc.description}"</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded text-[7px] font-black uppercase tracking-widest ${inc.resolved ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{inc.resolved ? 'RESOLVED' : 'OPEN'}</span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                  </>
               )}
            </div>
         </div>
      )}

      {/* --- AUDIT TAB --- */}
      {activeTab === 'audit' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           {/* Audit Stats Header */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1A1A1A] p-6 rounded-[32px] text-white">
                 <p className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40">Total Audits</p>
                 <p className="text-3xl font-serif-brand font-bold mt-2">{auditStats.total}</p>
              </div>
              <div className="bg-white border border-green-200 p-6 rounded-[32px]">
                 <p className="text-[8px] font-black text-green-600 uppercase tracking-[0.4em]">Approved</p>
                 <p className="text-3xl font-serif-brand font-bold text-black mt-2">{auditStats.passed}</p>
              </div>
              <div className="bg-white border border-red-200 p-6 rounded-[32px]">
                 <p className="text-[8px] font-black text-red-600 uppercase tracking-[0.4em]">Issues Found</p>
                 <p className="text-3xl font-serif-brand font-bold text-black mt-2">{auditStats.failed}</p>
              </div>
              <div className="bg-[#C5A059] p-6 rounded-[32px] text-black">
                 <p className="text-[8px] font-black uppercase tracking-[0.4em] opacity-60">Success Rate</p>
                 <p className="text-3xl font-serif-brand font-bold mt-2">{auditStats.rate}%</p>
              </div>
           </div>

           <div className="relative w-full">
              <input type="text" placeholder="SEARCH AUDITS..." className={`${inputStyle} w-full pl-12`} value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
              <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-16">
              {auditMonthGroups.length === 0 ? (
                 <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No audit records found.</div>
              ) : (
                 auditMonthGroups.map((monthGroup, mIdx) => (
                    <div key={mIdx} className="space-y-8">
                       <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">{monthGroup.monthLabel}</h2>
                          <div className="h-px flex-1 bg-black/5 mx-6"></div>
                       </div>
                       <div className="space-y-12 pl-4 md:pl-8 border-l-2 border-black/5">
                          {monthGroup.days.map((dayGroup, dIdx) => (
                             <div key={dIdx} className="space-y-4">
                                <div className="flex items-center gap-3">
                                   <div className="bg-[#FDF8EE] border border-[#D4B476]/30 text-[#8B6B2E] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">{dayGroup.date}</div>
                                   <div className="h-px w-12 bg-black/5"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                   {dayGroup.shifts.map(shift => {
                                      const isApproved = shift.approvalStatus === 'approved';
                                      return (
                                         <div key={shift.id} className={`p-6 rounded-[32px] border shadow-xl flex flex-col justify-between gap-6 relative overflow-hidden transition-all group hover:scale-[1.02] ${isApproved ? 'bg-white border-green-500/20' : 'bg-red-50/50 border-red-200'}`}>
                                            <div className={`absolute top-0 left-0 w-1.5 h-full ${isApproved ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div className="space-y-4 pl-2">
                                               <div>
                                                  <h4 className="text-sm font-bold text-black uppercase tracking-tight">{shift.propertyName}</h4>
                                                  <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest mt-1">{shift.serviceType}</p>
                                               </div>
                                               {shift.approvalComment && <p className={`text-[10px] italic leading-relaxed line-clamp-2 ${isApproved ? 'text-black/60' : 'text-red-600 font-medium'}`}>"{shift.approvalComment}"</p>}
                                            </div>
                                            <div className="pl-2 flex gap-3">
                                               <button onClick={() => handleGeneratePDF(shift)} className="flex-1 bg-black text-[#C5A059] py-3 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">PDF Report</button>
                                               <button onClick={() => setSelectedAuditShift(shift)} className="flex-1 bg-white border border-gray-200 text-black/60 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest hover:text-black hover:border-[#C5A059]">Details</button>
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

      {/* --- ACTIVITY LOGS (Cleaner Reports) --- */}
      {activeTab === 'activity' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           <div className="relative w-full">
              <input type="text" placeholder="SEARCH COMPLETED JOBS..." className={`${inputStyle} w-full pl-12`} value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} />
              <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-16">
              {activityMonthGroups.length === 0 ? (
                 <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No activity logs found.</div>
              ) : (
                 activityMonthGroups.map((monthGroup, mIdx) => (
                    <div key={mIdx} className="space-y-8">
                       <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">{monthGroup.monthLabel}</h2>
                          <div className="h-px flex-1 bg-black/5 mx-6"></div>
                       </div>
                       <div className="space-y-12 pl-4 md:pl-8 border-l-2 border-black/5">
                          {monthGroup.days.map((dayGroup, dIdx) => (
                             <div key={dIdx} className="space-y-4">
                                <div className="flex items-center gap-3">
                                   <div className="bg-white border border-gray-200 text-black/60 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">{dayGroup.date}</div>
                                   <div className="h-px w-12 bg-black/5"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                   {dayGroup.shifts.map(shift => {
                                      const cleanerNames = shift.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0] || 'Unknown').join(', ');
                                      return (
                                         <div key={shift.id} className="p-6 rounded-[32px] border border-gray-100 bg-white shadow-lg flex flex-col justify-between gap-6 hover:border-[#C5A059]/30 transition-all group">
                                            <div className="space-y-2">
                                               <div className="flex justify-between items-start">
                                                  <h4 className="text-sm font-bold text-black uppercase tracking-tight">{shift.propertyName}</h4>
                                                  <span className="text-[7px] bg-gray-100 text-black/60 px-2 py-1 rounded font-black uppercase">{shift.status}</span>
                                               </div>
                                               <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">{shift.serviceType}</p>
                                               <p className="text-[9px] font-black text-black/40 uppercase tracking-widest mt-2">Done by: {cleanerNames}</p>
                                            </div>
                                            <button onClick={() => handleGeneratePDF(shift)} className="w-full bg-[#FDF8EE] text-[#8B6B2E] py-3 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm hover:bg-[#C5A059] hover:text-black transition-all border border-[#C5A059]/10">Download Report</button>
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
      
      {/* --- EMPLOYEES TAB --- */}
      {activeTab === 'employees' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
          <div className="relative w-full md:w-96">
            <input type="text" placeholder="Search employees..." className={`${inputStyle} w-full pl-12`} value={personnelSearch} onChange={(e) => setPersonnelSearch(e.target.value)} />
            <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          </div>
          {personnelGroups.length === 0 ? (
             <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No records found.</div>
          ) : (
            personnelGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-4">
                 <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-black text-black/30 uppercase tracking-[0.4em] whitespace-nowrap">{group.title}</h3>
                    <div className="h-px flex-1 bg-black/5"></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.members.map(u => {
                      const metrics = calculateUserMetrics(u.id);
                      const leaveHistory = getUserLeaveHistory(u.id);
                      return (
                        <div key={u.id} className="bg-[#FDF8EE] p-6 rounded-[32px] border border-[#D4B476]/30 flex flex-col gap-6 shadow-xl group hover:border-[#C5A059]/40 transition-all h-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-white border border-[#D4B476]/20 flex items-center justify-center font-bold text-[#8B6B2E]">{u.name.charAt(0)}</div>
                               <div>
                                  <h4 className="text-sm font-bold text-black uppercase">{u.name}</h4>
                                  <p className="text-[8px] text-[#8B6B2E] font-black uppercase">{u.role}</p>
                               </div>
                            </div>
                          </div>
                          {metrics ? (
                            <div className="flex justify-between border-t border-black/5 pt-4">
                              <div><span className={subLabelStyle}>Rating</span><p className="text-lg font-serif-brand font-bold text-[#8B6B2E]">{metrics.score}</p></div>
                              <div className="text-right"><span className={subLabelStyle}>Verified</span><p className="text-lg font-bold text-black">{metrics.approved}</p></div>
                              <div className="text-right"><span className={subLabelStyle}>Hours</span><p className="text-lg font-bold text-black">{metrics.totalHours}</p></div>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-[9px] text-black/20 italic font-medium">Metrics not applicable</div>
                          )}
                          <div className="bg-white/40 p-4 rounded-xl border border-[#D4B476]/10 space-y-3 flex-1">
                            <p className={subLabelStyle}>Recent Leave Status</p>
                            {leaveHistory.length === 0 ? <p className="text-[8px] text-black/20 uppercase italic">No leave requests logged</p> : (
                              <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                                  {leaveHistory.slice(0, 3).map((l, i) => (
                                    <div key={i} className="flex justify-between text-[8px] font-black uppercase">
                                      <span className="text-black/60">{l.type}</span>
                                      <span className={l.status === 'approved' ? 'text-green-600' : l.status === 'rejected' ? 'text-red-600' : 'text-orange-400'}>{l.status}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                          {!isHousekeeping && (
                            <button onClick={() => setSelectedUser(u)} className="w-full bg-white/60 border border-gray-200 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-white hover:border-[#C5A059] transition-all">Full Dossier</button>
                          )}
                        </div>
                      );
                    })}
                 </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- AUDIT DETAIL MODAL (Already exists) --- */}
      {selectedAuditShift && (
         <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95" onClick={() => setSelectedAuditShift(null)}>
            <div className="bg-[#FDF8EE] border border-[#C5A059]/40 rounded-[48px] w-full max-w-4xl p-8 md:p-12 space-y-8 shadow-2xl relative text-left overflow-y-auto max-h-[95vh] custom-scrollbar" onClick={e => e.stopPropagation()}>
               <button onClick={() => setSelectedAuditShift(null)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               <header className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{selectedAuditShift.propertyName}</h2>
                  <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">{selectedAuditShift.date} • {selectedAuditShift.serviceType}</p>
               </header>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em]">Evidence</p>
                        <div className="grid grid-cols-3 gap-2">
                           {(selectedAuditShift.tasks?.flatMap(t => t.photos) || []).map((p, i) => (<img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" />))}
                           {selectedAuditShift.checkoutPhotos?.keyInBox?.map((p, i) => (<img key={`k-${i}`} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" />))}
                           {selectedAuditShift.checkoutPhotos?.boxClosed?.map((p, i) => (<img key={`b-${i}`} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" />))}
                        </div>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="bg-[#1A1A1A] p-6 rounded-3xl text-white space-y-4">
                        <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.4em]">Verdict</p>
                        <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${selectedAuditShift.approvalStatus === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                           <h3 className="text-lg font-bold uppercase">{selectedAuditShift.approvalStatus === 'approved' ? 'Passed' : selectedAuditShift.status}</h3>
                        </div>
                        <p className="text-[10px] italic opacity-80 leading-relaxed">"{selectedAuditShift.approvalComment || 'No comment provided'}"</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-[#C5A059] pt-2">By: {selectedAuditShift.decidedBy || 'System'}</p>
                     </div>
                     <button onClick={() => handleGeneratePDF(selectedAuditShift)} className="w-full bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-[#d4b476] active:scale-95 transition-all flex items-center justify-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> DOWNLOAD REPORT
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Selected User Modal & Zoomed Image Modal remain as before */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] w-full max-w-2xl p-10 relative shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedUser(null)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
             <h2 className="text-3xl font-serif-brand font-bold text-black uppercase">{selectedUser.name}</h2>
             <div className="mt-2 text-[10px] font-black text-[#8B6B2E] uppercase tracking-widest">{selectedUser.role} • {selectedUser.employmentType || 'Standard Contract'}</div>
             <div className="mt-10 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4"><h3 className="text-[10px] font-black text-black/30 uppercase tracking-[0.4em]">Service Interruptions</h3><div className="h-px flex-1 bg-black/5"></div></div>
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                       {calculateAttendanceGaps(selectedUser.id).map((gap, i) => (
                         <div key={i} className="p-4 bg-white/60 rounded-2xl border border-[#D4B476]/10 flex justify-between items-center shadow-sm">
                            <div><p className="text-xs font-bold text-black uppercase">{gap.date}</p><p className="text-[8px] text-[#8B6B2E] font-black uppercase mt-1">Status: {gap.type}</p></div>
                            {gap.replacedBy && <p className="text-[8px] text-black/40 font-black uppercase">By: {gap.replacedBy}</p>}
                         </div>
                       ))}
                       {calculateAttendanceGaps(selectedUser.id).length === 0 && <p className="text-center py-4 opacity-20 italic text-[10px] uppercase">No service gaps.</p>}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-4"><h3 className="text-[10px] font-black text-black/30 uppercase tracking-[0.4em]">Leave Request Log</h3><div className="h-px flex-1 bg-black/5"></div></div>
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                       {getUserLeaveHistory(selectedUser.id).map((req, i) => (
                         <div key={req.id} className="p-4 bg-white rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                            <div><p className="text-[10px] font-bold text-black uppercase">{req.type}</p><p className="text-[8px] text-black/40 font-black uppercase mt-0.5">{req.startDate} — {req.endDate}</p></div>
                            <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg border ${req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{req.status}</span>
                         </div>
                       ))}
                       {getUserLeaveHistory(selectedUser.id).length === 0 && <p className="text-center py-4 opacity-20 italic text-[10px] uppercase">No leave history.</p>}
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[600] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" alt="Preview" /></div>}
    </div>
  );
};

export default ReportsPortal;