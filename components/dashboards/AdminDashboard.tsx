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

  const pendingLeaves = useMemo(() => leaveRequests.filter(l => l.status === 'pending'), [leaveRequests]);

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
    if (!window.confirm(`FORCE TERMINATE SESSION for ${cleanerName.toUpperCase()}?\n\nUse this only if the staff member is stuck. They will be able to start new shifts immediately.`)) return;
    setShifts(prev => prev.map(s => s.id === shiftId ? { 
        ...s, 
        status: 'completed', 
        actualEndTime: Date.now(), 
        approvalStatus: 'pending',
        approvalComment: `MANAGEMENT FORCE STOP: Session terminated by Admin.`
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

      {/* Grid sections for Awaiting Audit, Live Field, etc follows standard logic */}
    </div>
  );
};

export default AdminDashboard;
