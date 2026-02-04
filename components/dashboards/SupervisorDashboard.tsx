
import React, { useState, useMemo } from 'react';
import { TabType, Shift, User, ManualTask } from '../../types';

interface SupervisorDashboardProps {
  user: User;
  users: User[];
  setActiveTab: (tab: TabType) => void;
  shifts?: Shift[];
  onLogout: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  isLaundryAuthorized?: boolean;
  onToggleLaundryPrepared: (shiftId: string) => void;
  onAuditDeepLink?: (shiftId: string) => void;
  authorizedInspectorIds: string[];
  setAuthorizedInspectorIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ 
  user, users, setActiveTab, shifts = [], onLogout, manualTasks = [], setManualTasks, onAuditDeepLink, authorizedInspectorIds 
}) => {
  const isActualSupervisor = user.role === 'supervisor';
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  const currentHour = new Date().getHours();
  const isPastDeadline = currentHour >= 16; 

  const [showArchive, setShowArchive] = useState(false);

  // Filter Tasks
  const myExtraTasks = useMemo(() => 
    manualTasks.filter(t => t.userId === user.id && t.status === 'pending'),
  [manualTasks, user.id]);

  const { activeInspections, archivedInspections } = useMemo(() => {
    const list = (shifts || []).filter(s => s && s.serviceType === 'TO CHECK APARTMENT');
    const active = list.filter(s => s.status !== 'completed' && (isActualSupervisor ? s.userIds.includes(user.id) : true));
    const archived = list.filter(s => s.status === 'completed');
    return { 
      activeInspections: active, 
      archivedInspections: archived.sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0)) 
    };
  }, [shifts, isActualSupervisor, user.id]);

  const myCleaningTasks = useMemo(() => 
    (shifts || []).filter(s => s && s.userIds.includes(user.id) && s.serviceType !== 'TO CHECK APARTMENT' && s.status !== 'completed'),
  [shifts, user.id]);

  const getStatusLabel = (job: Shift) => {
    if (job.approvalStatus === 'approved') return { text: 'APPROVED', color: 'text-green-600 bg-green-50 border-green-500/20' };
    if (job.approvalStatus === 'rejected') return { text: 'REPORTED', color: 'text-rose-600 bg-rose-50 border-rose-500/20' };
    if (job.status === 'completed') return { text: 'COMPLETED', color: 'text-[#3B82F6] bg-blue-50 border-[#3B82F6]/20' };
    return { text: 'PENDING', color: 'text-black/30 bg-gray-50 border-gray-200' };
  };

  const handleInspectAction = (shiftId: string) => {
    if (onAuditDeepLink) onAuditDeepLink(shiftId);
    else setActiveTab('shifts');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start gap-6 px-1">
        <div className="space-y-1">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">Supervisor Operations Terminal</p>
          <h1 className="text-3xl font-brand text-slate-900 tracking-tighter uppercase leading-none font-extrabold">
            Welcome, {user.name.split(' ')[0]}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Managing {activeInspections.length} pending audits today.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="text-center">
                 <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Success</p>
                 <p className="text-sm font-bold text-slate-900">98%</p>
              </div>
              <div className="w-px h-6 bg-slate-100"></div>
              <div className="text-center">
                 <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Check-ins</p>
                 <p className="text-sm font-bold text-slate-900">{activeInspections.length + myCleaningTasks.length}</p>
              </div>
           </div>
        </div>
      </header>

      {myExtraTasks.length > 0 && (
        <section className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-2xl space-y-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
           </div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tight">Active Duty Extensions</h3>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] mt-1">Manual tasks assigned to you</p>
              </div>
              <button onClick={() => setActiveTab('logistics')} className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl">VIEW TASKS ({myExtraTasks.length})</button>
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: CLEANING DEPLOYMENTS */}
        <section className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Personal Deployments</h3>
              <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">{myCleaningTasks.length} MISSIONS</span>
           </div>
           <div className="space-y-4">
              {myCleaningTasks.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[40px] opacity-30">
                   <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">No cleaning shifts today</p>
                </div>
              ) : myCleaningTasks.map(job => (
                <div key={job.id} onClick={() => setActiveTab('shifts')} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl hover:border-teal-500 transition-all cursor-pointer group">
                   <div className="flex justify-between items-start">
                      <div className="text-left space-y-1">
                         <h4 className="text-base font-bold text-slate-900 uppercase group-hover:text-teal-600 transition-colors">{job.propertyName}</h4>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{job.startTime} • {job.serviceType}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* RIGHT COLUMN: INSPECTION MISSIONS */}
        <section className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Quality Audit Queue</h3>
              <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full uppercase">{activeInspections.length} REQUIRED</span>
           </div>
           <div className="space-y-4">
              {activeInspections.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[40px] opacity-30 bg-teal-50/20">
                   <p className="text-[9px] font-black uppercase text-teal-600 tracking-widest">All units verified for {todayStr}</p>
                </div>
              ) : activeInspections.map(job => {
                const isLate = job.date === todayStr && isPastDeadline;
                return (
                  <div key={job.id} className={`bg-white p-6 rounded-[32px] border shadow-xl relative overflow-hidden transition-all hover:scale-[1.02] ${isLate ? 'border-rose-200' : 'border-slate-100'}`}>
                    {isLate && (
                       <div className="absolute top-0 right-0 bg-rose-600 text-white px-4 py-1.5 rounded-bl-2xl text-[7px] font-black uppercase tracking-widest animate-pulse shadow-lg">LATE CHECK • PAST 16:00</div>
                    )}
                    <div className="space-y-4">
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{job.propertyName}</h4>
                        <div className="flex items-center gap-3 mt-2">
                           <span className="text-[7px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg uppercase tracking-widest">AUDIT MISSION</span>
                           <span className="text-[7px] text-slate-300 font-bold uppercase">{job.date} • {job.startTime}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleInspectAction(job.id)} 
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-black"
                      >
                        COMMENCE INSPECTION
                      </button>
                    </div>
                  </div>
                );
              })}
           </div>

           {archivedInspections.length > 0 && (
              <div className="pt-6">
                <button 
                  onClick={() => setShowArchive(!showArchive)}
                  className="flex items-center gap-3 text-slate-300 hover:text-slate-600 transition-colors group mb-4 px-2"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.4em]">Audit History ({archivedInspections.length})</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-300 ${showArchive ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showArchive && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    {archivedInspections.slice(0, 5).map(job => (
                      <div key={job.id} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-60">
                         <div className="text-left">
                            <p className="text-[11px] font-bold text-slate-900 uppercase">{job.propertyName}</p>
                            <p className="text-[7px] font-black text-slate-400 uppercase mt-0.5">{job.date}</p>
                         </div>
                         <div className={`px-2 py-1 rounded text-[7px] font-black uppercase ${getStatusLabel(job).color}`}>
                            {getStatusLabel(job).text}
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           )}
        </section>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
