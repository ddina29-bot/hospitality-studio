
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

type ReportTab = 'audit' | 'employees' | 'logistics' | 'incidents';

const ReportsPortal: React.FC<ReportsPortalProps> = ({ 
  auditReports = [], 
  users = [], 
  supplyRequests = [], 
  shifts = [],
  leaveRequests = [],
  userRole 
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('audit');
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [logisticsSearch, setLogisticsSearch] = useState('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isHousekeeping = userRole === 'housekeeping';

  // Helper to calculate timing info
  const getShiftTimingInfo = (shift: Shift) => {
    const start = shift.actualStartTime ? new Date(shift.actualStartTime) : null;
    const end = shift.actualEndTime ? new Date(shift.actualEndTime) : null;
    
    let isLate = false;
    let lateDiff = 0;

    if (start && shift.startTime) {
        const [timePart, modifier] = shift.startTime.split(' ');
        if (timePart && modifier) {
            let [h, m] = timePart.split(':').map(Number);
            if (h === 12 && modifier === 'AM') h = 0;
            if (h !== 12 && modifier === 'PM') h += 12;
            
            const scheduledMins = h * 60 + m;
            const actualMins = start.getHours() * 60 + start.getMinutes();
            
            // 5 minute grace period
            if (actualMins > scheduledMins + 5) {
                isLate = true;
                lateDiff = actualMins - scheduledMins;
            }
        }
    }

    const startStr = start ? start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
    const endStr = end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';

    return { startStr, endStr, isLate, lateDiff };
  };

  // --- AUDIT LOGIC ---
  const auditHistory = useMemo(() => {
    return shifts
      .filter(s => s.status === 'completed' && (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected'))
      .filter(s => !auditSearch || s.propertyName?.toLowerCase().includes(auditSearch.toLowerCase()) || s.decidedBy?.toLowerCase().includes(auditSearch.toLowerCase()))
      .sort((a, b) => {
         const timeA = a.actualEndTime || 0;
         const timeB = b.actualEndTime || 0;
         return timeB - timeA;
      });
  }, [shifts, auditSearch]);

  const auditStats = useMemo(() => {
    const total = auditHistory.length;
    const passed = auditHistory.filter(s => s.approvalStatus === 'approved').length;
    const failed = total - passed;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 100;
    return { total, passed, failed, rate };
  }, [auditHistory]);

  // Group Audits by Date
  const groupedAuditHistory = useMemo(() => {
    const groups: { date: string; items: Shift[]; dailyStats: { total: number; passed: number; rate: number } }[] = [];
    
    auditHistory.forEach(audit => {
        const existingGroup = groups.find(g => g.date === audit.date);
        if (existingGroup) {
            existingGroup.items.push(audit);
        } else {
            groups.push({ date: audit.date, items: [audit], dailyStats: { total: 0, passed: 0, rate: 0 } });
        }
    });

    // Calculate stats per day
    groups.forEach(g => {
        g.dailyStats.total = g.items.length;
        g.dailyStats.passed = g.items.filter(i => i.approvalStatus === 'approved').length;
        g.dailyStats.rate = g.dailyStats.total > 0 ? Math.round((g.dailyStats.passed / g.dailyStats.total) * 100) : 0;
    });

    return groups;
  }, [auditHistory]);

  // --- INCIDENT LOGIC ---
  const incidentReports = useMemo(() => {
    const all: { 
        id: string; 
        type: 'Maintenance' | 'Damage' | 'Missing Item'; 
        date: string; 
        propertyName: string; 
        description: string; 
        status: string; 
        photos: string[]; 
        cost?: number;
        resolved: boolean;
        timestamp: number;
        assignedTo?: string;
    }[] = [];

    shifts.forEach(s => {
       const date = s.date;
       const prop = s.propertyName || 'Unknown';
       
       s.maintenanceReports?.forEach(r => {
           all.push({
               id: r.id,
               type: 'Maintenance',
               date,
               propertyName: prop,
               description: r.description,
               status: r.status || 'open',
               photos: r.photos || [],
               cost: r.cost,
               resolved: r.status === 'resolved',
               timestamp: r.timestamp,
               assignedTo: r.assignedToName
           });
       });

       s.damageReports?.forEach(r => {
           all.push({
               id: r.id,
               type: 'Damage',
               date,
               propertyName: prop,
               description: r.description,
               status: r.status || 'open',
               photos: r.photos || [],
               cost: r.cost,
               resolved: r.status === 'resolved',
               timestamp: r.timestamp,
               assignedTo: r.assignedToName
           });
       });

       s.missingReports?.forEach(r => {
           all.push({
               id: r.id,
               type: 'Missing Item',
               date,
               propertyName: prop,
               description: r.description,
               status: r.status || 'open',
               photos: r.photos || [],
               cost: r.cost,
               resolved: r.status === 'resolved',
               timestamp: r.timestamp,
               assignedTo: r.assignedToName
           });
       });
    });

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }, [shifts]);

  const filteredIncidents = useMemo(() => {
      if (!incidentSearch) return incidentReports;
      const q = incidentSearch.toLowerCase();
      return incidentReports.filter(i => 
          i.propertyName.toLowerCase().includes(q) || 
          i.description.toLowerCase().includes(q) || 
          i.type.toLowerCase().includes(q) ||
          i.status.toLowerCase().includes(q)
      );
  }, [incidentReports, incidentSearch]);

  // --- EMPLOYEE LOGIC ---
  const filteredPersonnel = useMemo(() => {
    if (!personnelSearch) return users;
    const s = personnelSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(s) || u.role.toLowerCase().includes(s));
  }, [users, personnelSearch]);

  // Group Personnel by Function
  const personnelGroups = useMemo(() => {
    return [
      {
        title: 'Cleaning & Supervision',
        members: filteredPersonnel.filter(u => ['cleaner', 'supervisor'].includes(u.role))
      },
      {
        title: 'Logistics & Technical',
        members: filteredPersonnel.filter(u => ['driver', 'maintenance', 'laundry', 'outsourced_maintenance'].includes(u.role))
      },
      {
        title: 'Management & Admin',
        members: filteredPersonnel.filter(u => ['admin', 'housekeeping', 'hr', 'finance', 'client'].includes(u.role))
      }
    ].filter(g => g.members.length > 0);
  }, [filteredPersonnel]);

  const calculateAttendanceGaps = (userId: string) => {
    const gaps: { date: string, type: string, replacedBy?: string }[] = [];
    
    const userLeaves = leaveRequests.filter(l => l.userId === userId && l.status === 'approved');
    userLeaves.forEach(l => {
      gaps.push({ 
        date: `${l.startDate} to ${l.endDate}`, 
        type: l.type.toUpperCase() 
      });
    });

    shifts.forEach(s => {
      if (s.userIds.includes(userId) && s.replacedUserId) {
        gaps.push({
          date: s.date,
          type: "REPLACED",
          replacedBy: users.find(u => u.id === s.replacedUserId)?.name || "ADMIN"
        });
      }
    });

    return gaps;
  };

  const calculateUserMetrics = (userId: string) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj || userObj.role === 'driver') return null;

    const userShifts = shifts.filter(s => 
      s.userIds?.includes(userId) && 
      s.serviceType !== 'FIX WORK' && 
      s.status === 'completed' &&
      (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected')
    );

    const approved = userShifts.filter(s => s.approvalStatus === 'approved').length;
    const rejected = userShifts.filter(s => s.approvalStatus === 'rejected').length;
    const total = approved + rejected;

    let totalHours = 0;
    userShifts.forEach(s => {
       if (s.actualStartTime && s.actualEndTime) {
          totalHours += (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60);
       }
    });

    let score = 5.0;
    if (total > 0) score = 1 + (approved / total) * 4;

    return { approved, rejected, score: parseFloat(score.toFixed(1)), total, totalHours: totalHours.toFixed(1) };
  };

  // --- LOGISTICS LOGIC ---
  const logisticsReports = useMemo(() => {
    const groups: Record<string, { driver: User, date: string, tasks: Shift[] }> = {};
    const query = logisticsSearch.toLowerCase();

    shifts.forEach(s => {
      const driverId = s.userIds.find(uid => users.find(u => u.id === uid)?.role === 'driver');
      if (!driverId || (!s.actualStartTime && s.status !== 'completed')) return;
      
      const driver = users.find(u => u.id === driverId);
      if (!driver) return;

      const matches = !query || s.propertyName?.toLowerCase().includes(query) || s.date.toLowerCase().includes(query) || driver.name.toLowerCase().includes(query);
      if (!matches) return;

      const key = `${driverId}_${s.date}`;
      if (!groups[key]) groups[key] = { driver, date: s.date, tasks: [] };
      groups[key].tasks.push(s);
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [shifts, users, logisticsSearch]);

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
          <div className="flex gap-2">
            {[
              { id: 'audit', label: 'Quality Audit' },
              { id: 'employees', label: 'Personnel' },
              { id: 'logistics', label: 'Logistics' },
              { id: 'incidents', label: 'Incident Logs' }
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

      {/* --- INCIDENT LOGS TAB --- */}
      {activeTab === 'incidents' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="relative w-full md:w-96">
             <input type="text" placeholder="Search Incidents (Property, Type, Status)..." className={`${inputStyle} w-full pl-12`} value={incidentSearch} onChange={(e) => setIncidentSearch(e.target.value)} />
             <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIncidents.length === 0 ? (
                 <div className="col-span-full py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No incidents recorded.</div>
              ) : (
                filteredIncidents.map((incident) => (
                  <div key={incident.id} className="bg-[#FDF8EE] p-6 rounded-[32px] border border-[#D4B476]/30 flex flex-col gap-6 hover:border-[#C5A059]/40 transition-all shadow-xl h-full relative overflow-hidden">
                     {/* Status Badge */}
                     <div className="absolute top-0 right-0 px-6 py-2 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest border-b border-l border-white/50 shadow-sm"
                        style={{
                            backgroundColor: incident.resolved ? '#dcfce7' : '#fff7ed',
                            color: incident.resolved ? '#15803d' : '#ea580c',
                            borderColor: incident.resolved ? '#bbf7d0' : '#fed7aa'
                        }}
                     >
                        {incident.resolved ? 'SORTED / CLOSED' : 'OPEN / PENDING'}
                     </div>

                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg shrink-0 ${
                            incident.type === 'Maintenance' ? 'bg-blue-500' : incident.type === 'Damage' ? 'bg-orange-500' : 'bg-purple-500'
                        }`}>
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                               {incident.type === 'Maintenance' && <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
                               {incident.type === 'Damage' && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
                               {incident.type === 'Missing Item' && <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                           </svg>
                        </div>
                        <div className="min-w-0">
                           <p className="text-[7px] font-black uppercase tracking-[0.2em] text-black/40 mb-0.5">{incident.type}</p>
                           <h4 className="text-sm font-bold text-black uppercase truncate">{incident.propertyName}</h4>
                           <p className="text-[9px] font-black text-[#8B6B2E] uppercase tracking-widest mt-1">Reported: {incident.date}</p>
                        </div>
                     </div>

                     <div className="bg-white/60 p-4 rounded-2xl border border-[#D4B476]/10 flex-1">
                        <p className="text-[10px] text-black/80 font-medium italic leading-relaxed">"{incident.description}"</p>
                        {incident.assignedTo && (
                            <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
                                <span className="text-[8px] font-black text-black/30 uppercase tracking-widest">Actioned By</span>
                                <span className="text-[9px] font-bold text-black uppercase">{incident.assignedTo}</span>
                            </div>
                        )}
                        {incident.resolved && incident.cost !== undefined && incident.cost > 0 && (
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-[8px] font-black text-black/30 uppercase tracking-widest">Resolution Cost</span>
                                <span className="text-[9px] font-bold text-black uppercase">€{incident.cost.toFixed(2)}</span>
                            </div>
                        )}
                     </div>

                     {incident.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {incident.photos.map((url, i) => (
                                <img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-zoom-in hover:scale-105 transition-all" alt="Evidence" />
                            ))}
                        </div>
                     )}
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* --- LOGISTICS TAB --- */}
      {activeTab === 'logistics' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="relative w-full md:w-96">
             <input type="text" placeholder="Search Property or Date..." className={`${inputStyle} w-full pl-12`} value={logisticsSearch} onChange={(e) => setLogisticsSearch(e.target.value)} />
             <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {logisticsReports.length === 0 ? (
                 <div className="col-span-full py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No driver logs found.</div>
              ) : (
                logisticsReports.map((rep, idx) => (
                  <div key={idx} className="bg-[#FDF8EE] p-6 rounded-[32px] border border-[#D4B476]/30 flex flex-col gap-6 hover:border-[#C5A059]/40 transition-all shadow-xl h-full">
                     <div className="flex items-center justify-between border-b border-[#D4B476]/10 pb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center font-bold text-black/40 border border-black/5">{rep.driver.name.charAt(0)}</div>
                           <div>
                              <h4 className="text-sm font-bold text-black uppercase">{rep.driver.name}</h4>
                              <p className="text-[8px] text-[#8B6B2E] font-black uppercase tracking-widest">Log: {rep.date}</p>
                           </div>
                        </div>
                        <span className="bg-white px-2 py-1 rounded text-[8px] font-black border border-[#D4B476]/20 shadow-sm text-[#8B6B2E]">{rep.tasks.length} Stops</span>
                     </div>
                     
                     <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                        {rep.tasks.map(t => (
                             <div key={t.id} className="bg-white p-3 rounded-xl border border-[#D4B476]/10 shadow-sm flex items-center justify-between">
                                 <span className="text-[9px] font-bold uppercase text-black/70 truncate pr-2 flex-1">{t.propertyName}</span>
                                 {t.isDelivered ? (
                                     <span className="text-[6px] font-black text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded border border-green-100">Complete</span>
                                 ) : (
                                     <span className="text-[6px] font-black text-orange-400 uppercase bg-orange-50 px-2 py-0.5 rounded border border-orange-100">En Route</span>
                                 )}
                             </div>
                        ))}
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* --- EMPLOYEES TAB (Grouped) --- */}
      {activeTab === 'employees' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
          <div className="relative w-full md:w-96">
            <input type="text" placeholder="Search employees by name..." className={`${inputStyle} w-full pl-12`} value={personnelSearch} onChange={(e) => setPersonnelSearch(e.target.value)} />
            <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          </div>

          {personnelGroups.length === 0 ? (
             <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black tracking-[0.4em]">No personnel records found.</div>
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
                      const attendanceGaps = calculateAttendanceGaps(u.id);
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
                            <div className="py-4 text-center text-[9px] text-black/20 italic font-medium">Metrics not applicable for role</div>
                          )}

                          <div className="bg-white/40 p-4 rounded-xl border border-[#D4B476]/10 space-y-3 flex-1">
                            <p className={subLabelStyle}>Service Gaps & Leave</p>
                            {attendanceGaps.length === 0 ? (
                              <p className="text-[8px] text-black/20 uppercase italic">Full Deployment Sync</p>
                            ) : (
                              <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                                  {attendanceGaps.map((gap, i) => (
                                    <div key={i} className="text-[8px] font-black uppercase">
                                      <span className="text-red-600/80">{gap.date} • {gap.type}</span>
                                      {gap.replacedBy && <p className="text-black/30 mt-0.5">Covered By: {gap.replacedBy}</p>}
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

      {/* --- AUDIT TAB --- */}
      {activeTab === 'audit' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           {/* Summary Stats */}
           <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 p-6 rounded-[28px] shadow-sm">
                 <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-1">Pass Rate</p>
                 <p className={`text-3xl font-serif-brand font-bold ${auditStats.rate >= 90 ? 'text-green-600' : auditStats.rate >= 75 ? 'text-orange-500' : 'text-red-600'}`}>{auditStats.rate}%</p>
              </div>
              <div className="bg-white border border-gray-200 p-6 rounded-[28px] shadow-sm">
                 <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-1">Approved</p>
                 <p className="text-3xl font-serif-brand font-bold text-green-600">{auditStats.passed}</p>
              </div>
              <div className="bg-white border border-gray-200 p-6 rounded-[28px] shadow-sm">
                 <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-1">Rejected</p>
                 <p className="text-3xl font-serif-brand font-bold text-red-600">{auditStats.failed}</p>
              </div>
           </div>

           <div className="relative w-full md:w-96">
             <input type="text" placeholder="Search Property, Auditor..." className={`${inputStyle} w-full pl-12`} value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
             <div className="absolute left-4 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {groupedAuditHistory.length === 0 ? (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase tracking-[0.4em]">
                  No audit reports recorded in the current cycle.
                </div>
              ) : (
                groupedAuditHistory.map((group, groupIdx) => (
                  <div key={groupIdx} className="bg-[#FDF8EE] border border-[#D4B476]/30 p-6 rounded-[32px] shadow-xl flex flex-col gap-4 hover:border-[#D4B476] transition-all h-full">
                     {/* Daily Header */}
                     <div className="flex justify-between items-end border-b border-[#D4B476]/10 pb-3">
                        <div className="space-y-1">
                           <h3 className="text-lg font-serif-brand font-bold text-black uppercase tracking-tight">{group.date}</h3>
                           <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.3em]">{group.dailyStats.total} Audits</p>
                        </div>
                        <div className="text-right">
                           <p className={`text-xl font-bold ${group.dailyStats.rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>{group.dailyStats.rate}%</p>
                           <p className="text-[6px] font-black text-black/30 uppercase tracking-widest">Pass Rate</p>
                        </div>
                     </div>

                     {/* List View of Audits for the Day (Vertical List) */}
                     <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 max-h-[400px] pr-1">
                        {group.items.map(audit => {
                           const staffNames = audit.userIds?.map(uid => users.find(u => u.id === uid)?.name.split(' ')[0]).filter(Boolean).join(', ') || 'Unknown';
                           const maintenanceCount = audit.maintenanceReports?.filter(r => r.status !== 'resolved').length || 0;
                           const damageCount = audit.damageReports?.filter(r => r.status !== 'resolved').length || 0;
                           const totalIssues = maintenanceCount + damageCount;
                           
                           const timing = getShiftTimingInfo(audit);

                           return (
                             <div 
                               key={audit.id} 
                               onClick={() => setSelectedAuditShift(audit)}
                               className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3 hover:border-[#C5A059] transition-all shadow-sm cursor-pointer group"
                             >
                                <div className="min-w-0 flex-1 pr-2">
                                   <div className="flex items-center gap-2 mb-1">
                                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${audit.approvalStatus === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                      <h4 className="text-[10px] font-bold text-black uppercase tracking-tight truncate">{audit.propertyName}</h4>
                                   </div>
                                   
                                   <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[8px] font-mono text-black/70 tracking-tighter">
                                         {timing.startStr} {'→'} {timing.endStr}
                                      </span>
                                      {timing.isLate && (
                                         <span className="text-[6px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wider">
                                            LATE (+{timing.lateDiff}m)
                                         </span>
                                      )}
                                   </div>

                                   <p className="text-[7px] text-black/40 uppercase tracking-widest truncate">
                                      {staffNames} • {audit.decidedBy || 'System'}
                                   </p>
                                </div>
                                
                                <div className="flex-shrink-0">
                                   {totalIssues > 0 ? (
                                      <span className="px-2 py-1 rounded bg-orange-50 text-orange-600 text-[6px] font-black uppercase border border-orange-100 whitespace-nowrap">
                                         {totalIssues} Issues
                                      </span>
                                   ) : (
                                      <span className={`px-2 py-1 rounded text-[6px] font-black uppercase tracking-widest border ${audit.approvalStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                         {audit.approvalStatus}
                                      </span>
                                   )}
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* --- DETAILED AUDIT MODAL --- */}
      {selectedAuditShift && (
        <div className="fixed inset-0 bg-black/70 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95" onClick={() => setSelectedAuditShift(null)}>
           <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] w-full max-w-4xl p-8 md:p-12 space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedAuditShift(null)} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <header className="space-y-1 pr-12">
                 <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${selectedAuditShift.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                       {selectedAuditShift.approvalStatus}
                    </span>
                    {(() => {
                       const timing = getShiftTimingInfo(selectedAuditShift);
                       return (
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-black/30 uppercase tracking-widest">
                                {selectedAuditShift.date} • {timing.startStr} - {timing.endStr}
                             </span>
                             {timing.isLate && (
                                <span className="text-[7px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-widest">
                                   LATE START (+{timing.lateDiff}m)
                                </span>
                             )}
                          </div>
                       );
                    })()}
                 </div>
                 <h2 className="text-3xl font-serif-brand font-bold uppercase text-black tracking-tight">{selectedAuditShift.propertyName}</h2>
                 <div className="flex flex-wrap gap-4 text-[9px] font-bold text-black/50 uppercase tracking-widest pt-2">
                    <span>Cleaned By: {selectedAuditShift.userIds?.map(uid => users.find(u => u.id === uid)?.name).join(', ')}</span>
                    <span>•</span>
                    <span>Audited By: {selectedAuditShift.decidedBy || 'System'}</span>
                 </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Left Column: Comments & Issues */}
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-[#D4B476]/20 shadow-sm">
                       <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2">Supervisor Verdict</p>
                       <p className="text-sm font-serif-brand italic text-black/80 leading-relaxed">
                          "{selectedAuditShift.approvalComment || 'No specific comments recorded.'}"
                       </p>
                    </div>

                    {(selectedAuditShift.maintenanceReports?.length || 0) > 0 && (
                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-3">
                           <p className="text-[8px] font-black text-blue-600 uppercase tracking-[0.4em]">Maintenance Reports</p>
                           {selectedAuditShift.maintenanceReports?.map((r, i) => (
                              <div key={i} className="text-[10px] font-bold text-black/70 border-l-2 border-blue-300 pl-3">
                                 {r.description}
                              </div>
                           ))}
                        </div>
                    )}
                    
                    {(selectedAuditShift.damageReports?.length || 0) > 0 && (
                        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-3">
                           <p className="text-[8px] font-black text-orange-600 uppercase tracking-[0.4em]">Damage Reported</p>
                           {selectedAuditShift.damageReports?.map((r, i) => (
                              <div key={i} className="text-[10px] font-bold text-black/70 border-l-2 border-orange-300 pl-3">
                                 {r.description}
                              </div>
                           ))}
                        </div>
                    )}
                 </div>

                 {/* Right Column: Photos & Checklist */}
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                       <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em]">Checklist Evidence</p>
                       <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {selectedAuditShift.tasks?.flatMap(t => t.photos).map((p, i) => (
                             <img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" alt="Task Proof" />
                          ))}
                          {selectedAuditShift.checkoutPhotos?.keyInBox?.map((p, i) => (
                             <img key={`k-${i}`} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" alt="Key Proof" />
                          ))}
                          {selectedAuditShift.checkoutPhotos?.boxClosed?.map((p, i) => (
                             <img key={`b-${i}`} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-gray-100 cursor-zoom-in hover:opacity-80 transition-opacity" alt="Box Proof" />
                          ))}
                          {(!selectedAuditShift.tasks?.some(t => t.photos.length > 0) && !selectedAuditShift.checkoutPhotos) && (
                             <p className="col-span-3 text-[9px] italic text-center py-4 opacity-30">No photos available.</p>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/95 z-[600] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
           <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Zoomed View" />
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] w-full max-w-2xl p-10 relative shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedUser(null)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
             <h2 className="text-3xl font-serif-brand font-bold text-black uppercase">{selectedUser.name}</h2>
             <div className="mt-10 space-y-6">
                <div className="flex items-center gap-4"><h3 className="text-[10px] font-black text-black/30 uppercase tracking-[0.4em]">Historical Absences</h3><div className="h-px flex-1 bg-black/5"></div></div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                   {calculateAttendanceGaps(selectedUser.id).map((gap, i) => (
                     <div key={i} className="p-4 bg-white/60 rounded-2xl border border-[#D4B476]/10 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="text-xs font-bold text-black uppercase">{gap.date}</p>
                          <p className="text-[8px] text-[#8B6B2E] font-black uppercase mt-1">Status: {gap.type}</p>
                        </div>
                        {gap.replacedBy && <p className="text-[8px] text-black/40 font-black uppercase">By: {gap.replacedBy}</p>}
                     </div>
                   ))}
                   {calculateAttendanceGaps(selectedUser.id).length === 0 && (
                     <p className="text-center py-10 opacity-20 italic text-[10px] uppercase">No absence records found.</p>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPortal;
