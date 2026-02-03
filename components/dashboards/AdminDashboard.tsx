
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
  setSupplyRequests?: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  leaveRequests?: LeaveRequest[];
  onAuditDeepLink?: (shiftId: string) => void;
  onOpenManualTask?: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  onResolveLogistics?: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onToggleLaundryPrepared?: (shiftId: string) => void;
  authorizedLaundryUserIds?: string[];
  onToggleAuthority?: (userId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, setActiveTab, onLogout, shifts = [], setShifts, users = [], supplyRequests = [], setSupplyRequests, leaveRequests = [], onAuditDeepLink, onOpenManualTask,
  onResolveLogistics, onToggleLaundryPrepared, authorizedLaundryUserIds = [], onToggleAuthority
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);
  const [assigningReport, setAssigningReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  
  const [resolvingReport, setResolvingReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const resolutionFileRef = useRef<HTMLInputElement>(null);

  const reviewQueue = useMemo(() => shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending'), [shifts]);
  const messQueue = useMemo(() => shifts.filter(s => s.messReport && s.messReport.status === 'pending'), [shifts]);
  const activeOps = useMemo(() => shifts.filter(s => s.status === 'active'), [shifts]);
  
  const pendingSupplies = useMemo(() => supplyRequests.filter(r => r.status === 'pending'), [supplyRequests]);
  const groupedSupplies = useMemo(() => {
    return pendingSupplies.reduce((acc, r) => {
      if (!acc[r.userId]) acc[r.userId] = [];
      acc[r.userId].push(r);
      return acc;
    }, {} as Record<string, SupplyRequest[]>);
  }, [pendingSupplies]);

  const handleApproveSupplies = (batch: SupplyRequest[]) => {
    if (!setSupplyRequests || !setShifts) return;
    
    const ids = batch.map(r => r.id);
    setSupplyRequests(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'approved' } : r));
    
    const now = new Date();
    let deliveryDate = new Date();
    if (now.getHours() >= 11) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
    }
    const dateStr = deliveryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    
    const cleanerName = batch[0].userName;
    const itemsList = batch.map(b => `${b.quantity}x ${b.itemName}`).join(', ');
    
    const newShift: Shift = {
        id: `sd-${Date.now()}-${batch[0].userId}`,
        propertyId: 'supply-drop',
        propertyName: `SUPPLY DROP: ${cleanerName.toUpperCase()}`,
        userIds: [], 
        date: dateStr,
        startTime: '08:00 AM',
        endTime: '06:00 PM',
        serviceType: 'SUPPLY DELIVERY',
        status: 'pending',
        approvalStatus: 'pending',
        isPublished: true,
        notes: `DELIVERY FOR ${cleanerName}: ${itemsList}`
    };
    
    setShifts(prev => [newShift, ...prev]);
    alert(`Supplies approved for ${cleanerName}. Task routed to drivers for ${dateStr}.`);
  };

  const handleExtraHoursDecision = (shiftId: string, decision: 'approved' | 'rejected', note: string) => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId && s.messReport) {
        return { ...s, messReport: { ...s.messReport, status: decision, decisionNote: note } };
      }
      return s;
    }));
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

  const shiftsWithIncidents = useMemo(() => {
    return shifts.filter(s => {
      const hasMaintenance = s.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24 w-full overflow-x-hidden">
      <header className="px-2 mb-2">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Studio Hub</h2>
        <p className="text-[11px] text-teal-600 font-black uppercase tracking-[0.4em] mt-3">OPERATIONAL INTELLIGENCE & REAL-TIME OVERSIGHT</p>
      </header>

      {/* PRIMARY ACTION: SUPPLY REQUISITIONS */}
      {pendingSupplies.length > 0 && (
        <section className="bg-white border-2 border-indigo-200 p-8 rounded-[40px] shadow-2xl space-y-6 animate-in slide-in-from-top-4">
           <div className="flex justify-between items-center px-2">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl">📦</div>
                 <div className="space-y-0.5">
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em]">Supply Requisitions</h3>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Awaiting Logistics Approval</p>
                 </div>
              </div>
              <span className="text-[10px] font-black bg-indigo-600 text-white px-5 py-2 rounded-full uppercase tracking-widest shadow-md">{Object.keys(groupedSupplies).length} PERSONNEL QUEUED</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(groupedSupplies).map(([uid, batch]) => (
                 <div key={uid} className="bg-slate-50 p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm space-y-5 hover:border-indigo-300 transition-colors">
                    <div className="text-left">
                       <p className="text-xs font-black uppercase text-slate-900 tracking-tight border-b border-indigo-100 pb-2">{batch[0].userName}</p>
                       <div className="mt-3 space-y-2">
                          {batch.map(b => (
                             <p key={b.id} className="text-[11px] text-indigo-900 font-bold uppercase flex justify-between items-center">
                                <span className="opacity-70">{b.itemName}</span>
                                <span className="bg-white px-2 py-0.5 rounded-lg border border-indigo-50 text-[9px] font-black">x{b.quantity}</span>
                             </p>
                          ))}
                       </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                       <button onClick={() => handleApproveSupplies(batch)} className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">APPROVE & ROUTE</button>
                       <button onClick={() => setSupplyRequests?.(prev => prev.filter(r => !batch.map(b => b.id).includes(r.id)))} className="flex-1 border-2 border-indigo-100 text-indigo-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all">DENY</button>
                    </div>
                 </div>
              ))}
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* AWAITING AUDIT */}
        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl space-y-8 flex flex-col hover:border-teal-400/30 transition-all">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
             <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${reviewQueue.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Awaiting Audit</h2>
             </div>
             {reviewQueue.length > 0 && <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">{reviewQueue.length}</span>}
          </div>
          <div className="space-y-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                 <span className="text-4xl mb-4">✨</span>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Complete</p>
                 <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300 mt-1">NO PENDING AUDITS</p>
              </div>
            ) : (
              reviewQueue.map(shift => (
                <div key={shift.id} className="bg-teal-50/50 p-6 rounded-3xl border border-teal-100 shadow-sm flex flex-col gap-5 group hover:bg-teal-50 hover:border-teal-300 transition-all">
                   <div className="text-left">
                      <h4 className="text-sm font-black text-slate-900 uppercase leading-tight tracking-tight">{shift.propertyName}</h4>
                      <p className="text-[9px] text-teal-700 font-black uppercase mt-1.5 tracking-widest">{shift.startTime} • FINALIZED EVIDENCE READY</p>
                   </div>
                   <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-teal-600 text-white py-3.5 rounded-2xl font-black uppercase text-[9px] tracking-[0.2em] shadow-lg shadow-teal-900/10 hover:bg-teal-700 transition-all active:scale-95">Open Verification</button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* LIVE FIELD STAFF */}
        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl space-y-8 flex flex-col hover:border-emerald-400/30 transition-all">
           <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${activeOps.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Live Field Staff</h2>
              </div>
              {activeOps.length > 0 && <span className="bg-green-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">{activeOps.length}</span>}
           </div>
           <div className="space-y-3 flex-1">
              {activeOps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                   <span className="text-4xl mb-4">📡</span>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ops Standby</p>
                   <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300 mt-1">NO ACTIVE DEPLOYMENTS</p>
                </div>
              ) : (
                activeOps.map(s => (
                   <div key={s.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-slate-100 group hover:bg-white hover:border-green-300 transition-all shadow-sm">
                      <div className="min-w-0 flex-1 text-left">
                         <p className="text-xs font-black uppercase truncate pr-3 text-slate-900 tracking-tight">{s.propertyName}</p>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{s.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).join(' & ')}</span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-[10px] font-mono text-green-700 font-black bg-green-100 px-3 py-1 rounded-xl border border-green-200 shadow-sm">
                          {s.actualStartTime ? Math.floor((Date.now() - s.actualStartTime) / 60000) : 0}m
                        </span>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">In Progress</p>
                      </div>
                   </div>
                ))
              )}
           </div>
        </section>

        {/* EXTRA HOURS REQUEST */}
        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl space-y-8 flex flex-col hover:border-rose-400/30 transition-all">
           <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${messQueue.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Extra Hour Logs</h3>
              </div>
              {messQueue.length > 0 && <span className="bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">{messQueue.length}</span>}
           </div>
           <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
              {messQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                   <span className="text-4xl mb-4">⌛</span>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Budget Clear</p>
                   <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300 mt-1">NO PENDING ALERTS</p>
                </div>
              ) : (
                messQueue.map(s => (
                   <div key={s.id} className="bg-rose-50/50 p-6 rounded-[2.5rem] border-2 border-rose-100 shadow-sm space-y-5 hover:bg-rose-50 hover:border-rose-200 transition-all">
                      <div className="text-left">
                         <p className="text-xs font-black uppercase text-slate-900 tracking-tight">{s.propertyName}</p>
                         <div className="mt-3 p-3 bg-white rounded-2xl border border-rose-100 shadow-inner">
                            <p className="text-[10px] text-rose-700 font-bold italic leading-relaxed">"{s.messReport?.description}"</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <button onClick={() => handleExtraHoursDecision(s.id, 'approved', 'Authorized.')} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">Approve</button>
                         <button onClick={() => handleExtraHoursDecision(s.id, 'rejected', 'Declined.')} className="flex-1 bg-white border-2 border-rose-200 text-rose-600 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all">Deny</button>
                      </div>
                   </div>
                ))
              )}
           </div>
        </section>
      </div>

      {/* INCIDENT CENTER */}
      <section className="bg-white border border-slate-200 p-10 rounded-[60px] shadow-2xl space-y-12 mt-4 hover:border-teal-500/20 transition-all">
         <div className="flex justify-between items-center border-b border-slate-100 pb-8">
            <div className="flex items-center gap-5">
               <div className="w-2 h-12 bg-slate-900 rounded-full shadow-sm"></div>
               <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-[0.4em]">Field Incident Center</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">CROSS-ASSET TECHNICAL & DAMAGE INTELLIGENCE</p>
               </div>
            </div>
            {shiftsWithIncidents.length > 0 && (
               <span className="text-[10px] font-black bg-rose-600 text-white px-5 py-2 rounded-full uppercase tracking-widest animate-pulse shadow-lg shadow-rose-900/10">
                 {shiftsWithIncidents.length} LIVE INCIDENTS
               </span>
            )}
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shiftsWithIncidents.map((shift) => {
               const maintenanceCount = shift.maintenanceReports?.filter(r => r.status !== 'resolved').length || 0;
               const damageCount = shift.damageReports?.filter(r => r.status !== 'resolved').length || 0;
               const missingCount = shift.missingReports?.filter(r => r.status !== 'resolved').length || 0;
               return (
                  <div key={shift.id} className="p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8 transition-all group hover:border-teal-500/30 bg-white flex flex-col justify-between hover:-translate-y-1 active:scale-[0.99]">
                     <div className="space-y-5 text-left">
                        <div className="space-y-2">
                           <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-teal-700 transition-colors">{shift.propertyName}</h4>
                           <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2 italic">
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             Log Reference: {shift.date}
                           </p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                           {maintenanceCount > 0 && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 tracking-tighter">{maintenanceCount} MAINTENANCE</span>}
                           {damageCount > 0 && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl border border-amber-200 tracking-tighter">{damageCount} DAMAGE</span>}
                           {missingCount > 0 && <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-3 py-1.5 rounded-xl border border-purple-200 tracking-tighter">{missingCount} MISSING</span>}
                        </div>
                     </div>
                     <button onClick={() => setViewingIncidentShift(shift)} className="w-full bg-slate-900 text-white font-black py-4.5 rounded-3xl uppercase text-[10px] tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95 mt-4">Review Logs</button>
                  </div>
               );
            })}
            {shiftsWithIncidents.length === 0 && (
               <div className="col-span-full py-40 text-center flex flex-col items-center justify-center bg-slate-50 rounded-[4rem] border border-dashed border-slate-200">
                  <span className="text-6xl mb-6">🛡️</span>
                  <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-400">Security Shield Active</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mt-2">NO UNRESOLVED FIELD REPORTS DETECTED</p>
               </div>
            )}
         </div>
      </section>

      {/* Incident Viewing Modal */}
      {viewingIncidentShift && (
         <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
            <div className="bg-white border border-teal-100 rounded-[56px] w-full max-w-5xl p-10 md:p-14 space-y-10 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar border-2 border-slate-100">
               <button onClick={() => setViewingIncidentShift(null)} className="absolute top-10 right-10 w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-black hover:bg-white hover:shadow-md transition-all">&times;</button>
               <header className="space-y-2 pr-12 text-left border-b border-slate-100 pb-8">
                  <h3 className="text-3xl font-black uppercase text-slate-900 tracking-tighter leading-none">{viewingIncidentShift.propertyName}</h3>
                  <p className="text-[11px] font-black text-teal-600 uppercase tracking-[0.4em]">Comprehensive Field Report Analysis</p>
               </header>
               <div className="space-y-12 text-left">
                  {['maintenance', 'damage', 'missing'].map((type) => {
                     const field = type === 'maintenance' ? 'maintenanceReports' : type === 'damage' ? 'damageReports' : 'missingReports';
                     const reports = (viewingIncidentShift as any)[field] as SpecialReport[] || [];
                     if (reports.length === 0) return null;
                     return (
                        <div key={type} className="space-y-6">
                           <div className="flex items-center gap-4">
                              <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em] border-l-4 border-teal-500 pl-4 capitalize">{type}</h4>
                              <div className="h-px flex-1 bg-slate-100"></div>
                           </div>
                           <div className="grid grid-cols-1 gap-4">
                              {reports.map((r, i) => (
                                 <div key={i} className={`bg-slate-50 p-8 rounded-[3rem] border transition-all ${r.status === 'resolved' ? 'border-gray-100 opacity-60 bg-gray-50' : 'border-slate-200 shadow-sm hover:border-teal-500/20'} flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between`}>
                                    <div className="flex-1 space-y-5">
                                       <p className="text-sm text-slate-900 font-semibold italic leading-relaxed tracking-tight">"{r.description}"</p>
                                       <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                          {r.photos?.map((url, idx) => (
                                             <img key={idx} src={url} onClick={() => setZoomedImage(url)} className="w-24 h-24 rounded-3xl object-cover border-2 border-white shadow-lg cursor-zoom-in hover:scale-105 transition-transform shrink-0" />
                                          ))}
                                       </div>
                                       {r.assignedToName && (
                                          <div className="flex items-center gap-2 bg-indigo-50 w-fit px-4 py-1.5 rounded-full border border-indigo-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>
                                            <p className="text-[10px] text-indigo-700 font-black uppercase tracking-widest">Assigned: {r.assignedToName}</p>
                                          </div>
                                       )}
                                    </div>
                                    {r.status !== 'resolved' && (
                                       <div className="flex gap-3 shrink-0 w-full lg:w-auto">
                                          <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="flex-1 lg:flex-none bg-slate-900 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 hover:bg-black transition-all">Assign Staff</button>
                                          <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="flex-1 lg:flex-none bg-white border-2 border-slate-200 text-slate-500 px-10 py-4 rounded-2xl text-[10px] font-black uppercase hover:border-teal-500 hover:text-teal-600 transition-colors shadow-sm">Mark Resolved</button>
                                       </div>
                                    )}
                                 </div>
                              ))}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         </div>
      )}

      {assigningReport && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95">
           <div className="bg-white border border-teal-100 rounded-[50px] w-full max-w-lg p-10 md:p-14 space-y-10 shadow-2xl relative text-left">
              <button onClick={() => setAssigningReport(null)} className="absolute top-10 right-10 text-slate-400 hover:text-black">&times;</button>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tighter leading-none">Assign Resource</h3>
                 <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em]">Operational Support Selection</p>
              </div>
              <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                 {assignableStaff.map(u => (
                   <button key={u.id} onClick={() => handleAssignIncident(u.id)} className="w-full flex items-center justify-between p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] hover:border-teal-600 hover:bg-white hover:shadow-xl transition-all group">
                      <div className="text-left flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 font-black text-sm group-hover:bg-teal-600 group-hover:text-white transition-colors">{u.name.charAt(0)}</div>
                         <div className="space-y-0.5">
                            <p className="text-xs font-black text-slate-900 uppercase group-hover:text-teal-700 transition-colors">{u.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{u.role}</p>
                         </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 group-hover:text-teal-600 transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/98 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[90vh] object-contain rounded-[2rem] shadow-2xl border-4 border-white/5" alt="Evidence Preview" />
          <div className="absolute top-8 right-8 text-white text-3xl font-black">&times;</div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
