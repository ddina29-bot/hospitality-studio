import React, { useState, useMemo, useRef } from 'react';
import { TabType, Shift, User, SupplyRequest, LeaveRequest, ManualTask, SpecialReport, Property } from '../../types';
import { uploadFile } from '../../services/storageService';
import AddTaskModal from '../management/AddTaskModal';

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
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => void;
  onAuditDeepLink?: (shiftId: string) => void;
  onOpenManualTask?: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  onResolveLogistics?: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onToggleLaundryPrepared?: (shiftId: string) => void;
  authorizedLaundryUserIds?: string[];
  onToggleAuthority?: (userId: string) => void;
  properties?: Property[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, setActiveTab, onLogout, shifts = [], setShifts, users = [], supplyRequests = [], setSupplyRequests, leaveRequests = [], onUpdateLeaveStatus, onAuditDeepLink, onOpenManualTask,
  onResolveLogistics, onToggleLaundryPrepared, authorizedLaundryUserIds = [], onToggleAuthority,
  manualTasks = [], setManualTasks, properties = []
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);
  const [assigningReport, setAssigningReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  
  const [resolvingReport, setResolvingReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showSupervisorAssignModal, setShowSupervisorAssignModal] = useState<string | null>(null);
  const [savedTaskNames, setSavedTaskNames] = useState<string[]>(['Buy Batteries', 'Replace Lightbulb', 'Check Balcony Drain', 'Linen Inventory Count']);

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

  const activeSupervisors = useMemo(() => users?.filter(u => u.role === 'supervisor' && u.status === 'active') || [], [users]);

  const bedsNotDone = useMemo(() => {
    return shifts.filter(s => 
      s.isPublished && 
      !s.excludeLaundry && 
      !s.isDelivered && 
      ['Check out/check in', 'REFRESH', 'MID STAY CLEANING', 'BEDS ONLY'].includes(s.serviceType)
    );
  }, [shifts]);

  const handleAssignToSupervisorForBeds = (shiftId: string, supervisorId: string) => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return {
          ...s,
          userIds: [supervisorId],
          serviceType: 'BEDS ONLY',
          notes: (s.notes || '') + '\n[AUTO-HANDOVER] Cleaner partially cleaned. Supervisor to finish beds and final check.',
          status: 'pending' 
        };
      }
      return s;
    }));
    setShowSupervisorAssignModal(null);
    alert("Unit handed over to supervisor for final beds.");
  };

  const handleForceStop = (shiftId: string, cleanerName: string) => {
    if (!window.confirm(`EMERGENCY FORCE CHECK-OUT for ${cleanerName.toUpperCase()}?\n\nThis will remotely terminate their session. Use only if they left the property without checking out.`)) return;
    setShifts(prev => prev.map(s => s.id === shiftId ? { 
        ...s, 
        status: 'completed', 
        actualEndTime: Date.now(), 
        approvalStatus: 'pending',
        approvalComment: `MANAGEMENT EMERGENCY FORCE STOP: Remote check-out performed by Admin.`
    } : s));
  };

  const handleApproveSupplies = (batch: SupplyRequest[]) => {
    if (!setSupplyRequests || !setShifts) return;
    const ids = batch.map(r => r.id);
    setSupplyRequests(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'approved' } : r));
    const now = new Date();
    let deliveryDate = new Date();
    if (now.getHours() >= 11) { deliveryDate.setDate(deliveryDate.getDate() + 1); }
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
    alert(`Supplies approved. Task routed to drivers for ${dateStr}.`);
  };

  const handleSaveManualTask = (taskData: Partial<ManualTask>) => {
    if (!setManualTasks) return;
    const newTask: ManualTask = {
        ...taskData,
        id: `mt-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
    } as ManualTask;
    setManualTasks(prev => [newTask, ...prev]);
    setShowAddTaskModal(false);
  };

  const handleExtraHoursDecision = (shiftId: string, decision: 'approved' | 'rejected', note: string) => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId && s.messReport) {
        return { ...s, messReport: { ...s.messReport, status: decision, decisionNote: note } };
      }
      return s;
    }));
  };

  const shiftsWithIncidents = useMemo(() => {
    return shifts.filter(s => {
      const hasMaintenance = s.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-24 w-full overflow-x-hidden">
      <header className="px-1 mb-1">
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Studio Hub</h2>
        <p className="text-[9px] md:text-[11px] text-teal-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-3 leading-none">REAL-TIME OVERSIGHT</p>
      </header>

      {/* BEDS NOT DONE SECTION */}
      {bedsNotDone.length > 0 && (
        <section className="bg-white border-2 border-rose-200 p-5 md:p-8 rounded-3xl md:rounded-[40px] shadow-2xl space-y-4 md:space-y-6">
           <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-xl">🛌</div>
                 <div className="space-y-0">
                    <h3 className="text-xs md:text-sm font-black text-rose-900 uppercase tracking-widest leading-none">Beds Not Done</h3>
                    <p className="text-[7px] md:text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1">Linen Logic Oversight</p>
                 </div>
              </div>
              <span className="text-[8px] md:text-[10px] font-black bg-rose-600 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-full uppercase tracking-widest shadow-md">{bedsNotDone.length} UNITS BLOCKED</span>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bedsNotDone.map(s => (
                <div key={s.id} className={`bg-rose-50 border p-4 rounded-2xl flex flex-col justify-between transition-all ${s.partialProgress ? 'border-amber-400 ring-2 ring-amber-100 shadow-lg' : 'border-rose-100'}`}>
                   <div>
                      <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black uppercase text-rose-900 truncate flex-1">{s.propertyName}</p>
                        {s.partialProgress && <span className="bg-amber-500 text-white text-[7px] font-black px-2 py-0.5 rounded-lg uppercase animate-pulse shrink-0 ml-2">Cleaned - No Linen</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.isCleanLinenTakenFromOffice ? 'bg-amber-500' : 'bg-rose-600 animate-ping'}`}></div>
                        <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">
                          {s.isCleanLinenTakenFromOffice ? 'Status: In Transit' : 'Status: Waiting at Office'}
                        </p>
                      </div>
                   </div>
                   <div className="flex flex-col gap-2 mt-4">
                      {s.partialProgress && (
                        <button 
                            onClick={() => setShowSupervisorAssignModal(s.id)}
                            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all"
                        >
                            Finish with Supervisor
                        </button>
                      )}
                      <button 
                        onClick={() => setActiveTab('logistics')}
                        className="w-full bg-white text-rose-600 border border-rose-100 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
                      >
                        Dispatch Logistics
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </section>
      )}

      {/* TASK FORCE BUTTON */}
      <div className="w-full bg-slate-900 rounded-2xl md:rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 shadow-lg">
         <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <div className="p-1.5 md:p-2 bg-indigo-500/20 rounded-lg text-indigo-400 flex items-center justify-center shrink-0">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div className="text-left min-w-0">
               <h3 className="text-white text-xs md:text-sm font-black uppercase tracking-tight truncate">Task Force</h3>
               <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Deployment Dispatcher</p>
            </div>
         </div>
         <button 
             onClick={() => setShowAddTaskModal(true)}
             className="w-full md:w-auto bg-indigo-600 text-white px-5 md:px-6 h-10 md:h-10 rounded-xl md:rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
         >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>
             ADD MANUAL TASK
         </button>
      </div>

      {/* CORE QUEUES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* AWAITING AUDIT */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
             <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${reviewQueue.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <h2 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Awaiting Audit</h2>
             </div>
             {reviewQueue.length > 0 && <span className="bg-emerald-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{reviewQueue.length}</span>}
          </div>
          <div className="space-y-3 md:space-y-4 flex-1 pt-4">
            {reviewQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                 <span className="text-3xl md:text-4xl mb-3 md:mb-4">✨</span>
                 <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Clear</p>
              </div>
            ) : (
              reviewQueue.slice(0, 3).map(shift => (
                <div key={shift.id} className="bg-teal-50/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-teal-100 shadow-sm flex flex-col gap-4 group transition-all">
                   <div className="text-left min-w-0">
                      <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase leading-tight tracking-tight truncate">{shift.propertyName}</h4>
                      <p className="text-[8px] md:text-[9px] text-teal-700 font-black uppercase mt-1 tracking-widest truncate">{shift.startTime} • READY</p>
                   </div>
                   <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-teal-600 text-white py-3 rounded-xl md:rounded-2xl font-black uppercase text-[8px] md:text-[9px] tracking-[0.2em] shadow-lg hover:bg-teal-700 transition-all active:scale-95">Open</button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* LIVE FIELD (with EMERGENCY FORCE STOP) */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
           <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
              <div className="flex items-center gap-2 md:gap-3">
                 <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${activeOps.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h2 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Field</h2>
              </div>
              {activeOps.length > 0 && <span className="bg-green-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{activeOps.length}</span>}
           </div>
           <div className="space-y-2.5 md:space-y-3 flex-1 pt-4">
              {activeOps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                   <span className="text-3xl md:text-4xl mb-3 md:mb-4">📡</span>
                   <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Standby</p>
                </div>
              ) : (
                activeOps.slice(0, 4).map(s => {
                   const cleanerName = s.userIds.map(id => users?.find(u => u.id === id)?.name.split(' ')[0]).join(' & ');
                   return (
                    <div key={s.id} className="flex justify-between items-center p-3.5 md:p-5 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100 group hover:bg-white hover:border-green-300 transition-all shadow-sm">
                        <div className="min-w-0 flex-1 text-left pr-2">
                            <p className="text-[10px] md:text-xs font-black uppercase truncate text-slate-900 tracking-tight">{s.propertyName}</p>
                            <p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate mt-0.5">{cleanerName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[8px] md:text-[10px] font-mono text-green-700 font-black bg-green-100 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-green-200">
                                {s.actualStartTime ? Math.floor((Date.now() - s.actualStartTime) / 60000) : 0}m
                            </span>
                            <button 
                                onClick={() => handleForceStop(s.id, cleanerName)}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm hover:bg-rose-100 transition-all"
                                title="FORCE EMERGENCY CHECK-OUT"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </button>
                        </div>
                    </div>
                   );
                })
              )}
           </div>
        </section>

        {/* EXTRA HOUR LOG */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
           <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
              <div className="flex items-center gap-2 md:gap-3">
                 <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${messQueue.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h3 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Extra Hour Log</h3>
              </div>
              {messQueue.length > 0 && <span className="bg-rose-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{messQueue.length}</span>}
           </div>
           <div className="space-y-3 md:space-y-4 flex-1 pt-4">
              {messQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                   <span className="text-3xl md:text-4xl mb-3 md:mb-4">⌛</span>
                   <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Clear</p>
              </div>
            ) : (
                messQueue.map(s => (
                   <div key={s.id} className="bg-rose-50/50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-rose-100 shadow-sm space-y-3 md:space-y-5 hover:bg-rose-50 transition-all">
                      <div className="text-left">
                         <p className="text-[10px] md:text-xs font-black uppercase text-slate-900 tracking-tight truncate border-b border-rose-100 pb-1.5">{s.propertyName}</p>
                         <div className="mt-2 md:mt-3 p-2.5 md:p-3 bg-white rounded-xl md:rounded-2xl border border-rose-100 shadow-inner">
                            <p className="text-[8px] md:text-[10px] text-rose-700 font-bold italic leading-tight">"{s.messReport?.description}"</p>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => handleExtraHoursDecision(s.id, 'approved', 'Authorized.')} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-md">Approve</button>
                         <button onClick={() => handleExtraHoursDecision(s.id, 'rejected', 'Declined.')} className="flex-1 bg-white border border-rose-200 text-rose-600 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest">Deny</button>
                      </div>
                   </div>
                ))
              )}
           </div>
        </section>
      </div>

      {/* INCIDENT CENTER */}
      <section className="bg-white border border-slate-200 p-6 md:p-10 rounded-[2.5rem] md:rounded-[60px] shadow-2xl space-y-8 md:space-y-12 mt-2">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4 md:pb-8">
            <div className="flex items-center gap-3 md:gap-5">
               <div className="w-1.5 md:w-2 h-8 md:h-12 bg-slate-900 rounded-full"></div>
               <div className="space-y-0.5">
                  <h2 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-[0.3em] md:tracking-[0.4em] leading-none">Incident Center</h2>
                  <p className="text-[7px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">TECHNICAL LOGS</p>
               </div>
            </div>
            {shiftsWithIncidents.length > 0 && (
               <span className="text-[7px] md:text-[10px] font-black bg-rose-600 text-white px-2.5 md:px-5 py-1 md:py-2 rounded-full uppercase tracking-widest animate-pulse shadow-lg shrink-0">
                 {shiftsWithIncidents.length} LIVE
               </span>
            )}
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {shiftsWithIncidents.slice(0, 6).map((shift) => {
               const maintenanceCount = shift.maintenanceReports?.filter(r => r.status !== 'resolved').length || 0;
               const damageCount = shift.damageReports?.filter(r => r.status !== 'resolved').length || 0;
               const missingCount = shift.missingReports?.filter(r => r.status !== 'resolved').length || 0;
               return (
                  <div key={shift.id} className="p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-xl space-y-6 transition-all group hover:border-teal-500/30 bg-white flex flex-col justify-between hover:-translate-y-1">
                     <div className="space-y-4 md:space-y-5 text-left">
                        <div className="space-y-1.5">
                           <h4 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-teal-700 transition-colors truncate">{shift.propertyName}</h4>
                           <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5 italic">
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             Log: {shift.date}
                           </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                           {maintenanceCount > 0 && <span className="text-[7px] md:text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg border border-blue-200">MAINTENANCE</span>}
                           {damageCount > 0 && <span className="text-[7px] md:text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">DAMAGE</span>}
                           {missingCount > 0 && <span className="text-[7px] md:text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded-lg border border-purple-200">MISSING</span>}
                        </div>
                     </div>
                     <button onClick={() => setViewingIncidentShift(shift)} className="w-full bg-slate-900 text-white font-black py-3.5 rounded-2xl md:rounded-3xl uppercase text-[8px] md:text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all mt-4">Review Reports</button>
                  </div>
               );
            })}
            {shiftsWithIncidents.length === 0 && (
               <div className="col-span-full py-20 md:py-40 text-center flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <span className="text-4xl md:text-6xl mb-4">🛡️</span>
                  <p className="text-xs md:text-sm font-black uppercase tracking-[0.4em] text-slate-400">Registry Clear</p>
               </div>
            )}
         </div>
      </section>

      {showAddTaskModal && (
        <AddTaskModal 
            onClose={() => setShowAddTaskModal(false)}
            onSave={handleSaveManualTask}
            properties={properties}
            users={users || []}
            savedTaskNames={savedTaskNames}
            onAddNewTaskName={(name) => setSavedTaskNames(prev => [...prev, name])}
        />
      )}

      {showSupervisorAssignModal && (
        <div className="fixed inset-0 bg-black/90 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95">
            <div className="bg-white rounded-[40px] w-full max-w-md p-8 space-y-8 shadow-2xl relative text-left">
                <button onClick={() => setShowSupervisorAssignModal(null)} className="absolute top-8 right-8 text-slate-400">&times;</button>
                <div className="space-y-1">
                    <h3 className="text-xl font-bold uppercase text-slate-900 tracking-tight">Assign Final Beds</h3>
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em]">Select Supervisor</p>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {activeSupervisors.length === 0 ? (
                        <p className="text-center py-10 text-[10px] uppercase font-black opacity-20">No active supervisors online</p>
                    ) : activeSupervisors.map(sup => (
                        <button 
                            key={sup.id}
                            onClick={() => handleAssignToSupervisorForBeds(showSupervisorAssignModal, sup.id)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">{sup.name.charAt(0)}</div>
                                <span className="text-[11px] font-black uppercase text-slate-900">{sup.name}</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-300 group-hover:text-indigo-600"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/98 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border-4 border-white/5" alt="Evidence Preview" />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;