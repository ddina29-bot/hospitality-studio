
import React, { useState, useMemo, useEffect } from 'react';
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
  user, users, setActiveTab, shifts = [], onLogout, manualTasks = [], setManualTasks, isLaundryAuthorized = false, onToggleLaundryPrepared, onAuditDeepLink, authorizedInspectorIds, setAuthorizedInspectorIds 
}) => {
  const isActualSupervisor = user.role === 'supervisor';
  const isAdmin = user.role === 'admin';
  const isHousekeeping = user.role === 'housekeeping';
  const isManagement = isAdmin || isHousekeeping;
  
  const [adminOverride, setAdminOverride] = useState(false);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  const currentHour = new Date().getHours();
  const isPastDeadline = currentHour >= 16; 

  const [showArchive, setShowArchive] = useState(false);

  // Task Notification Logic
  const myExtraTasks = useMemo(() => 
    manualTasks.filter(t => t.userId === user.id && t.status === 'pending'),
  [manualTasks, user.id]);

  const toggleTaskDone = (id: string) => {
    setManualTasks?.(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
  };

  // Logic: Distinguish between personal assigned work and management overview.
  const { activeInspections, archivedInspections } = useMemo(() => {
    const list = (shifts || []).filter(s => s && s.serviceType === 'TO CHECK APARTMENT');
    
    const active = list.filter(s => {
      if (s.status === 'completed') return false;
      if (isActualSupervisor) return s.userIds.includes(user.id);
      return true;
    });

    const archived = list.filter(s => s.status === 'completed');

    return { 
      activeInspections: active, 
      archivedInspections: archived.sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0)) 
    };
  }, [shifts, isActualSupervisor, user.id]);
  
  const managementStaff = useMemo(() => 
    users.filter(u => u.role === 'admin' || u.role === 'housekeeping'),
    [users]
  );

  const myCleaningTasks = isActualSupervisor 
    ? (shifts || []).filter(s => s && s.userIds.includes(user.id) && s.serviceType !== 'TO CHECK APARTMENT' && s.status !== 'completed')
    : [];

  const handleToggleAuthority = (staffId: string) => {
    if ((!isAdmin && staffId !== user.id) || !adminOverride) return;
    setAuthorizedInspectorIds(prev => {
      if (prev.includes(staffId)) return prev.filter(id => id !== staffId);
      return [...prev, staffId];
    });
  };

  const getStatusLabel = (job: Shift) => {
    if (job.approvalStatus === 'approved') return { text: 'APPROVED', color: 'text-green-600 bg-green-50 border-green-500/20' };
    if (job.approvalStatus === 'rejected') return { text: 'REPORTED', color: 'text-rose-600 bg-rose-50 border-rose-500/20' };
    if (job.status === 'completed') return { text: 'COMPLETED', color: 'text-[#3B82F6] bg-blue-50 border-[#3B82F6]/20' };
    return { text: 'PENDING', color: 'text-black/30 bg-gray-50 border-gray-200' };
  };

  const labelStyle = "text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em] mb-4 block px-1";

  const handleInspectAction = (shiftId: string) => {
    if (onAuditDeepLink) {
        onAuditDeepLink(shiftId);
    } else {
        setActiveTab('shifts');
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">
            {isActualSupervisor ? 'Supervisor Terminal' : 'Management View: Supervisor Portal'}
          </p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
        
        {isActualSupervisor && (
          <div className="flex gap-3">
            <button onClick={() => setActiveTab('shifts')} className="bg-gray-50 border border-gray-100 text-black/60 font-black px-4 py-2 rounded-xl text-[8px] uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm">MY SCHEDULE</button>
          </div>
        )}

        {isManagement && (
            <button 
                onClick={() => setAdminOverride(!adminOverride)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${adminOverride ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-black/40 border-gray-200'}`}
            >
                <div className={`w-2 h-2 rounded-full ${adminOverride ? 'bg-white animate-pulse' : 'bg-black/20'}`}></div>
                {adminOverride ? 'ADMIN OVERRIDE ACTIVE' : 'READ-ONLY MODE'}
            </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {myExtraTasks.length > 0 && (
          <section className="bg-[#FCF5E5] p-8 rounded-[40px] border-2 border-[#A68342] shadow-xl space-y-6">
             <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#A68342] animate-pulse"></span>
                   <h2 className="text-[10px] font-black text-[#A68342] uppercase tracking-[0.3em]">URGENT EXTRA TASKS</h2>
                </div>
                <span className="text-[8px] font-black text-[#A68342]">{myExtraTasks.length} PENDING</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {myExtraTasks.map(task => (
                 <div key={task.id} className="bg-white p-5 rounded-2xl border border-[#A68342]/20 shadow-sm flex items-center justify-between gap-4">
                    <div className="text-left flex-1">
                       <h4 className="text-[11px] font-bold text-[#A68342] uppercase leading-tight tracking-tight">{task.taskName}</h4>
                       <p className="text-[8px] text-[#A68342]/60 font-black uppercase mt-1">{task.propertyName}</p>
                    </div>
                    <button onClick={() => toggleTaskDone(task.id)} className="w-8 h-8 rounded-full border-2 border-[#A68342] flex items-center justify-center text-[#A68342] hover:bg-[#FCF5E5] transition-all">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                 </div>
               ))}
             </div>
          </section>
        )}

        {isManagement && (
          <section className={`bg-gray-50/50 border border-gray-100 p-8 rounded-[40px] shadow-sm animate-in slide-in-from-top-4 duration-500 ${!adminOverride ? 'opacity-70' : ''}`}>
             <div className="flex justify-between items-center mb-4">
                <p className={labelStyle}>Inspection Permission Control</p>
                {!adminOverride && <span className="text-[7px] font-black text-black/20 uppercase tracking-widest">LOCKED</span>}
             </div>
             <div className="flex flex-wrap gap-x-12 gap-y-4 items-center">
                {managementStaff.map(staff => {
                  const isStaffAuthorized = authorizedInspectorIds.includes(staff.id);
                  const canClick = (isAdmin || staff.id === user.id) && adminOverride;
                  return (
                    <label 
                      key={staff.id} 
                      className={`flex items-center gap-4 ${canClick ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}`}
                      onClick={() => handleToggleAuthority(staff.id)}
                    >
                       <div className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center ${isStaffAuthorized ? 'bg-[#C5A059] border-[#C5A059] shadow-[0_0_10px_rgba(197,160,89,0.3)]' : 'bg-white border-gray-300 shadow-sm group-hover:border-[#C5A059]/40'}`}>
                         {isStaffAuthorized && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                       </div>
                       <span className={`text-xs font-black uppercase tracking-widest ${isStaffAuthorized ? 'text-black' : 'text-black/30'} group-hover:text-black transition-colors`}>{staff.name.toUpperCase()}</span>
                    </label>
                  );
                })}
             </div>
          </section>
        )}

        <div className={`grid grid-cols-1 ${isActualSupervisor ? 'md:grid-cols-2' : ''} gap-6`}>
          {isActualSupervisor && (
            <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 space-y-6 shadow-xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest">My Cleaning Tasks</h3>
                <span className="text-[8px] font-black text-[#C5A059] uppercase bg-[#C5A059]/10 px-2 py-1 rounded">{myCleaningTasks.length} Assigned</span>
              </div>
              <div className="space-y-3">
                {myCleaningTasks.length === 0 ? (
                  <div className="py-12 text-center opacity-10 italic text-[10px] uppercase text-black">No active cleaning deployments</div>
                ) : myCleaningTasks.map(job => (
                  <div key={job.id} className="p-4 bg-white/60 rounded-2xl border border-[#D4B476]/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-black uppercase">{job.propertyName}</p>
                      <p className="text-[8px] text-black/30 uppercase tracking-widest font-black mt-1">{job.startTime} • {job.serviceType}</p>
                    </div>
                    <button onClick={() => setActiveTab('shifts')} className="bg-[#C5A059] text-black px-4 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-lg">START</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 space-y-6 shadow-xl w-full">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest">
                {isActualSupervisor ? 'Personal Inspection Queue' : 'Studio Global Inspection List'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-green-600 uppercase bg-green-500/10 px-2 py-1 rounded">
                  {activeInspections.length} Required
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              {activeInspections.length === 0 ? (
                <div className="py-20 text-center opacity-10 italic text-[10px] uppercase text-black border-2 border-dashed border-[#D4B476]/20 rounded-[32px]">
                   All scheduled units have been audited
                </div>
              ) : activeInspections.map(job => {
                const canInspect = isActualSupervisor || (isManagement && adminOverride);
                const status = getStatusLabel(job);
                const isLate = job.date === todayStr && isPastDeadline;
                return (
                  <div key={job.id} className="p-6 bg-white border border-[#D4B476]/20 rounded-[32px] flex flex-col items-stretch gap-4 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {isManagement && isLate && (
                       <div className="absolute top-0 right-0 bg-red-600 text-white px-4 py-1.5 rounded-bl-2xl text-[7px] font-black uppercase tracking-widest animate-pulse">Late Check Alert: Past 16:00</div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-left flex-1">
                        <p className="text-sm font-bold text-black uppercase tracking-tight">{job.propertyName}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                           <span className={`px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest ${status.color}`}>{status.text}</span>
                           {isManagement && <span className="text-[7px] text-black/40 font-bold uppercase">Scheduled: {job.date}</span>}
                           {!isActualSupervisor && job.userIds && <span className="text-[7px] text-black/20 font-bold uppercase truncate max-w-[150px]">Assigned: {users.find(u => u.id === job.userIds[0])?.name || 'Unassigned'}</span>}
                        </div>
                        {isManagement && isLate && <p className="text-[9px] text-red-600 font-bold uppercase mt-3 italic flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Unit not checked by supervisor deadline</p>}
                      </div>
                      <button 
                        onClick={() => canInspect && handleInspectAction(job.id)} 
                        disabled={!canInspect} 
                        className={`w-full sm:w-auto px-8 py-2.5 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all ${canInspect ? 'bg-green-600 text-white active:scale-95 hover:bg-green-700' : 'bg-gray-100 text-black/20 cursor-not-allowed border border-gray-200 shadow-none'}`}
                      >
                        {canInspect ? 'INSPECT' : 'READ ONLY'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archive Section */}
            {archivedInspections.length > 0 && (
               <div className="mt-10 border-t border-[#D4B476]/10 pt-8">
                  <button 
                    onClick={() => setShowArchive(!showArchive)}
                    className="flex items-center gap-3 text-black/30 hover:text-black transition-colors group mb-6"
                  >
                     <p className="text-[9px] font-black uppercase tracking-[0.4em]">Audit Archive ({archivedInspections.length})</p>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-300 ${showArchive ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {showArchive && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                       {archivedInspections.map(job => (
                          <div key={job.id} className="p-4 bg-white/40 border border-[#D4B476]/10 rounded-2xl flex items-center justify-between group opacity-60 hover:opacity-100 transition-opacity">
                             <div className="text-left">
                                <p className="text-[11px] font-bold text-black uppercase tracking-tight">{job.propertyName}</p>
                                <p className="text-[7px] text-[#8B6B2E] font-black uppercase tracking-widest mt-1">Verified By: {job.decidedBy || 'N/A'}</p>
                             </div>
                             <div className={`px-2 py-0.5 rounded border text-[6px] font-black uppercase ${getStatusLabel(job).color}`}>
                                {getStatusLabel(job).text}
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
