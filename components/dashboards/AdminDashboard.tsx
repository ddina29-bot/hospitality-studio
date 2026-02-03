
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
  user, setActiveTab, onLogout, shifts = [], setShifts, users = [], supplyRequests = [], leaveRequests = [], onAuditDeepLink, onOpenManualTask,
  onResolveLogistics, onToggleLaundryPrepared, authorizedLaundryUserIds = [], onToggleLaundryAuthority
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);
  const [assigningReport, setAssigningReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  
  const [resolvingReport, setResolvingReport] = useState<{ shiftId: string, report: SpecialReport, type: 'maintenance' | 'damage' | 'missing' } | null>(null);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const resolutionFileRef = useRef<HTMLInputElement>(null);

  const [showLaundryAccessModal, setShowLaundryAccessModal] = useState(false);

  const reviewQueue = useMemo(() => shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending'), [shifts]);
  const messQueue = useMemo(() => shifts.filter(s => s.messReport && s.messReport.status === 'pending'), [shifts]);
  const activeOps = useMemo(() => shifts.filter(s => s.status === 'active'), [shifts]);

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
    <div className="space-y-6 animate-in fade-in duration-700 text-left pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* MESS REPORTS ALERT (Extra Hours) */}
        {messQueue.length > 0 && (
           <section className="bg-red-50 border-2 border-red-500 p-6 rounded-[32px] shadow-xl space-y-4 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white">!</div>
                 <h3 className="text-xs font-black text-red-700 uppercase tracking-widest">Extra Hours Needed</h3>
              </div>
              <div className="space-y-3">
                 {messQueue.map(s => (
                    <div key={s.id} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm space-y-3">
                       <div className="text-left">
                          <p className="text-[10px] font-bold uppercase">{s.propertyName}</p>
                          <p className="text-[9px] text-red-600 italic">"{s.messReport?.description}"</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleExtraHoursDecision(s.id, 'approved', 'Extra time authorized.')} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-[8px] font-black uppercase">Approve</button>
                          <button onClick={() => handleExtraHoursDecision(s.id, 'rejected', 'Time limit exceeded.')} className="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-[8px] font-black uppercase">Deny</button>
                       </div>
                    </div>
                 ))}
              </div>
           </section>
        )}

        {/* VERIFICATION QUEUE */}
        <section className={`bg-white p-6 rounded-[32px] border-2 border-teal-600 shadow-xl space-y-6 ${reviewQueue.length === 0 ? 'opacity-30 grayscale' : ''}`}>
          <div className="flex justify-between items-center px-2">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${reviewQueue.length > 0 ? 'bg-teal-600 animate-bounce' : 'bg-gray-200'}`}></span>
                <h2 className="text-[9px] font-black text-black uppercase tracking-widest">AWAITING AUDIT</h2>
             </div>
             <span className="text-[8px] font-black text-teal-600">{reviewQueue.length}</span>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
            {reviewQueue.map(shift => (
              <div key={shift.id} className="bg-teal-50 p-4 rounded-2xl border border-teal-100 shadow-sm flex flex-col gap-3">
                 <div className="text-left">
                    <h4 className="text-xs font-bold text-black uppercase leading-tight">{shift.propertyName}</h4>
                    <p className="text-[8px] text-teal-600 font-black uppercase mt-1">{shift.startTime} • Completed</p>
                 </div>
                 <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-teal-600 text-white py-2 rounded-lg font-black uppercase text-[8px] tracking-widest">Start Verification</button>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE OPS */}
        <section className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-xl space-y-6">
           <div className="flex items-center gap-2 px-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <h2 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">LIVE FIELD STAFF</h2>
           </div>
           <div className="space-y-3">
              {activeOps.map(s => (
                 <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                       <p className="text-[10px] font-bold uppercase">{s.propertyName}</p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase">{s.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).join(' & ')}</p>
                    </div>
                    <span className="text-[9px] font-mono text-green-600 font-bold">{s.actualStartTime ? Math.floor((Date.now() - s.actualStartTime) / 60000) : 0}m</span>
                 </div>
              ))}
              {activeOps.length === 0 && <p className="text-center py-10 text-[9px] opacity-20 font-black uppercase">No active missions</p>}
           </div>
        </section>
      </div>

      {/* INCIDENT CENTER */}
      <section className="bg-white border-2 border-slate-900 p-8 rounded-[40px] shadow-xl space-y-8">
         <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-[#0D9488] animate-pulse"></div>
               <h2 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">FIELD INCIDENT CENTER</h2>
            </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shiftsWithIncidents.map((shift) => {
               const maintenanceCount = shift.maintenanceReports?.filter(r => r.status !== 'resolved').length || 0;
               const damageCount = shift.damageReports?.filter(r => r.status !== 'resolved').length || 0;
               const missingCount = shift.missingReports?.filter(r => r.status !== 'resolved').length || 0;
               return (
                  <div key={shift.id} className="p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5 transition-all group hover:border-[#0D9488] bg-white flex flex-col justify-between">
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <h4 className="text-sm font-bold text-black uppercase tracking-tight leading-tight">{shift.propertyName}</h4>
                           <p className="text-[8px] text-black/40 font-black uppercase tracking-widest">Shift: {shift.date}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {maintenanceCount > 0 && <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">{maintenanceCount} MAINTENANCE</span>}
                           {damageCount > 0 && <span className="text-[8px] font-black bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100">{damageCount} DAMAGE</span>}
                           {missingCount > 0 && <span className="text-[8px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">{missingCount} MISSING</span>}
                        </div>
                     </div>
                     <button onClick={() => setViewingIncidentShift(shift)} className="w-full bg-[#0D9488] text-white font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-teal-700 transition-all active:scale-95">MANAGE REPORTS</button>
                  </div>
               );
            })}
            {shiftsWithIncidents.length === 0 && <div className="col-span-full py-20 text-center opacity-10 font-black uppercase tracking-widest">No field reports reported</div>}
         </div>
      </section>

      {/* Incident Viewing Modal */}
      {viewingIncidentShift && (
         <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white border border-teal-100 rounded-[40px] w-full max-w-4xl p-8 md:p-10 space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
               <button onClick={() => setViewingIncidentShift(null)} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               <header className="space-y-1 pr-10">
                  <h3 className="text-2xl font-serif-brand font-bold uppercase text-black">{viewingIncidentShift.propertyName}</h3>
                  <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.4em]">Comprehensive Report Analysis</p>
               </header>
               <div className="space-y-8">
                  {['maintenance', 'damage', 'missing'].map((type) => {
                     const field = type === 'maintenance' ? 'maintenanceReports' : type === 'damage' ? 'damageReports' : 'missingReports';
                     const reports = (viewingIncidentShift as any)[field] as SpecialReport[] || [];
                     if (reports.length === 0) return null;
                     return (
                        <div key={type} className="space-y-3">
                           <h4 className="text-xs font-black text-black uppercase tracking-widest border-b border-slate-100 pb-2 capitalize">{type}</h4>
                           {reports.map((r, i) => (
                              <div key={i} className={`bg-slate-50 p-4 rounded-2xl border ${r.status === 'resolved' ? 'border-gray-100 opacity-60' : 'border-slate-200 shadow-sm'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                                 <div className="flex-1 space-y-2">
                                    <p className="text-[10px] text-black font-medium italic">"{r.description}"</p>
                                    <div className="flex gap-2">
                                       {r.photos?.map((url, idx) => (
                                          <img key={idx} src={url} onClick={() => setZoomedImage(url)} className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-zoom-in" />
                                       ))}
                                    </div>
                                    {r.assignedToName && <p className="text-[8px] text-blue-600 font-bold uppercase">Assigned to: {r.assignedToName}</p>}
                                 </div>
                                 {r.status !== 'resolved' && (
                                    <div className="flex gap-2 shrink-0">
                                       <button onClick={() => setAssigningReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md active:scale-95">Assign</button>
                                       <button onClick={() => setResolvingReport({ shiftId: viewingIncidentShift.id, report: r, type: type as any })} className="border border-gray-200 text-black/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-white">Resolve</button>
                                    </div>
                                 )}
                              </div>
                           ))}
                        </div>
                     );
                  })}
               </div>
            </div>
         </div>
      )}

      {assigningReport && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-white border border-teal-100 rounded-[40px] w-full max-w-md p-8 space-y-6 shadow-2xl relative">
              <button onClick={() => setAssigningReport(null)} className="absolute top-6 right-6 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <div>
                 <h3 className="text-xl font-serif-brand font-bold uppercase text-black">Assign Resource</h3>
                 <p className="text-[8px] font-black text-teal-600 uppercase tracking-[0.4em]">Select Personnel for Resolution</p>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                 {assignableStaff.map(u => (
                   <button key={u.id} onClick={() => handleAssignIncident(u.id)} className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-600 hover:shadow-md transition-all group">
                      <div className="text-left">
                         <p className="text-[10px] font-bold text-black uppercase">{u.name}</p>
                         <p className="text-[7px] text-black/40 font-black uppercase tracking-widest">{u.role}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10 group-hover:text-teal-600"><polyline points="9 18 15 12 9 6"/></svg>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
