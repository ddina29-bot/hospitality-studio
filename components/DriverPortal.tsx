
import React, { useMemo, useState, useEffect } from 'react';
import { TabType, User, Shift, Property, ManualTask, SupplyRequest, TimeEntry } from '../types';

interface DriverPortalProps {
  user: User; // Effective user (respects simulation via App.tsx)
  supplyRequests?: SupplyRequest[];
  setSupplyRequests?: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties?: Property[];
  users?: User[];
  setActiveTab?: (tab: TabType) => void;
  timeEntries?: TimeEntry[];
  setTimeEntries?: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  initialOverrideId?: string | null;
  onResetOverrideId?: () => void;
}

const DriverPortal: React.FC<DriverPortalProps> = ({ 
  user,
  supplyRequests = [], 
  setSupplyRequests,
  manualTasks = [],
  setManualTasks,
  shifts = [], 
  setShifts,
  properties = [],
  users = [],
  setActiveTab,
  timeEntries = [],
  setTimeEntries,
  initialOverrideId = null,
  onResetOverrideId
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overrideDriverId, setOverrideDriverId] = useState<string | null>(initialOverrideId);
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  
  const isDriverRole = user.role === 'driver';
  const isManagerRole = user.role === 'admin' || user.role === 'housekeeping';
  const isOperationalMode = isDriverRole || (isManagerRole && !!overrideDriverId);
  const isMonitorMode = isManagerRole && !isDriverRole && !overrideDriverId;

  useEffect(() => {
    if (initialOverrideId) {
      setOverrideDriverId(initialOverrideId);
      setRefreshToggle(p => p + 1);
    }
  }, [initialOverrideId]);

  const getLocalISO = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const todayDateStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  
  const [viewedDate, setViewedDate] = useState(realTodayISO);
  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDate]);

  const activeUserId = isOperationalMode ? (overrideDriverId || user.id) : null;
  const isViewingToday = viewedDate === realTodayISO;

  const getLogisticsTasksForUser = (userId: string, dateStr: string, activeRole: string) => {
    return (shifts || []).filter(s => {
      if (!s.isPublished || s.excludeLaundry || s.date !== dateStr) return false;
      if (s.userIds.includes(userId)) return true;
      const isLogisticsType = ['Check out/check in', 'REFRESH', 'MID STAY CLEANING', 'BEDS ONLY', 'Common Area', 'SUPPLY DELIVERY'].includes(s.serviceType);
      return isLogisticsType && activeRole === 'driver';
    });
  };

  const todaysEntries = useMemo(() => {
    if (!activeUserId) return [];
    return (timeEntries || [])
        .filter(e => e.userId === activeUserId && e.timestamp.startsWith(realTodayISO))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [timeEntries, activeUserId, realTodayISO, refreshToggle]);

  const routeStartTime = useMemo(() => {
    const startEntry = todaysEntries.find(e => e.type === 'in');
    return startEntry ? new Date(startEntry.timestamp) : null;
  }, [todaysEntries]);

  const routeEndTime = useMemo(() => {
    if (!routeStartTime) return null;
    const endEntry = todaysEntries.slice().reverse().find(e => e.type === 'out' && new Date(e.timestamp) > routeStartTime);
    return endEntry ? new Date(endEntry.timestamp) : null;
  }, [todaysEntries, routeStartTime]);

  const routeActive = !!routeStartTime && !routeEndTime;
  const isFinishedForViewedDate = !!routeEndTime;

  useEffect(() => {
    let interval: any;
    if (routeActive && isViewingToday) {
      const updateTimer = () => {
        if (routeStartTime) {
          const diffInSeconds = Math.floor((Date.now() - routeStartTime.getTime()) / 1000);
          setElapsedTime(diffInSeconds > 0 ? diffInSeconds : 0);
        }
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000); 
    }
    return () => clearInterval(interval);
  }, [routeActive, isViewingToday, routeStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  };

  const logisticsTasks = useMemo(() => {
    if (!activeUserId) return [];
    const effectiveRoleOfSubject = overrideDriverId 
        ? (users?.find(u => u.id === overrideDriverId)?.role || 'driver')
        : user.role;

    return getLogisticsTasksForUser(activeUserId, viewedDateStr, effectiveRoleOfSubject).map(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      const cleanerId = s.userIds.find(uid => {
        const u = users?.find(uSub => uSub.id === uid);
        return u?.role === 'cleaner' || u?.role === 'supervisor';
      });
      const cleaner = users?.find(u => u.id === cleanerId);
      return { ...s, propDetails: prop, cleanerDetails: cleaner };
    });
  }, [shifts, viewedDateStr, properties, users, activeUserId, user.role, overrideDriverId]);

  const monitorData = useMemo(() => {
    if (!isMonitorMode) return [];
    return users?.filter(u => u.role === 'driver' && u.status === 'active').map(d => {
       const entries = (timeEntries || [])
         .filter(e => e.userId === d.id && e.timestamp.startsWith(realTodayISO))
         .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

       const start = entries.find(e => e.type === 'in');
       const end = entries.slice().reverse().find(e => e.type === 'out' && start && new Date(e.timestamp) > new Date(start.timestamp));
       
       const dTasks = getLogisticsTasksForUser(d.id, todayDateStr, 'driver');
       const doneCount = dTasks.filter(s => s.isDelivered && s.isCollected).length;
       
       return {
         driver: d,
         startTime: start ? new Date(start.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : null,
         endTime: end ? new Date(end.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : null,
         isActive: !!start && !end,
         isFinished: !!end,
         progress: `${doneCount} / ${dTasks.length}`
       };
    });
  }, [isMonitorMode, users, timeEntries, realTodayISO, shifts, todayDateStr]);

  const handleStartDay = () => {
    if (!setTimeEntries || !activeUserId) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: activeUserId, type: 'in', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
    setRefreshToggle(p => p + 1);
  };

  const handleFinishDay = () => {
    if (!setTimeEntries || !activeUserId) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: activeUserId, type: 'out', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
    setRefreshToggle(p => p + 1);
  };

  const toggleTaskField = (shiftId: string, field: keyof Shift, reason?: string) => {
    const canWrite = routeActive || isManagerRole;
    if (!canWrite) return;
    setShifts?.(prev => prev.map(s => {
      if (s.id === shiftId) {
        const updated = { ...s, [field]: !s[field] };
        if (field === 'keysAtOffice' && reason) updated.keyLocationReason = reason;
        return updated;
      }
      return s;
    }));
  };

  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - 3); 
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = getLocalISO(d);
      days.push({ iso, dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }), dateNum: d.getDate() });
    }
    return days;
  }, [realTodayISO]);

  const labelStyle = "text-[7px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1.5 block px-1";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-2">
      
      {/* 1. ADMIN MONITOR VIEW */}
      {isMonitorMode && (
        <div className="space-y-8">
           <header>
             <h2 className="text-2xl font-serif-brand font-bold text-slate-900 tracking-tight leading-none uppercase">Activity Monitor</h2>
             <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2">Fleet status overview for driver logistics.</p>
           </header>

           <div className="bg-white border border-slate-100 rounded-[40px] shadow-2xl overflow-hidden divide-y divide-slate-50">
              {monitorData.length === 0 ? (
                <div className="p-20 text-center opacity-20 font-black uppercase text-[10px]">No active drivers.</div>
              ) : monitorData.map((session, i) => (
                <div key={i} className="p-8 flex flex-col md:flex-row justify-between items-center gap-6 hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-6 flex-1 text-left">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl ${session.isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                         {session.driver.name.charAt(0)}
                      </div>
                      <div className="text-left">
                         <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{session.driver.name}</h4>
                         <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Progress: {session.progress} STOPS</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-10">
                      <div className="text-right space-y-1">
                         <div className="flex items-center gap-2 justify-end">
                            <div className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            <span className={`text-[10px] font-black uppercase ${session.isFinished ? 'text-blue-600' : session.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                              {session.isFinished ? 'FINISHED' : session.isActive ? 'LIVE' : 'OFFLINE'}
                            </span>
                         </div>
                         <p className="text-[8px] font-bold text-slate-400 uppercase">{session.startTime || '--:--'} — {session.endTime || 'NOW'}</p>
                      </div>
                      <button onClick={() => setOverrideDriverId(session.driver.id)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">VIEW ROUTE</button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 2. OPERATIONAL VIEW (Route List) */}
      {isOperationalMode && (
        <>
          <section className="flex items-center justify-between gap-4">
             {isManagerRole && (
                <button onClick={() => { setOverrideDriverId(null); onResetOverrideId?.(); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                   EXIT OVERRIDE
                </button>
             )}
             <div className="flex-1 text-right">
                <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Active Personnel</p>
                <p className="text-[10px] font-bold text-slate-900 uppercase leading-none">{users?.find(u => u.id === activeUserId)?.name || user.name}</p>
             </div>
          </section>

          <section className="bg-white border border-gray-200 p-4 rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {weekDays.map((wd) => (
                <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-slate-400'}`}>
                  <span className={`text-[8px] font-black uppercase mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-slate-400'}`}>{wd.dayName}</span>
                  <span className={`text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-slate-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          {/* HUD: DEEP SLATE */}
          <header className="flex justify-between items-center bg-slate-900 p-8 rounded-[40px] shadow-xl border border-white/5 relative overflow-hidden">
            <div className="space-y-2 text-left relative z-10">
              <h2 className="text-xl font-brand text-white uppercase font-bold tracking-tight leading-none">
                {isViewingToday ? (isFinishedForViewedDate ? 'Route Archive' : 'Active Route') : `Route Preview`}
              </h2>
              <div className="space-y-1">
                 <p className="text-[10px] text-white/40 uppercase tracking-widest">{viewedDateStr} • {logisticsTasks.length} STOP(S)</p>
                 {routeStartTime && <p className="text-[9px] font-bold text-teal-400 uppercase">Started: {routeStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>}
              </div>
            </div>
            <div className="text-right relative z-10">
              {isViewingToday && routeActive ? (
                 <div className="flex flex-col items-end">
                   <p className="text-3xl font-bold text-emerald-400 font-mono leading-none tracking-tighter shadow-[0_0_15px_rgba(52,211,153,0.3)]">{formatElapsedTime(elapsedTime)}</p>
                   <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-3 animate-pulse">SESSION LIVE</span>
                 </div>
              ) : isViewingToday && !isFinishedForViewedDate ? (
                <button onClick={handleStartDay} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform">START ROUTE</button>
              ) : isFinishedForViewedDate ? (
                <span className="text-[9px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-4 py-2 rounded-xl border border-emerald-400/20">FINISHED</span>
              ) : (
                 <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-800 px-4 py-2 rounded-xl border border-white/5">LOCKED</span>
              )}
            </div>
          </header>

          <div className="space-y-6">
            {logisticsTasks.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-black/5 rounded-[48px] opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em]">Queue Clear.</div>
            ) : (
              logisticsTasks.map(task => {
                const isExtraTask = task.serviceType === 'SUPPLY DELIVERY';
                return (
                  <div key={task.id} className={`bg-white p-8 rounded-[40px] border shadow-xl space-y-8 transition-all hover:border-indigo-100 ${(!task.isDelivered || (!isExtraTask && !task.isCollected)) ? 'border-orange-100 ring-2 ring-orange-50/50' : 'border-slate-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 text-left flex-1">
                          <div className="flex items-center gap-4 flex-wrap">
                            <h4 className="text-slate-900 font-extrabold uppercase text-xl leading-tight tracking-tighter">{task.propertyName}</h4>
                            {!isExtraTask && (
                              <label className={`flex items-center gap-2 group bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200 ${(!routeActive && !isManagerRole) ? 'opacity-50' : 'cursor-pointer'}`}>
                                <div 
                                  onClick={() => (routeActive || isManagerRole) && toggleTaskField(task.id, 'keysHandled')}
                                  className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${task.keysHandled ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}
                                >
                                  {task.keysHandled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Access Keys taken</span>
                              </label>
                            )}
                            {isExtraTask && (
                              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-indigo-100">Supply Drop</span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                            <div>
                              <p className={labelStyle}>Staff Contact</p>
                              <p className="text-[11px] text-slate-900 font-extrabold uppercase leading-none">{task.cleanerDetails?.name || 'HQ / Pending'}</p>
                              {task.cleanerDetails?.phone && (
                                <div className="flex gap-2 mt-3">
                                   <a href={`tel:${task.cleanerDetails.phone}`} className="text-[8px] bg-white text-slate-400 px-4 py-1.5 rounded-lg border border-slate-200 font-black uppercase shadow-sm active:scale-95 hover:bg-slate-50">Call</a>
                                   <a href={`https://wa.me/${task.cleanerDetails.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[8px] bg-green-50 text-green-600 px-4 py-1.5 rounded-lg border border-green-100 font-black uppercase shadow-sm active:scale-95">WhatsApp</a>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className={labelStyle}>Deployment Position</p>
                              <div className="flex gap-2">
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="flex-1 text-[9px] bg-white text-blue-600 px-3 py-2 rounded-xl font-black uppercase border border-blue-100 text-center shadow-sm hover:bg-blue-50 transition-colors">G-Maps</a>
                                <a href={`https://maps.apple.com/?q=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="flex-1 text-[9px] bg-white text-slate-900 px-3 py-2 rounded-xl font-black uppercase border border-slate-200 text-center shadow-sm hover:bg-slate-50 transition-colors">Apple</a>
                              </div>
                            </div>
                          </div>
                          {isExtraTask && task.notes && (
                            <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                               <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Items to Deliver</p>
                               <p className="text-[10px] text-indigo-900 font-bold italic leading-relaxed">"{task.notes}"</p>
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {isExtraTask ? (
                        <div className="flex gap-4">
                          {(routeActive || isManagerRole) ? (
                            <button 
                              onClick={() => toggleTaskField(task.id, 'isDelivered')} 
                              className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] transition-all shadow-lg active:scale-95 ${task.isDelivered ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50'}`}
                            >
                               {task.isDelivered ? '✓ DELIVERY COMPLETED' : 'MARK AS DELIVERED'}
                            </button>
                          ) : (
                            <div className={`w-full py-6 rounded-2xl text-center border-2 shadow-inner ${task.isDelivered ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                              <span className="text-[11px] font-black uppercase tracking-widest">{task.isDelivered ? 'DELIVERY DONE' : 'DROP PENDING'}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4">
                          {(routeActive || isManagerRole) ? (
                          <>
                              <button 
                                onClick={() => toggleTaskField(task.id, 'isDelivered')} 
                                className={`flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg active:scale-95 ${task.isDelivered ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                              >
                                 {task.isDelivered ? '✓ DELIVERED' : 'MARK DELIVERED'}
                              </button>
                              <button 
                                onClick={() => toggleTaskField(task.id, 'isCollected')} 
                                className={`flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg active:scale-95 ${task.isCollected ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50'}`}
                              >
                                 {task.isCollected ? '✓ COLLECTED' : 'MARK COLLECTED'}
                              </button>
                          </>
                          ) : (
                          <>
                              <div className={`flex-1 py-5 rounded-2xl text-center border-2 shadow-inner ${task.isDelivered ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest">{task.isDelivered ? 'DELIVERED' : 'PENDING'}</span>
                              </div>
                              <div className={`flex-1 py-5 rounded-2xl text-center border-2 shadow-inner ${task.isCollected ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest">{task.isCollected ? 'COLLECTED' : 'PENDING'}</span>
                              </div>
                          </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {routeActive && isViewingToday && (
            <button onClick={handleFinishDay} className="w-full bg-slate-900 hover:bg-black text-white font-black py-7 rounded-[32px] uppercase tracking-[0.4em] text-xs shadow-2xl mt-12 active:scale-95 transition-all">
              FINISH THE DAY
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default DriverPortal;
