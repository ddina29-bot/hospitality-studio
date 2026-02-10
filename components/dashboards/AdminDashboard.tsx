
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
  const resolutionFileRef = useRef<HTMLInputElement>(null);

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
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

  const pendingLeaves = useMemo(() => leaveRequests.filter(l => l.status === 'pending'), [leaveRequests]);

  const leaderboard = useMemo(() => {
    const cleaners = (users || []).filter(u => u.role === 'cleaner');
    return cleaners.map(u => {
      const myShifts = shifts.filter(s => s.userIds.includes(u.id) && s.status === 'completed');
      const approved = myShifts.filter(s => s.approvalStatus === 'approved').length;
      const score = myShifts.length === 0 ? 0 : Math.round((approved / myShifts.length) * 100);
      return { ...u, score, count: myShifts.length };
    })
    .filter(u => u.count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  }, [users, shifts]);

  const supplyDebtUnits = useMemo(() => {
    return shifts.filter(s => 
      s.status === 'completed' && 
      s.isLinenShortage && 
      !s.isDelivered
    );
  }, [shifts]);

  const handleForceClockOut = (shiftId: string, propertyName: string) => {
    if (!window.confirm(`EMERGENCY ACTION: Forcefully clock-out staff from ${propertyName}?\n\nUse this only if staff has lost internet or left without clocking out.`)) {
      return;
    }
    setShifts(prev => prev.map(s => s.id === shiftId ? ({
      ...s,
      status: 'completed',
      actualEndTime: Date.now(),
      approvalStatus: 'pending',
      approvalComment: 'SYSTEM: Emergency Admin Force Clock-Out (Staff Offline).'
    } as Shift) : s));
    alert("Shift terminated. Moving to Audit Queue.");
  };

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
    const assigneeName = users?.find(u => u.id === userId)?.name || 'Unknown';
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
    return (users || []).filter(u => ['maintenance', 'outsourced_maintenance', 'driver', 'housekeeping', 'supervisor', 'admin'].includes(u.role) && u.status === 'active');
  }, [users]);

  const shiftsWithIncidents = useMemo(() => {
    return shifts.filter(s => {
      const hasMaintenance = s.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  const pendingManualTasks = useMemo(() => manualTasks.filter(t => t.status === 'pending'), [manualTasks]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-24 w-full overflow-x-hidden">
      <header className="px-1 mb-1">
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Studio Hub</h2>
        <p className="text-[9px] md:text-[11px] text-teal-600 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-3 leading-none">REAL-TIME OVERSIGHT</p>
      </header>

      {/* OPERATIONAL LEADERBOARD */}
      {leaderboard.length > 0 && (
         <section className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <svg width="150" height="150" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div className="relative z-10 space-y-6">
               <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Operator Leaderboard</h3>
                    <p className="text-[8px] font-black text-teal-400 uppercase tracking-[0.4em] mt-1">Automatic Quality Ranking</p>
                  </div>
                  <span className="text-[9px] font-black bg-teal-500 text-black px-4 py-1 rounded-full uppercase tracking-widest">A+ Performers</span>
               </div>
               <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {leaderboard.map((u, i) => (
                    <div key={u.id} className="min-w-[180px] bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col items-center text-center gap-4 hover:bg-white/10 transition-all cursor-pointer shadow-lg group">
                       <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xl border border-teal-500/30 overflow-hidden">
                             {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                          </div>
                          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-white text-slate-900 border-2 border-slate-900 flex items-center justify-center font-black text-[10px] shadow-lg">#{i+1}</div>
                       </div>
                       <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight truncate w-full">{u.name.split(' ')[0]}</p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                             <span className="text-[10px] font-black text-teal-400">{u.score}% QI</span>
                             <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                             <span className="text-[8px] font-bold text-white/40 uppercase">{u.count} JOBS</span>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </section>
      )}

      {/* URGENT: SUPPLY DEBT */}
      {supplyDebtUnits.length > 0 && (
        <section className="bg-white border-2 border-rose-200 p-6 md:p-10 rounded-[2.5rem] md:rounded-[60px] shadow-2xl space-y-8 animate-in slide-in-from-top-4">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
              <div className="flex items-center gap-4 md:gap-6">
                 <div className="w-14 h-14 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] bg-rose-600 flex items-center justify-center text-white font-black text-2xl md:text-4xl shadow-2xl">📦</div>
                 <div className="space-y-1">
                    <h3 className="text-lg md:text-xl font-black text-rose-900 uppercase tracking-tighter leading-none">Supply Debt Alert</h3>
                    <p className="text-[9px] md:text-[11px] font-bold text-rose-500 uppercase tracking-widest mt-1">Units Cleaned but "Unmade" (Needs Linen & Packs)</p>
                 </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                 <span className="text-[10px] md:text-xs font-black bg-rose-600 text-white px-6 py-2 rounded-full uppercase tracking-widest shadow-lg animate-pulse">{supplyDebtUnits.length} UNITS AT RISK</span>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supplyDebtUnits.map(s => (
                <div key={s.id} className="bg-rose-50/30 border border-rose-100 p-6 rounded-[2rem] md:rounded-[3rem] flex flex-col justify-between gap-8 group hover:bg-white hover:border-rose-300 transition-all shadow-sm">
                   <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[11px] md:text-xs font-black uppercase text-rose-900 tracking-tight leading-tight">{s.propertyName}</p>
                        <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">Finished: {s.date}</p>
                      </div>
                      <div className="bg-white/60 p-3 rounded-xl border border-rose-100">
                        <p className="text-[9px] font-bold text-rose-700 leading-relaxed italic">Unit requires professional styling and welcome packs before guest arrival.</p>
                      </div>
                   </div>
                   <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                            setActiveTab('shifts');
                        }} 
                        className="w-full bg-rose-600 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-rose-700"
                      >
                        ASSIGN BEDS ONLY SHIFT
                      </button>
                      <button 
                        onClick={() => setActiveTab('logistics')}
                        className="w-full bg-white text-rose-400 border border-rose-100 py-3 rounded-2xl text-[8px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                      >
                        CHECK LOGISTICS STATUS
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </section>
      )}

      {/* PRIMARY ACTION: SUPPLY REQUISITIONS */}
      {pendingSupplies.length > 0 && (
        <section className="bg-white border-2 border-indigo-200 p-5 md:p-8 rounded-3xl md:rounded-[40px] shadow-2xl space-y-4 md:space-y-6 animate-in slide-in-from-top-3">
           <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-xl">📦</div>
                 <div className="space-y-0">
                    <h3 className="text-xs md:text-sm font-black text-indigo-900 uppercase tracking-widest leading-none">Supply Requisitions</h3>
                    <p className="text-[7px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Pending Logistics</p>
                 </div>
              </div>
              <span className="text-[8px] md:text-[10px] font-black bg-indigo-600 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-full uppercase tracking-widest shadow-md">{Object.keys(groupedSupplies).length} QUEUED</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {(Object.entries(groupedSupplies) as [string, SupplyRequest[]][]).map(([uid, batch]) => (
                 <div key={uid} className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-indigo-100 shadow-sm space-y-4 md:space-y-5 hover:border-indigo-300 transition-colors">
                    <div className="text-left">
                       <p className="text-[10px] md:text-xs font-black uppercase text-slate-900 tracking-tight border-b border-indigo-100 pb-1.5 md:pb-2">{batch[0].userName}</p>
                       <div className="mt-2.5 md:mt-3 space-y-1.5 md:space-y-2">
                          {batch.map(b => (
                             <p key={b.id} className="text-[9px] md:text-11px text-indigo-900 font-bold uppercase flex justify-between items-center">
                                <span className="opacity-70 truncate pr-2">{b.itemName}</span>
                                <span className="bg-white px-1.5 md:px-2 py-0.5 rounded-lg border border-indigo-50 text-[8px] md:text-[9px] font-black shrink-0">x{b.quantity}</span>
                             </p>
                          ))}
                       </div>
                    </div>
                    <div className="flex gap-2 md:gap-3 pt-1">
                       <button onClick={() => handleApproveSupplies(batch)} className="flex-[2] bg-indigo-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">APPROVE</button>
                       <button onClick={() => setSupplyRequests?.(prev => prev.filter(r => !batch.map(b => b.id).includes(r.id)))} className="flex-1 border border-indigo-100 text-indigo-300 py-3 md:py-4 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">DENY</button>
                    </div>
                 </div>
              ))}
           </div>
        </section>
      )}

      {/* LEAVE APPROVAL STRIP */}
      {pendingLeaves.length > 0 && (
        <section className="bg-[#FDF8EE] border border-slate-200 p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm space-y-6 animate-in slide-in-from-right-4">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shadow-sm">⛱️</div>
                 <div>
                    <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Absence Requests</h3>
                    <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pending Approval</p>
                 </div>
              </div>
              <span className="text-[8px] md:text-[10px] font-black bg-amber-100 text-amber-800 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">{pendingLeaves.length} REQUESTS</span>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {pendingLeaves.map(l => (
                <div key={l.id} className="min-w-[320px] bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between gap-6 transition-all hover:border-indigo-100">
                   <div className="text-left space-y-2">
                      <p className="text-xs font-black uppercase text-slate-900 tracking-tight">{l.userName}</p>
                      <div className="flex items-center gap-2">
                         <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">{l.type}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">• {l.startDate} TO {l.endDate}</span>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => onUpdateLeaveStatus?.(l.id, 'approved')} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">APPROVE</button>
                      <button onClick={() => onUpdateLeaveStatus?.(l.id, 'rejected')} className="flex-1 border-2 border-rose-100 text-rose-600 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-95">DENY</button>
                   </div>
                </div>
              ))}
           </div>
        </section>
      )}

      {/* MANUAL TASK COMMAND ROW */}
      <div className="w-full bg-slate-900 rounded-2xl md:rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 shadow-lg animate-in slide-in-from-right duration-500">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* AWAITING AUDIT */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl space-y-6 md:space-y-8 flex flex-col hover:border-teal-400/30 transition-all">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
             <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${reviewQueue.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <h2 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Awaiting Audit</h2>
             </div>
             {reviewQueue.length > 0 && <span className="bg-emerald-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{reviewQueue.length}</span>}
          </div>
          <div className="space-y-3 md:space-y-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                 <span className="text-3xl md:text-4xl mb-3 md:mb-4">✨</span>
                 <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Clear</p>
              </div>
            ) : (
              reviewQueue.slice(0, 3).map(shift => (
                <div key={shift.id} className="bg-teal-50/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-teal-100 shadow-sm flex flex-col gap-4 md:gap-5 group hover:bg-teal-50 transition-all">
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

        {/* LIVE FIELD STAFF */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl space-y-6 md:space-y-8 flex flex-col hover:border-emerald-400/30 transition-all">
           <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
              <div className="flex items-center gap-2 md:gap-3">
                 <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${activeOps.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h2 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Field</h2>
              </div>
              {activeOps.length > 0 && <span className="bg-green-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{activeOps.length}</span>}
           </div>
           <div className="space-y-2.5 md:space-y-3 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar no-scrollbar">
              {activeOps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                   <span className="text-3xl md:text-4xl mb-3 md:mb-4">📡</span>
                   <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Standby</p>
                </div>
              ) : (
                activeOps.map(s => (
                   <div key={s.id} className="flex justify-between items-center p-3.5 md:p-5 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100 group hover:bg-white hover:border-green-300 transition-all shadow-sm">
                      <div className="min-w-0 flex-1 text-left pr-2">
                         <p className="text-10px md:text-xs font-black uppercase truncate text-slate-900 tracking-tight">{s.propertyName}</p>
                         <p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate mt-0.5">{s.userIds.map(id => users?.find(u => u.id === id)?.name.split(' ')[0]).join(' & ')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[8px] md:text-[10px] font-mono text-green-700 font-black bg-green-100 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-green-200">
                          {s.actualStartTime ? Math.floor((Date.now() - s.actualStartTime) / 60000) : 0}m
                        </span>
                        <button 
                          onClick={() => handleForceClockOut(s.id, s.propertyName)}
                          className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          title="Emergency Force Stop"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        </button>
                      </div>
                   </div>
                ))
              )}
           </div>
        </section>

        {/* EXTRA HOURS REQUEST */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[48px] border border-slate-200 shadow-xl space-y-6 md:space-y-8 flex flex-col hover:border-rose-400/30 transition-all">
           <div className="flex justify-between items-center border-b border-slate-100 pb-3 md:pb-4">
              <div className="flex items-center gap-2 md:gap-3">
                 <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${messQueue.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <h3 className="text-[9px] md:text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] md:tracking-[0.3em]">Extra Hour Log</h3>
              </div>
              {messQueue.length > 0 && <span className="bg-rose-600 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{messQueue.length}</span>}
           </div>
           <div className="space-y-3 md:space-y-4 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar pr-1 no-scrollbar">
              {messQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 md:py-16 text-center opacity-30">
                   <span className="text-3xl md:text-4xl mb-3 md:mb-4">⌛</span>
                   <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Clear</p>
              </div>
            ) : (
                messQueue.map(s => (
                   <div key={s.id} className="bg-rose-50/50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-rose-100 shadow-sm space-y-3 md:space-y-5 hover:bg-rose-50 transition-all">
                      <div className="text-left">
                         <p className="text-10px md:text-xs font-black uppercase text-slate-900 tracking-tight truncate border-b border-rose-100 pb-1.5">{s.propertyName}</p>
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
      <section className="bg-white border border-slate-200 p-6 md:p-10 rounded-[2.5rem] md:rounded-[60px] shadow-2xl space-y-8 md:space-y-12 mt-2 hover:border-teal-500/20 transition-all">
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
                  <div key={shift.id} className="p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-xl space-y-6 md:space-y-8 transition-all group hover:border-teal-500/30 bg-white flex flex-col justify-between hover:-translate-y-1 active:scale-[0.99]">
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
                     <button onClick={() => setViewingIncidentShift(shift)} className="w-full bg-slate-900 text-white font-black py-3.5 md:py-4.5 rounded-2xl md:rounded-3xl uppercase text-[8px] md:text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all mt-4">Review</button>
                  </div>
               );
            })}
            {shiftsWithIncidents.length === 0 && (
               <div className="col-span-full py-20 md:py-40 text-center flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] md:rounded-[4rem] border border-dashed border-slate-200">
                  <span className="text-4xl md:text-6xl mb-4 md:mb-6">🛡️</span>
                  <p className="text-xs md:text-sm font-black uppercase tracking-[0.4em] text-slate-400">Registry Clear</p>
               </div>
            )}
         </div>
      </section>

      {/* Manual Task Modal */}
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

      {/* Incident Viewing Modal */}
      {viewingIncidentShift && (
         <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-2 md:p-6 backdrop-blur-md animate-in fade-in">
            <div className="bg-white border border-teal-100 rounded-[2rem] md:rounded-[56px] w-full max-w-5xl p-6 md:p-14 space-y-8 md:space-y-10 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar border-2 border-slate-100">
               <button onClick={() => setViewingIncidentShift(null)} className="absolute top-6 md:top-10 right-6 md:right-10 w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-black transition-all">&times;</button>
               <header className="space-y-1.5 md:space-y-2 pr-10 text-left border-b border-slate-100 pb-6 md:pb-8">
                  <h3 className="text-2xl md:text-3xl font-black uppercase text-slate-900 tracking-tighter leading-none truncate">{viewingIncidentShift.propertyName}</h3>
                  <p className="text-[9px] md:text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] md:tracking-[0.4em]">Field Report Analysis</p>
               </header>
               <div className="space-y-8 md:space-y-12 text-left">
                  {['maintenance', 'damage', 'missing'].map((type) => {
                     const field = type === 'maintenance' ? 'maintenanceReports' : type === 'damage' ? 'damageReports' : 'missingReports';
                     const reports = (viewingIncidentShift as any)[field] as SpecialReport[] || [];
                     if (reports.length === 0) return null;
                     return (
                        <div key={type} className="space-y-4 md:space-y-6">
                           <div className="flex items-center gap-3 md:gap-4">
                              <h4 className="text-[10px] md:text-[12px] font-black text-slate-900 uppercase tracking-[0.3em] border-l-4 border-teal-500 pl-3 md:pl-4 capitalize">{type}</h4>
                              <div className="h-px flex-1 bg-slate-100"></div>
                           </div>
                           <div className="grid grid-cols-1 gap-3 md:gap-4">
                              {reports.map((r, i) => (
                                 <div key={i} className={`bg-slate-50 p-5 md:p-8 rounded-3xl md:rounded-[3rem] border transition-all ${r.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-slate-200 shadow-sm'} flex flex-col lg:row-span-1 gap-6 md:gap-8`}>
                                    <div className="flex-1 space-y-4 md:space-y-5">
                                       <p className="text-xs md:text-sm text-slate-900 font-semibold italic leading-relaxed tracking-tight">"{r.description}"</p>
                                       <div className="flex gap-3 md:gap-4 overflow-x-auto pb-1 no-scrollbar">
                                          {r.photos?.map((url, idx) => (
                                             <img key={idx} src={url} onClick={() => setZoomedImage(url)} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl object-cover border-2 border-white shadow-lg cursor-zoom-in shrink-0" />
                                          ))}
                                       </div>
                                       {r.assignedToName && (
                                          <div className="flex items-center gap-2 bg-indigo-50 w-fit px-3 py-1 rounded-full border border-indigo-100">
                                            <div className="w-1 h-1 rounded-full bg-indigo-600 animate-pulse"></div>
                                            <p className="text-[8px] md:text-[10px] text-indigo-700 font-black uppercase tracking-widest">Assignee: {r.assignedToName}</p>
                                          </div>
                                       )}
                                    </div>
                                    {r.status !== 'resolved' && (
                                       <div className="flex gap-2.5 md:gap-3 shrink-0">
                                          <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="flex-1 bg-slate-900 text-white px-4 md:px-10 py-3.5 rounded-xl md:rounded-2xl text-[8px] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Assign</button>
                                          <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="flex-1 bg-white border border-slate-200 text-slate-500 px-4 md:px-10 py-3.5 rounded-xl md:rounded-2xl text-[8px] text-[10px] font-black uppercase active:scale-95 transition-all">Resolve</button>
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
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-2 md:p-6 backdrop-blur-xl animate-in zoom-in-95">
           <div className="bg-white border border-teal-100 rounded-[2.5rem] md:rounded-[50px] w-full max-w-lg p-8 md:p-14 space-y-8 md:space-y-10 shadow-2xl relative text-left">
              <button onClick={() => setAssigningReport(null)} className="absolute top-8 right-8 text-slate-400 hover:text-black">&times;</button>
              <div className="space-y-1.5 md:space-y-2">
                 <h3 className="text-xl md:text-2xl font-black uppercase text-slate-900 tracking-tighter leading-none">Assign Resource</h3>
                 <p className="text-[9px] md:text-[10px] font-black text-teal-600 uppercase tracking-[0.4em]">Selection</p>
              </div>
              <div className="space-y-2.5 md:space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1 no-scrollbar">
                 {assignableStaff.map(u => (
                   <button key={u.id} onClick={() => handleAssignIncident(u.id)} className="w-full flex items-center justify-between p-4 md:p-6 bg-slate-50 border-2 border-transparent rounded-[1.5rem] md:rounded-[2rem] hover:border-teal-600 hover:bg-white transition-all group">
                      <div className="text-left flex items-center gap-3 md:gap-4 min-w-0">
                         <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 font-black text-xs md:text-sm group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">{u.name.charAt(0)}</div>
                         <div className="min-w-0">
                            <p className="text-xs md:text-sm font-black text-slate-900 uppercase group-hover:text-teal-700 transition-colors truncate">{u.name}</p>
                            <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{u.role}</p>
                         </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
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
