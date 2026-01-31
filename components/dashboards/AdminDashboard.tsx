
import React, { useState, useMemo, useRef } from 'react';
import { TabType, Shift, User, SupplyRequest, LeaveRequest, ManualTask, SpecialReport } from '../../types';
import { uploadFile } from '../../services/storageService';

interface AdminDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  users?: User[];
  supplyRequests?: SupplyRequest[];
  leaveRequests?: LeaveRequest[];
  onAuditDeepLink?: (shiftId: string) => void;
  onOpenManualTask?: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  onResolveLogistics?: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onToggleLaundryPrepared?: (shiftId: string) => void;
  authorizedLaundryUserIds?: string[];
  onToggleLaundryAuthority?: (userId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, setActiveTab, shifts = [], setShifts, users = [], supplyRequests = [], leaveRequests = [], onAuditDeepLink, onOpenManualTask,
  onResolveLogistics, onToggleLaundryPrepared, authorizedLaundryUserIds = [], onToggleLaundryAuthority
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);
  const [assigningReport, setAssigningReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  
  // Resolution state
  const [resolvingReport, setResolvingReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const resolutionFileRef = useRef<HTMLInputElement>(null);

  // Laundry Access Modal
  const [showLaundryAccessModal, setShowLaundryAccessModal] = useState(false);

  const reviewQueue = useMemo(() => shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending'), [shifts]);
  const rejectedQueue = useMemo(() => shifts.filter(s => s.approvalStatus === 'rejected' && s.correctionStatus !== 'fixing'), [shifts]);
  const activeCleaners = useMemo(() => shifts.filter(s => s.status === 'active'), [shifts]);
  const pendingSupplies = useMemo(() => (supplyRequests || []).filter(r => r.status === 'pending'), [supplyRequests]);
  const pendingLeaves = useMemo(() => (leaveRequests || []).filter(r => r.status === 'pending'), [leaveRequests]);
  const hasUnpublishedShifts = useMemo(() => shifts.some(s => !s.isPublished), [shifts]);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);

  // --- LOGISTICS ALERTS (Driver didn't deliver/collect/return keys) ---
  const logisticsAlerts = useMemo(() => {
    return shifts.filter(s => {
       if (s.excludeLaundry) return false;
       const isLogisticsType = ['CHECK OUT / CHECK IN CLEANING', 'REFRESH', 'MID STAY CLEANING', 'BEDS ONLY', 'LINEN DROP / COLLECTION'].includes(s.serviceType);
       if (!isLogisticsType) return false;
       const isRelevantDate = s.date <= todayStr; 
       if (!isRelevantDate) return false;
       const missingDelivery = !s.isDelivered;
       const missingCollection = !s.isCollected;
       const missingKeys = s.keysHandled && !s.keysAtOffice;
       return missingDelivery || missingCollection || missingKeys;
    }).map(s => {
        // STRICTLY FIND DRIVER - DO NOT FALLBACK TO CLEANER NAME
        const driver = users.find(u => s.userIds.includes(u.id) && u.role === 'driver');
        const assigneeName = driver ? driver.name : 'UNASSIGNED';
        
        // Find cleaners for context only (cleaner, supervisor, housekeeping)
        const cleaners = users.filter(u => s.userIds.includes(u.id) && ['cleaner', 'supervisor', 'housekeeping'].includes(u.role));
        const cleanerNames = cleaners.map(c => c.name.split(' ')[0]).join(', ');

        const issues = [];
        if (!s.isDelivered) issues.push('Delivery Pending');
        if (!s.isCollected) issues.push('Collection Pending');
        if (s.keysHandled && !s.keysAtOffice) issues.push('Keys Not Returned');
        return {
            shift: s,
            assignee: assigneeName,
            cleaners: cleanerNames,
            issues: issues.join(', '),
            reason: s.keyLocationReason
        };
    });
  }, [shifts, todayStr, users]);

  const shiftsWithIncidents = useMemo(() => {
    return shifts.filter(s => {
      const hasMaintenance = s.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const url = await uploadFile(file);
        setResolutionPhotos(prev => [...prev, url]);
    } catch (err) {
        console.error("Upload failed", err);
        alert("Failed to upload photo.");
    }
  };

  const confirmResolveIncident = () => {
    if (!resolvingReport) return;
    const { shiftId, report, type } = resolvingReport;
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        const field = type === 'maintenance' ? 'maintenanceReports' : type === 'damage' ? 'damageReports' : 'missingReports';
        const updatedReports = (s[field] || []).map(r => r.id === report.id ? { 
            ...r, 
            status: 'resolved' as const, 
            photos: [...(r.photos || []), ...resolutionPhotos]
        } : r);
        if (viewingIncidentShift?.id === shiftId) setViewingIncidentShift({ ...s, [field]: updatedReports });
        return { ...s, [field]: updatedReports };
      }
      return s;
    }));
    setResolvingReport(null);
    setResolutionPhotos([]);
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
            if (viewingIncidentShift?.id === assigningReport.shiftId) setViewingIncidentShift({ ...s, [field]: updatedReports });
            return { ...s, [field]: updatedReports };
        }
        return s;
    }));
    setAssigningReport(null);
    setAssignmentNote('');
  };

  const handleForceStop = (e: React.MouseEvent, shiftId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to FORCE CHECK OUT this user? This will mark the shift as completed pending review.")) return;
    
    setShifts(prev => prev.map(s => {
        if (s.id === shiftId) {
            return {
                ...s,
                status: 'completed',
                actualEndTime: Date.now(),
                approvalStatus: 'pending',
                approvalComment: 'ADMIN TERMINATION: Force Clock Out'
            };
        }
        return s;
    }));
  };

  const assignableStaff = useMemo(() => {
    return users.filter(u => ['maintenance', 'outsourced_maintenance', 'driver', 'housekeeping', 'supervisor', 'admin'].includes(u.role) && u.status === 'active')
        .sort((a, b) => {
            if (a.role === 'outsourced_maintenance' && b.role !== 'outsourced_maintenance') return 1;
            if (a.role !== 'outsourced_maintenance' && b.role === 'outsourced_maintenance') return -1;
            return 0;
        });
  }, [users]);

  const laundryEligibleStaff = useMemo(() => {
    return users.filter(u => ['supervisor', 'driver'].includes(u.role) && u.status === 'active');
  }, [users]);

  const getMissingItemsBreakdown = (reports: SpecialReport[]) => {
      const laundry = reports.filter(r => r.category === 'laundry' || r.description.includes('[FOR LAUNDRY]'));
      const apartment = reports.filter(r => r.category !== 'laundry' && !r.description.includes('[FOR LAUNDRY]'));
      return { laundry, apartment };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left pb-24">
      <div className="flex flex-col gap-4">
        
        {/* TOP ACTION BAR */}
        <section className="flex flex-col md:flex-row gap-4 items-stretch">
            <div className="flex-1 bg-white border border-gray-200 p-4 rounded-[28px] shadow-sm flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#C5A059]/10 rounded-full flex items-center justify-center text-[#C5A059]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Laundry Delegation</p>
                        <p className="text-[9px] text-black/40 font-bold uppercase mt-0.5">Authorize Supervisors & Drivers</p>
                    </div>
                </div>
                <button onClick={() => setShowLaundryAccessModal(true)} className="bg-[#C5A059] text-black font-black px-6 py-2.5 rounded-xl text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-[#d4b476]">MANAGE ACCESS</button>
            </div>
            <button onClick={onOpenManualTask} className="bg-black hover:bg-zinc-900 text-[#C5A059] font-black px-8 py-4 rounded-[28px] text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> ADD MANUAL TASK
            </button>
        </section>

        {/* LOGISTICS ALERTS */}
        {logisticsAlerts.length > 0 && (
            <section className="bg-orange-50 border-2 border-orange-200 p-6 rounded-[32px] shadow-xl space-y-4 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white animate-pulse">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-orange-700 uppercase tracking-[0.3em]">LOGISTICS FAILURES</h3>
                        <p className="text-[9px] text-orange-600 font-bold uppercase">{logisticsAlerts.length} Issues Requiring Attention</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {logisticsAlerts.map((alert, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-orange-200 flex flex-col justify-between gap-3 shadow-sm">
                            <div>
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-[10px] font-bold text-black uppercase truncate pr-2">{alert.shift.propertyName}</h4>
                                    <span className="text-[7px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">{alert.shift.date}</span>
                                </div>
                                <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">{alert.issues}</p>
                                <p className="text-[9px] text-black/60 uppercase mt-2 font-bold">Driver: {alert.assignee}</p>
                                {alert.cleaners && <p className="text-[8px] text-black/40 font-medium uppercase">On Site: {alert.cleaners}</p>}
                            </div>
                            {alert.reason && (
                                <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                    <p className="text-[8px] font-black text-orange-700 uppercase tracking-widest mb-0.5">Driver Reason:</p>
                                    <p className="text-[9px] text-black font-medium italic">"{alert.reason}"</p>
                                </div>
                            )}
                            <button 
                                onClick={() => onResolveLogistics?.(alert.shift.id, alert.shift.keysHandled && !alert.shift.keysAtOffice ? 'keysAtOffice' : 'isDelivered')}
                                className="w-full bg-orange-600 text-white py-2 rounded-lg font-black uppercase text-[8px] tracking-widest hover:bg-orange-700 transition-all"
                            >
                                FORCE RESOLVE
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        )}

        {hasUnpublishedShifts && (
          <section className="bg-[#FDF8EE] border-2 border-red-500 p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white shrink-0 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.3em]">DRAFT ALERT: UNPUBLISHED SCHEDULES</p>
                <p className="text-[10px] text-red-600/70 uppercase font-bold mt-1">Personnel cannot see their assignments until the week is published.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('shifts')}
              className="w-full md:w-auto bg-red-600 text-white font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-red-700"
            >
              RESOLVE IN SCHEDULE
            </button>
          </section>
        )}

        {pendingLeaves.length > 0 && (
          <section className="bg-blue-50 border-2 border-blue-200 p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em]">PENDING LEAVE REQUESTS</p>
                <p className="text-[10px] text-blue-600/70 uppercase font-bold mt-1">{pendingLeaves.length} personnel requested time off.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('users')}
              className="w-full md:w-auto bg-blue-600 text-white font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-blue-700"
            >
              REVIEW REQUESTS
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

      {/* --- LIVE MONITORING SECTION --- */}
      <section className="space-y-6">
         <div className="flex items-center gap-3 px-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <h2 className="text-[10px] font-black text-green-700 uppercase tracking-[0.3em]">LIVE OPERATIONS MONITOR</h2>
         </div>
         {activeCleaners.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-green-500/20 bg-green-50/10 rounded-[32px] text-center text-green-700/30 font-black uppercase text-[10px] tracking-widest italic">
               No staff currently clocked in.
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {activeCleaners.map(shift => {
                  const staffMembers = shift.userIds.map(uid => users.find(u => u.id === uid)).filter(Boolean) as User[];
                  const durationMins = shift.actualStartTime ? Math.floor((Date.now() - shift.actualStartTime) / 60000) : 0;
                  
                  // LIVE PHOTOS: Collect recent photos from tasks
                  const allPhotos = shift.tasks?.flatMap(t => t.photos) || [];
                  const recentPhotos = allPhotos.slice(-4).reverse();

                  return (
                     <div key={shift.id} className="bg-[#FDF8EE] border border-green-500/30 p-6 rounded-[32px] shadow-lg flex flex-col justify-between h-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                        <div className="space-y-4">
                           <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-black uppercase tracking-tight">{shift.propertyName}</h4>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[9px] font-mono font-bold text-green-700 bg-green-100 px-2 py-1 rounded">{durationMins}m</span>
                                {user.role === 'admin' && (
                                    <button 
                                        onClick={(e) => handleForceStop(e, shift.id)}
                                        className="bg-red-600 text-white px-2 py-1 rounded text-[6px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md z-10"
                                    >
                                        FORCE CHECK OUT
                                    </button>
                                )}
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="flex -space-x-2 overflow-hidden">
                                {staffMembers.map((u, i) => (
                                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-[#C5A059] flex items-center justify-center font-bold text-[10px] text-black">
                                        {u.name.charAt(0)}
                                    </div>
                                ))}
                              </div>
                              <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">
                                {staffMembers.length > 0 ? staffMembers.map(u => u.name.split(' ')[0]).join(' & ') : 'Staff'}
                              </p>
                           </div>
                           <p className="text-[8px] text-[#C5A059] font-black uppercase tracking-[0.2em]">{shift.serviceType}</p>
                           
                           {/* LIVE PHOTO FEED */}
                           {recentPhotos.length > 0 && (
                             <div className="pt-2 border-t border-green-500/10">
                                <p className="text-[7px] font-black text-green-700/50 uppercase tracking-widest mb-2">Live Activity Feed</p>
                                <div className="flex gap-2 overflow-hidden">
                                   {recentPhotos.map((p, i) => (
                                      <img 
                                        key={i} 
                                        src={p.url} 
                                        onClick={() => setZoomedImage(p.url)}
                                        className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm cursor-zoom-in hover:scale-105 transition-all" 
                                        alt="Live Evidence"
                                      />
                                   ))}
                                </div>
                             </div>
                           )}
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </section>

      {/* FIELD INCIDENT CENTER (Maintenance, Damage, Missing) */}
      <section className="bg-white border-2 border-[#C5A059] p-8 rounded-[40px] shadow-xl space-y-8">
         <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></div>
               <h2 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">FIELD INCIDENT CENTER</h2>
            </div>
            <span className="text-[8px] font-black text-[#C5A059] bg-[#C5A059]/10 px-3 py-1 rounded-full">{shiftsWithIncidents.length} UNITS REPORTING</span>
         </div>
         
         {shiftsWithIncidents.length === 0 ? (
            <div className="py-12 text-center text-black/20 italic text-[10px] font-black uppercase tracking-widest">No active incidents reported.</div>
         ) : (
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
         )}
      </section>

      {/* Laundry Access Modal */}
      {showLaundryAccessModal && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-[#FDF8EE] border border-[#C5A059]/40 rounded-[40px] w-full max-w-lg p-10 space-y-8 shadow-2xl relative text-left">
              <button onClick={() => setShowLaundryAccessModal(false)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-1">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Laundry Access</h2>
                 <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Delegate Authority</p>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                 {laundryEligibleStaff.length === 0 ? (
                    <p className="text-center text-black/30 italic text-[9px] font-black uppercase py-4">No Supervisors or Drivers found.</p>
                 ) : laundryEligibleStaff.map(staff => {
                    const isAuthorized = authorizedLaundryUserIds.includes(staff.id);
                    return (
                        <label key={staff.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${isAuthorized ? 'bg-white border-[#C5A059] shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAuthorized ? 'bg-[#C5A059] text-black' : 'bg-gray-200 text-gray-500'}`}>
                                    {staff.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-black uppercase">{staff.name}</p>
                                    <p className="text-[7px] text-black/40 font-black uppercase tracking-widest">{staff.role}</p>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-[#C5A059] cursor-pointer"
                                checked={isAuthorized}
                                onChange={() => onToggleLaundryAuthority?.(staff.id)}
                            />
                        </label>
                    );
                 })}
              </div>
              <button onClick={() => setShowLaundryAccessModal(false)} className="w-full bg-black text-[#C5A059] font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest shadow-xl">Done</button>
           </div>
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
                                    <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report, type: 'maintenance' })} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
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
                                    <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report, type: 'damage' })} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
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
                                          <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report, type: 'missing' })} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
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
                                          <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report, type: 'missing' })} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-gray-50">Resolve</button>
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

      {/* Resolution Modal (Admin Direct Resolve) */}
      {resolvingReport && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-white rounded-[40px] w-full max-w-md p-8 space-y-6 shadow-2xl relative text-left">
              <div className="space-y-1">
                 <h3 className="text-xl font-bold text-black uppercase">Confirm Resolution</h3>
                 <p className="text-[8px] text-black/40 font-black uppercase tracking-widest">Close this incident manually</p>
              </div>
              <div className="space-y-4">
                 <p className="text-xs text-black/70 italic">
                    Are you sure you want to mark this {resolvingReport.type.toLowerCase()} report as resolved? 
                    This will remove it from the active queue.
                 </p>
                 <div>
                    <label className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em] mb-1.5 block">Attach Proof (Optional)</label>
                    <div className="flex gap-2 items-center">
                        <button onClick={() => resolutionFileRef.current?.click()} className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-all text-black/40">
                            +
                        </button>
                        <div className="flex gap-2 overflow-x-auto">
                            {resolutionPhotos.map((url, i) => (
                                <img key={i} src={url} className="h-12 w-12 rounded-xl object-cover border border-gray-200" />
                            ))}
                        </div>
                        <input type="file" ref={resolutionFileRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </div>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={confirmResolveIncident} className="flex-1 bg-green-600 text-white font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest shadow-xl">CONFIRM RESOLUTION</button>
                 <button onClick={() => { setResolvingReport(null); setResolutionPhotos([]); }} className="px-6 border border-gray-200 text-black/40 font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest">CANCEL</button>
              </div>
           </div>
        </div>
      )}

      {/* Extra Time/Rejected Queue sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verification Queue Section */}
        <section className={`bg-[#FDF8EE] p-6 rounded-[32px] border-2 border-[#C5A059] shadow-xl space-y-6 ${reviewQueue.length === 0 ? 'opacity-30 grayscale' : ''}`}>
          <div className="flex justify-between items-center px-2">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${reviewQueue.length > 0 ? 'bg-[#C5A059] animate-bounce' : 'bg-gray-200'}`}></span>
                <h2 className="text-[9px] font-black text-black uppercase tracking-widest">VERIFICATION</h2>
             </div>
             <span className="text-[8px] font-black text-[#C5A059]">{reviewQueue.length}</span>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
            {reviewQueue.map(shift => (
              <div key={shift.id} className="bg-white p-4 rounded-2xl border border-[#D4B476]/10 shadow-sm flex flex-col gap-3">
                 <div className="text-left">
                    <h4 className="text-xs font-bold text-black uppercase leading-tight">{shift.propertyName}</h4>
                    <p className="text-[8px] text-[#A68342] font-black uppercase mt-1">{shift.startTime} • Completed</p>
                    {shift.approvalComment && shift.approvalComment.includes('ADMIN TERMINATION') && (
                       <p className="text-[7px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded w-fit mt-1">
                          ! FORCE STOPPED
                       </p>
                    )}
                 </div>
                 <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-black text-[#C5A059] py-2 rounded-lg font-black uppercase text-[8px] tracking-widest">Verify Audit</button>
              </div>
            ))}
          </div>
        </section>

        {/* Rejected Queue Section */}
        <section className={`bg-red-50 p-6 rounded-[32px] border-2 border-red-500 shadow-xl space-y-6 ${rejectedQueue.length === 0 ? 'opacity-30 grayscale' : ''}`}>
          <div className="flex justify-between items-center px-2">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${rejectedQueue.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-red-200'}`}></span>
                <h2 className="text-[9px] font-black text-red-600 uppercase tracking-widest">REJECTED JOBS</h2>
             </div>
             <span className="text-[8px] font-black text-red-600">{rejectedQueue.length}</span>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
            {rejectedQueue.map(shift => (
              <div key={shift.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-3">
                 <div className="text-left">
                    <h4 className="text-xs font-bold text-red-700 uppercase leading-tight">{shift.propertyName}</h4>
                    <p className="text-[8px] text-red-600/60 font-black uppercase mt-1">Status: Rejected</p>
                 </div>
                 <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-red-600 text-white py-2 rounded-lg font-black uppercase text-[8px] tracking-widest">Manage Rejection</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;