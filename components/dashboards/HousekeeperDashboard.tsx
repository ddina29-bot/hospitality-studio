
import React, { useMemo, useState } from 'react';
import { TabType, Shift, User, Property, SupplyRequest, LeaveRequest, ManualTask, SpecialReport } from '../../types';

interface HousekeeperDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  users: User[];
  properties: Property[];
  supplyRequests: SupplyRequest[];
  leaveRequests?: LeaveRequest[];
  setLeaveRequests?: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  onResolveLogistics: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onAuditDeepLink?: (shiftId: string) => void;
  onOpenManualTask?: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
}

const HousekeeperDashboard: React.FC<HousekeeperDashboardProps> = ({ user, setActiveTab, onLogout, shifts, setShifts, users, properties, supplyRequests, leaveRequests = [], setLeaveRequests, onResolveLogistics, onAuditDeepLink, onOpenManualTask, manualTasks = [], setManualTasks }) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // State for the main view modal (viewing all reports for a specific shift)
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);

  // State for the specific assignment action
  const [assigningReport, setAssigningReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [assignmentNote, setAssignmentNote] = useState('');

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  const currentHour = new Date().getHours();

  const auditQueue = useMemo(() => shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending'), [shifts]);
  const rejectedQueue = useMemo(() => shifts.filter(s => s.approvalStatus === 'rejected' && s.correctionStatus !== 'fixing'), [shifts]);
  const extraTimeRequests = useMemo(() => shifts.filter(s => s.messReport && s.messReport.status === 'pending'), [shifts]);
  const activeCleaners = useMemo(() => shifts.filter(s => s.status === 'active'), [shifts]);
  const pendingSupplies = useMemo(() => (supplyRequests || []).filter(r => r.status === 'pending'), [supplyRequests]);
  const cleaners = users.filter(u => u.role === 'cleaner');

  // Alert logic for unpublished shifts
  const hasUnpublishedShifts = useMemo(() => shifts.some(s => !s.isPublished), [shifts]);

  // Task Notification Logic
  const myExtraTasks = useMemo(() => 
    manualTasks.filter(t => t.userId === user.id && t.status === 'pending'),
  [manualTasks, user.id]);

  const toggleTaskDone = (id: string) => {
    setManualTasks?.(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
  };

  const handleExtraTimeDecision = (shiftId: string, decision: 'approved' | 'rejected') => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId && s.messReport) {
        return {
          ...s,
          messReport: { ...s.messReport, status: decision }
        };
      }
      return s;
    }));
  };

  const pendingPersonnelLeaves = useMemo(() => {
    return leaveRequests.filter(l => {
      if (l.status !== 'pending') return false;
      const applicant = users.find(u => u.id === l.userId);
      return applicant?.role === 'cleaner' || applicant?.role === 'maintenance';
    });
  }, [leaveRequests, users]);

  const logisticsAlerts = useMemo(() => {
    if (currentHour < 15) return [];
    const todayLogistics = shifts.filter(s => s.date === todayStr);
    const alerts: { id: string, type: 'isDelivered' | 'isCollected' | 'keysAtOffice', message: string, prop: string, reason?: string }[] = [];
    todayLogistics.forEach(s => {
      if (!s.isDelivered) alerts.push({ id: s.id, type: 'isDelivered', prop: s.propertyName || 'Unknown', message: 'LINEN DELIVERY PENDING' });
      if (!s.isCollected) alerts.push({ id: s.id, type: 'isCollected', prop: s.propertyName || 'Unknown', message: 'LAUNDRY COLLECTION PENDING' });
      if (s.keysHandled && !s.keysAtOffice) {
        alerts.push({ id: s.id, type: 'keysAtOffice', prop: s.propertyName || 'Unknown', message: 'KEYS MISSING FROM OFFICE', reason: s.keyLocationReason });
      }
    });
    return alerts;
  }, [shifts, todayStr, currentHour]);

  // Group active reports by Shift
  const shiftsWithIncidents = useMemo(() => {
    return shifts.filter(s => {
      const hasMaintenance = s.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  const handleResolveIncident = (shiftId: string, reportId: string, type: 'maintenance' | 'damage' | 'missing') => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        const field = type === 'maintenance' ? 'maintenanceReports' : type === 'damage' ? 'damageReports' : 'missingReports';
        const updatedReports = (s[field] || []).map(r => r.id === reportId ? { ...r, status: 'resolved' as const } : r);
        
        // Update local viewing state if open
        if (viewingIncidentShift?.id === shiftId) {
            setViewingIncidentShift({ ...s, [field]: updatedReports });
        }
        
        return { ...s, [field]: updatedReports };
      }
      return s;
    }));
  };

  const handleAssignIncident = (userId: string) => {
    if (!assigningReport) return;
    const assigneeName = users.find(u => u.id === userId)?.name || 'Unknown';
    setShifts(prev => prev.map(s => {
        if (s.id === assigningReport.shiftId) {
            const field = assigningReport.type === 'maintenance' ? 'maintenanceReports' : assigningReport.type === 'damage' ? 'damageReports' : 'missingReports';
            const updatedReports = (s[field] || []).map(r => r.id === assigningReport.report.id ? { 
                ...r, 
                status: 'assigned' as const,
                assignedTo: userId,
                assignedToName: assigneeName,
                assignedAt: Date.now(),
                assignmentNotes: assignmentNote
            } : r);

            // Update local viewing state if open
            if (viewingIncidentShift?.id === assigningReport.shiftId) {
                setViewingIncidentShift({ ...s, [field]: updatedReports });
            }

            return { ...s, [field]: updatedReports };
        }
        return s;
    }));
    setAssigningReport(null);
    setAssignmentNote('');
  };

  const assignableStaff = useMemo(() => {
    return users.filter(u => ['maintenance', 'outsourced_maintenance', 'driver', 'housekeeping', 'supervisor', 'admin'].includes(u.role) && u.status === 'active');
  }, [users]);

  // Helper to categorize missing items
  const getMissingItemsBreakdown = (reports: SpecialReport[]) => {
      const laundry = reports.filter(r => r.category === 'laundry' || r.description.includes('[FOR LAUNDRY]'));
      const apartment = reports.filter(r => r.category !== 'laundry' && !r.description.includes('[FOR LAUNDRY]'));
      return { laundry, apartment };
  };

  const hasPriorityItems = rejectedQueue.length > 0 || auditQueue.length > 0 || extraTimeRequests.length > 0 || pendingPersonnelLeaves.length > 0 || myExtraTasks.length > 0 || shiftsWithIncidents.length > 0 || pendingSupplies.length > 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <div className="flex flex-col gap-4">
        {hasUnpublishedShifts && (
          <section className="bg-[#FDF8EE] border-2 border-red-500 p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shrink-0 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.3em]">OPERATIONAL RISK: DRAFT SHIFTS DETECTED</p>
                <p className="text-[10px] text-red-600/70 uppercase font-bold mt-1">Personnel have no visibility of current draft assignments.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('shifts')}
              className="w-full md:w-auto bg-red-600 text-white font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-red-700"
            >
              PUBLISH SCHEDULE
            </button>
          </section>
        )}

        {pendingSupplies.length > 0 && (
          <section className="bg-purple-50 border-2 border-purple-200 p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white shrink-0 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-purple-600 uppercase tracking-[0.3em]">INVENTORY REQUISITION</p>
                <p className="text-[10px] text-purple-600/70 uppercase font-bold mt-1">{pendingSupplies.length} staff member{pendingSupplies.length > 1 ? 's' : ''} requested supplies.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('inventory_admin')}
              className="w-full md:w-auto bg-purple-600 text-white font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-purple-700"
            >
              REVIEW REQUESTS
            </button>
          </section>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#8B6B2E] font-black uppercase tracking-[0.4em] text-[8px]">HOSPITALITY MANAGEMENT</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onOpenManualTask}
            className="bg-black hover:bg-zinc-900 text-[#C5A059] font-black px-6 py-2.5 rounded-xl text-[9px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-xl active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ADD TASK
          </button>
        </div>
      </div>

      {hasPriorityItems && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-700">
          
          {/* FIELD INCIDENT CENTER (Maintenance, Damage, Missing) */}
          {shiftsWithIncidents.length > 0 && (
            <section className="bg-white border-2 border-[#C5A059] p-8 rounded-[40px] shadow-xl space-y-8 lg:col-span-2">
               <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></div>
                     <h2 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">FIELD INCIDENT CENTER</h2>
                  </div>
                  <span className="text-[8px] font-black text-[#C5A059] bg-[#C5A059]/10 px-3 py-1 rounded-full">{shiftsWithIncidents.length} UNITS REPORTING</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {shiftsWithIncidents.map((shift) => {
                     const maintenanceCount = shift.maintenanceReports?.filter(r => r.status !== 'resolved').length || 0;
                     const damageCount = shift.damageReports?.filter(r => r.status !== 'resolved').length || 0;
                     const missingCount = shift.missingReports?.filter(r => r.status !== 'resolved').length || 0;
                     const staffNames = shift.userIds?.map(uid => users.find(u => u.id === uid)?.name.split(' ')[0]).join(', ');

                     return (
                        <div key={shift.id} className="p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5 transition-all group hover:border-[#C5A059] bg-white flex flex-col justify-between">
                           <div className="space-y-4">
                              <div className="space-y-1">
                                 <h4 className="text-sm font-bold text-black uppercase tracking-tight leading-tight">{shift.propertyName}</h4>
                                 <p className="text-[8px] text-black/40 font-black uppercase tracking-widest">Reported By: {staffNames}</p>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                 {maintenanceCount > 0 && <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">{maintenanceCount} MAINTENANCE</span>}
                                 {damageCount > 0 && <span className="text-[8px] font-black bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100">{damageCount} DAMAGE</span>}
                                 {missingCount > 0 && <span className="text-[8px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">{missingCount} MISSING</span>}
                              </div>
                           </div>

                           <button 
                             onClick={() => setViewingIncidentShift(shift)}
                             className="w-full bg-[#C5A059] text-black font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-[#d4b476] transition-all active:scale-95 flex items-center justify-center gap-2"
                           >
                             MANAGE REPORTS <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                           </button>
                        </div>
                     );
                  })}
               </div>
            </section>
          )}

          {/* EXTRA TIME REQUESTS */}
          {extraTimeRequests.length > 0 && (
            <section className="bg-red-50 p-6 rounded-[32px] border-2 border-red-200 shadow-xl space-y-6 lg:col-span-1">
               <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                     <h2 className="text-[9px] font-black text-red-600 uppercase tracking-widest">EXTRA TIME</h2>
                  </div>
                  <span className="text-[8px] font-black text-red-600">{extraTimeRequests.length}</span>
               </div>
               <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {extraTimeRequests.map(req => (
                    <div key={req.id} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm space-y-3">
                       <div className="text-left">
                          <h4 className="text-[10px] font-bold text-black uppercase">{req.propertyName}</h4>
                          <p className="text-[8px] text-red-600 font-black mt-1 italic">"{req.messReport?.description}"</p>
                       </div>
                       <div className="flex gap-1 overflow-x-auto pb-1">
                          {req.messReport?.photos.map((url, i) => (
                            <img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-10 h-10 rounded object-cover cursor-zoom-in" />
                          ))}
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleExtraTimeDecision(req.id, 'approved')} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-[8px] font-black uppercase">Approve</button>
                          <button onClick={() => handleExtraTimeDecision(req.id, 'rejected')} className="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-[8px] font-black uppercase">Reject</button>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          )}

          {myExtraTasks.length > 0 && (
            <section className="bg-[#FCF5E5] p-6 rounded-[32px] border-2 border-[#A68342] shadow-xl space-y-6 lg:col-span-1">
              <div className="flex justify-between items-center px-2">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#A68342] animate-pulse"></span>
                    <h2 className="text-[9px] font-black text-[#A68342] uppercase tracking-widest">MY EXTRA TASKS</h2>
                 </div>
                 <span className="text-[8px] font-black text-[#A68342]">{myExtraTasks.length}</span>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {myExtraTasks.map(task => (
                  <div key={task.id} className="bg-white p-4 rounded-2xl border border-[#A68342]/20 shadow-sm flex items-center justify-between gap-4">
                     <div className="text-left flex-1">
                        <h4 className="text-[10px] font-bold text-[#A68342] uppercase leading-tight">{task.taskName}</h4>
                        <p className="text-[7px] text-[#A68342]/60 font-black uppercase mt-1">{task.propertyName}</p>
                     </div>
                     <button onClick={() => toggleTaskDone(task.id)} className="w-6 h-6 rounded-full border-2 border-[#A68342] flex items-center justify-center text-[#A68342] hover:bg-[#FCF5E5] transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                     </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={`bg-red-50 p-6 rounded-[32px] border-2 border-red-500 shadow-xl space-y-6 lg:col-span-1 ${rejectedQueue.length === 0 ? 'opacity-30 grayscale' : ''}`}>
            <div className="flex justify-between items-center px-2">
               <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rejectedQueue.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-red-200'}`}></span>
                  <h2 className="text-[9px] font-black text-red-600 uppercase tracking-widest">REJECTED JOBS</h2>
               </div>
               <span className="text-[8px] font-black text-red-600">{rejectedQueue.length}</span>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {rejectedQueue.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-3">
                   <div className="text-left">
                      <h4 className="text-xs font-bold text-red-700 uppercase leading-tight">{s.propertyName}</h4>
                      <p className="text-[8px] text-red-600/60 font-black uppercase mt-1">Personnel: {s.userIds?.map(uid => users.find(u => u.id === uid)?.name.split(' ')[0]).join(' & ')}</p>
                   </div>
                   <button onClick={() => onAuditDeepLink?.(s.id)} className="w-full bg-red-600 text-white py-2 rounded-lg font-black uppercase text-[8px] tracking-widest">Reschedule Fix</button>
                </div>
              ))}
              {rejectedQueue.length === 0 && <p className="text-[8px] text-red-300 uppercase italic text-center py-4">No Failures</p>}
            </div>
          </section>
        </div>
      )}

      {/* Main Incident Management Modal */}
      {viewingIncidentShift && (
         <div className="fixed inset-0 bg-black/70 z-[400] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#FDF8EE] border border-[#C5A059]/40 rounded-[40px] w-full max-w-4xl p-8 md:p-10 space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
               <button onClick={() => setViewingIncidentShift(null)} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               
               <header className="space-y-1 pr-10">
                  <h3 className="text-2xl font-serif-brand font-bold uppercase text-black">{viewingIncidentShift.propertyName}</h3>
                  <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Comprehensive Report Analysis</p>
               </header>

               <div className="space-y-8">
                  {/* Maintenance Section */}
                  {viewingIncidentShift.maintenanceReports && viewingIncidentShift.maintenanceReports.length > 0 && (
                     <div className="space-y-3">
                        <div className="flex items-center gap-3 border-b border-black/5 pb-2">
                           <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                           <h4 className="text-xs font-black text-black uppercase tracking-widest">Maintenance</h4>
                        </div>
                        {viewingIncidentShift.maintenanceReports.map((report, idx) => (
                           <div key={idx} className={`bg-white p-4 rounded-2xl border ${report.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-blue-100 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                              <div className="flex-1 space-y-2">
                                 <p className="text-[10px] text-black font-medium italic">"{report.description}"</p>
                                 <div className="flex gap-2">
                                    {report.photos?.map((url, i) => (
                                       <img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-zoom-in" />
                                    ))}
                                 </div>
                                 {report.assignedToName && <p className="text-[8px] text-blue-600 font-bold uppercase">Assigned to: {report.assignedToName}</p>}
                              </div>
                              {report.status !== 'resolved' && (
                                 <div className="flex gap-2 shrink-0">
                                    <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report, type: 'maintenance' })} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-95">Assign</button>
                                    <button onClick={() => handleResolveIncident(viewingIncidentShift.id, report.id, 'maintenance')} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
                                 </div>
                              )}
                              {report.status === 'resolved' && <span className="text-[8px] font-black text-green-600 bg-green-50 px-3 py-1 rounded uppercase">Resolved</span>}
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Damage Section */}
                  {viewingIncidentShift.damageReports && viewingIncidentShift.damageReports.length > 0 && (
                     <div className="space-y-3">
                        <div className="flex items-center gap-3 border-b border-black/5 pb-2">
                           <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                           <h4 className="text-xs font-black text-black uppercase tracking-widest">Damage</h4>
                        </div>
                        {viewingIncidentShift.damageReports.map((report, idx) => (
                           <div key={idx} className={`bg-white p-4 rounded-2xl border ${report.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-orange-100 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                              <div className="flex-1 space-y-2">
                                 <p className="text-[10px] text-black font-medium italic">"{report.description}"</p>
                                 <div className="flex gap-2">
                                    {report.photos?.map((url, i) => (
                                       <img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-zoom-in" />
                                    ))}
                                 </div>
                                 {report.assignedToName && <p className="text-[8px] text-orange-600 font-bold uppercase">Assigned to: {report.assignedToName}</p>}
                              </div>
                              {report.status !== 'resolved' && (
                                 <div className="flex gap-2 shrink-0">
                                    <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report, type: 'damage' })} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-95">Assign</button>
                                    <button onClick={() => handleResolveIncident(viewingIncidentShift.id, report.id, 'damage')} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
                                 </div>
                              )}
                              {report.status === 'resolved' && <span className="text-[8px] font-black text-green-600 bg-green-50 px-3 py-1 rounded uppercase">Resolved</span>}
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Missing Items Section */}
                  {viewingIncidentShift.missingReports && viewingIncidentShift.missingReports.length > 0 && (
                     <div className="space-y-6">
                        {/* Missing from Apartment */}
                        {getMissingItemsBreakdown(viewingIncidentShift.missingReports).apartment.length > 0 && (
                           <div className="space-y-3">
                              <div className="flex items-center gap-3 border-b border-black/5 pb-2">
                                 <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                 <h4 className="text-xs font-black text-black uppercase tracking-widest">Missing (Apartment)</h4>
                              </div>
                              {getMissingItemsBreakdown(viewingIncidentShift.missingReports).apartment.map((report, idx) => (
                                 <div key={idx} className={`bg-white p-4 rounded-2xl border ${report.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-purple-100 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                                    <div className="flex-1 space-y-2">
                                       <p className="text-[10px] text-black font-medium italic">"{report.description}"</p>
                                       {report.assignedToName && <p className="text-[8px] text-purple-600 font-bold uppercase">Assigned to: {report.assignedToName}</p>}
                                    </div>
                                    {report.status !== 'resolved' && (
                                       <div className="flex gap-2 shrink-0">
                                          <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report, type: 'missing' })} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-95">Assign</button>
                                          <button onClick={() => handleResolveIncident(viewingIncidentShift.id, report.id, 'missing')} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
                                       </div>
                                    )}
                                    {report.status === 'resolved' && <span className="text-[8px] font-black text-green-600 bg-green-50 px-3 py-1 rounded uppercase">Resolved</span>}
                                 </div>
                              ))}
                           </div>
                        )}

                        {/* Missing from Laundry */}
                        {getMissingItemsBreakdown(viewingIncidentShift.missingReports).laundry.length > 0 && (
                           <div className="space-y-3">
                              <div className="flex items-center gap-3 border-b border-black/5 pb-2">
                                 <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                                 <h4 className="text-xs font-black text-black uppercase tracking-widest">Missing (Laundry)</h4>
                              </div>
                              {getMissingItemsBreakdown(viewingIncidentShift.missingReports).laundry.map((report, idx) => (
                                 <div key={idx} className={`bg-white p-4 rounded-2xl border ${report.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-pink-100 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                                    <div className="flex-1 space-y-2">
                                       <p className="text-[10px] text-black font-medium italic">"{report.description}"</p>
                                       {report.assignedToName && <p className="text-[8px] text-pink-600 font-bold uppercase">Assigned to: {report.assignedToName}</p>}
                                    </div>
                                    {report.status !== 'resolved' && (
                                       <div className="flex gap-2 shrink-0">
                                          <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report, type: 'missing' })} className="bg-pink-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-95">Assign</button>
                                          <button onClick={() => handleResolveIncident(viewingIncidentShift.id, report.id, 'missing')} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
                                       </div>
                                    )}
                                    {report.status === 'resolved' && <span className="text-[8px] font-black text-green-600 bg-green-50 px-3 py-1 rounded uppercase">Resolved</span>}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* Assignment Modal */}
      {assigningReport && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-[#FDF8EE] border border-[#C5A059]/40 rounded-[40px] w-full max-w-md p-8 space-y-6 shadow-2xl relative">
              <button onClick={() => { setAssigningReport(null); setAssignmentNote(''); }} className="absolute top-6 right-6 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <div>
                 <h3 className="text-xl font-serif-brand font-bold uppercase text-black">Assign {assigningReport.type}</h3>
                 <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Select Personnel for Resolution</p>
              </div>
              
              <div>
                 <label className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em] mb-1.5 block px-1 opacity-80">Instructions / Notes</label>
                 <textarea 
                   value={assignmentNote} 
                   onChange={(e) => setAssignmentNote(e.target.value)}
                   className="w-full bg-white border border-[#C5A059]/20 rounded-xl p-3 text-[10px] font-medium outline-none focus:border-[#C5A059] h-20 placeholder:text-black/20"
                   placeholder="Add instructions for the assignee (optional)..."
                 />
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                 {assignableStaff.map(u => (
                   <button 
                     key={u.id}
                     onClick={() => handleAssignIncident(u.id)}
                     className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-[#C5A059] hover:shadow-md transition-all group"
                   >
                      <div className="text-left">
                         <p className="text-[10px] font-bold text-black uppercase">{u.name}</p>
                         <p className="text-[7px] text-black/40 font-black uppercase tracking-widest">{u.role}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10 group-hover:text-[#C5A059]"><polyline points="9 18 15 12 9 6"/></svg>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default HousekeeperDashboard;
