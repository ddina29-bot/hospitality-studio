
import React, { useMemo, useState, useEffect } from 'react';
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
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);

  const auditQueue = useMemo(() => shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending'), [shifts]);
  const messQueue = useMemo(() => shifts.filter(s => s.messReport && s.messReport.status === 'pending'), [shifts]);
  const incidentCenter = useMemo(() => shifts.filter(s => (s.maintenanceReports?.some(r => r.status === 'open') || s.damageReports?.some(r => r.status === 'open') || s.missingReports?.some(r => r.status === 'open'))), [shifts]);

  const handleExtraTimeDecision = (shiftId: string, decision: 'approved' | 'rejected') => {
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId && s.messReport) {
        return { ...s, messReport: { ...s.messReport, status: decision, decisionNote: decision === 'approved' ? 'Request authorized by HK.' : 'Request declined by HK.' } };
      }
      return s;
    }));
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#8B6B2E] font-black uppercase tracking-[0.4em] text-[8px]">Field Command</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ACTION: AUDIT QUEUE */}
        <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <h2 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Quality Audit Feed ({auditQueue.length})</h2>
           </div>
           <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {auditQueue.map(s => (
                <div key={s.id} className="p-5 bg-blue-50 border border-blue-100 rounded-3xl flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                   <div>
                      <p className="text-[11px] font-black uppercase">{s.propertyName}</p>
                      <p className="text-[9px] text-blue-600 font-bold uppercase mt-1">{s.startTime} • Completed</p>
                   </div>
                   <button onClick={() => onAuditDeepLink?.(s.id)} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Audit</button>
                </div>
              ))}
              {auditQueue.length === 0 && <p className="text-center py-10 text-[9px] opacity-20 font-black uppercase">All checks verified</p>}
           </div>
        </section>

        {/* ACTION: MESS REPORTS (Extra Hours) */}
        <section className="bg-red-50 border border-red-200 p-8 rounded-[40px] shadow-xl space-y-6">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
              <h2 className="text-[10px] font-black text-red-700 uppercase tracking-[0.3em]">MESS ALERTS & EXTRA TIME</h2>
           </div>
           <div className="space-y-4">
              {messQueue.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-3xl border border-red-100 shadow-sm space-y-3">
                   <div className="text-left">
                      <h4 className="text-[11px] font-bold text-black uppercase">{s.propertyName}</h4>
                      <p className="text-[9px] text-red-600 italic">"{s.messReport?.description}"</p>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => handleExtraTimeDecision(s.id, 'approved')} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-[8px] font-black uppercase">Approve</button>
                      <button onClick={() => handleExtraTimeDecision(s.id, 'rejected')} className="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-[8px] font-black uppercase">Deny</button>
                   </div>
                </div>
              ))}
              {messQueue.length === 0 && <p className="text-center py-10 text-[9px] opacity-20 font-black uppercase">No active alerts</p>}
           </div>
        </section>
      </div>

      {/* INCIDENT HUD */}
      <section className="bg-white border-2 border-slate-900 p-8 rounded-[40px] shadow-xl space-y-8">
         <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-slate-900 animate-pulse"></div>
            <h2 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">FIELD INCIDENT COMMAND</h2>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incidentCenter.map(s => (
               <div key={s.id} className="p-6 bg-slate-50 border border-slate-200 rounded-[32px] space-y-4 hover:border-slate-400 transition-all">
                  <div>
                     <h4 className="text-sm font-bold uppercase tracking-tight">{s.propertyName}</h4>
                     <p className="text-[9px] text-slate-400 font-bold uppercase">Reported {s.date}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {s.maintenanceReports?.some(r => r.status === 'open') && <span className="text-[7px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase">Maintenance</span>}
                     {s.damageReports?.some(r => r.status === 'open') && <span className="text-[7px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded uppercase">Damage</span>}
                     {s.missingReports?.some(r => r.status === 'open') && <span className="text-[7px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase">Missing</span>}
                  </div>
                  <button onClick={() => setActiveTab('shifts')} className="w-full bg-white border border-slate-300 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Manage Shift</button>
               </div>
            ))}
            {incidentCenter.length === 0 && <div className="col-span-full py-20 text-center opacity-10 font-black uppercase italic tracking-widest text-[10px]">No active incidents in your zones</div>}
         </div>
      </section>

      {zoomedImage && <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" /></div>}
    </div>
  );
};

export default HousekeeperDashboard;
