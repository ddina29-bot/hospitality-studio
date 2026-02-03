import React, { useMemo, useState, useEffect } from 'react';
import { TabType, User, Shift, Property, ManualTask, SupplyRequest, TimeEntry } from '../types';

interface DriverPortalProps {
  user: User; 
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
       const doneCount = dTasks.filter(s => s.isDelivered && s.isCollected && s.isCleanLinenTakenFromOffice).length;
       
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

  const labelStyle = "text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] md:tracking-[0.4em] mb-1.5 block px-1";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-1">
      
      {/* 1. ADMIN MONITOR VIEW */}
      {isMonitorMode && (
        <div className="space-y-6 md:space-y-8">
           <header className="px-1">
             <h2 className="text-xl md:text-2xl font-serif-brand font-bold text-slate-900 tracking-tight leading-none uppercase">Monitor</h2>
             <p className="text-[9px] md:text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-1.5">Fleet logistics status.</p>
           </header>

           <div className="bg-white border border-slate-100 rounded-3xl md:rounded-[40px] shadow-2xl overflow-hidden divide-y divide-slate-50">
              {monitorData.length === 0 ? (
                <div className="p-20 text-center opacity-20 font-black uppercase text-[10px]">No active drivers.</div>
              ) : monitorData.map((session, i) => (
                <div key={i} className="p-5 md:p-8 flex flex-col md:flex-row justify-between items-center gap-5 hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-4 md:gap-6 flex-1 text-left w-full">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center font-bold text-xl md:text-2xl shrink-0 ${session.isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                         {session.driver.name.charAt(0)}
                      </div>
                      <div className="text-left min-w-0">
                         <h4 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight truncate">{session.driver.name}</h4>
                         <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-indigo-500">{session.progress} STOPS</p>
                      </div>
                   </div>
                   <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 w-full md:w-auto">
                      <div className="text-left md:text-right space-y-0.5">
                         <div className="flex items-center gap-2 md:justify-end">
                            <div className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            <span className={`text-[9px] font-black uppercase ${session.isFinished ? 'text-blue-600' : session.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                              {session.isFinished ? 'FINISHED' : session.isActive ? 'LIVE' : 'OFFLINE'}
                            </span>
                         </div>
                         <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase">{session.startTime || '--:--'} — {session.endTime || 'NOW'}</p>
                      </div>
                      <button onClick={() => setOverrideDriverId(session.driver.id)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest active:scale-95 shadow-lg">VIEW</button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 2. OPERATIONAL VIEW (Route List) */}
      {isOperationalMode && (
        <>
          <section className="flex items-center justify-between gap-4 px-1">
             {isManagerRole && (
                <button onClick={() => { setOverrideDriverId(null); onResetOverrideId?.(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                   EXIT
                </button>
             )}
             <div className="flex-1 text-right min-w-0">
                <p className="text-[7px] md:text-[8px] font-black text-indigo-600 uppercase tracking-widest truncate">Active Personnel</p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-900 uppercase leading-none truncate">{users?.find(u => u.id === activeUserId)?.name || user.name}</p>
             </div>
          </section>

          <section className="bg-white border border-gray-200 p-2.5 md:p-4 rounded-3xl md:rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar pb-1">
              {weekDays.map((wd) => (
                <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[55px] md:min-w-[60px] py-3 rounded-xl md:rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-slate-400 shadow-sm'}`}>
                  <span className={`text-[7px] md:text-[8px] font-black uppercase mb-0.5 md:mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-slate-400'}`}>{wd.dayName}</span>
                  <span className={`text-xs md:text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-slate-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          <header className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-xl border border-white/5 relative overflow-hidden gap-6">
            <div className="space-y-2 text-center sm:text-left relative z-10 w-full sm:w-auto">
              <h2 className="text-xl md:text-xl font-brand text-white uppercase font-bold tracking-tight leading-none">
                {isViewingToday ? (isFinishedForViewedDate ? 'Route Archive' : 'Active Route') : `Route Preview`}
              </h2>
              <div className="space-y-1">
                 <p className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">{viewedDateStr} • {logisticsTasks.length} STOPS</p>
                 {routeStartTime && <p className="text-[8px] md:text-[9px] font-bold text-teal-400 uppercase">Started: {routeStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>}
              </div>
            </div>
            <div className="text-center sm:text-right relative z-10 w-full sm:w-auto">
              {isViewingToday && routeActive ? (
                 <div className="flex flex-col items-center sm:items-end">
                   <p className="text-3xl md:text-3xl font-bold text-emerald-400 font-mono leading-none tracking-tighter shadow-[0_0_15px_rgba(52,211,153,0.2)]">{formatElapsedTime(elapsedTime)}</p>
                   <span className="text-[7px] md:text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-3 animate-pulse">LIVE</span>
                 </div>
              ) : isViewingToday && !isFinishedForViewedDate ? (
                <button onClick={handleStartDay} className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-3.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all">START ROUTE</button>
              ) : isFinishedForViewedDate ? (
                <span className="text-[9px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-4 py-2 rounded-xl border border-emerald-400/20">FINISHED</span>
              ) : (
                 <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-800 px-4 py-2 rounded-xl border border-white/5">LOCKED</span>
              )}
            </div>
          </header>

          <div className="space-y-5 md:space-y-6">
            {logisticsTasks.length === 0 ? (
              <div className="py-20 md:py-24 text-center border-2 border-dashed border-black/5 rounded-[2.5rem] md:rounded-[48px] opacity-10 italic text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Queue Clear.</div>
            ) : (
              logisticsTasks.map(task => {
                const isExtraTask = task.serviceType === 'SUPPLY DELIVERY';
                return (
                  <div key={task.id} className={`bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border shadow-xl space-y-6 md:space-y-8 transition-all ${(!task.isDelivered || (!isExtraTask && !task.isCollected)) ? 'border-orange-100 ring-1 md:ring-2 ring-orange-50/50' : 'border-slate-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 text-left flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="text-slate-900 font-extrabold uppercase text-lg md:text-xl leading-tight tracking-tighter truncate max-w-full">{task.propertyName}</h4>
                            {!isExtraTask && (
                              <label className={`flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 ${(!routeActive && !isManagerRole) ? 'opacity-50' : 'cursor-pointer'}`}>
                                <div 
                                  onClick={() => (routeActive || isManagerRole) && toggleTaskField(task.id, 'keysHandled')}
                                  className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${task.keysHandled ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}
                                >
                                  {task.keysHandled && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="5"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                                <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Keys Ready</span>
                              </label>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4 mt-5 md:mt-6 bg-slate-50/50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100">
                            <div>
                              <p className={labelStyle}>Deployment Detail</p>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="flex-1 text-[8px] md:text-[9px] bg-white text-blue-600 px-3 py-2.5 rounded-xl font-black uppercase border border-blue-100 text-center shadow-sm">G-Maps</a>
                                <a href={`https://maps.apple.com/?q=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="flex-1 text-[8px] md:text-[9px] bg-white text-slate-900 px-3 py-2.5 rounded-xl font-black uppercase border border-slate-200 text-center shadow-sm">Apple</a>
                              </div>
                            </div>

                            {task.cleanerDetails && (
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                   <p className={labelStyle}>Personnel Contact</p>
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                                         {task.cleanerDetails.name.charAt(0)}
                                      </div>
                                      <div className="text-left">
                                         <p className="text-[10px] font-black uppercase text-slate-900 leading-none">{task.cleanerDetails.name}</p>
                                         <p className="text-[9px] font-mono font-bold text-slate-500 mt-1">{task.cleanerDetails.phone || 'NO PHONE RECORDED'}</p>
                                      </div>
                                   </div>
                                   {task.cleanerDetails.phone && (
                                       <div className="flex gap-2">
                                          <a href={`tel:${task.cleanerDetails.phone}`} className="flex-1 text-[8px] bg-white text-indigo-600 py-2.5 rounded-xl border border-indigo-100 font-black uppercase text-center shadow-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                             CALL {task.cleanerDetails.name.split(' ')[0]}
                                          </a>
                                          <a href={`https://wa.me/${task.cleanerDetails.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="flex-1 text-[8px] bg-green-50 text-green-600 py-2.5 rounded-xl border border-green-100 font-black uppercase text-center shadow-sm flex items-center justify-center gap-2">
                                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                             WHATSAPP
                                          </a>
                                       </div>
                                   )}
                                </div>
                            )}
                          </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4 pt-1">
                      {isExtraTask ? (
                        <div className="flex gap-3">
                          {(routeActive || isManagerRole) ? (
                            <button 
                              onClick={() => toggleTaskField(task.id, 'isDelivered')} 
                              className={`w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-[11px] tracking-[0.2em] md:tracking-[0.3em] transition-all shadow-lg active:scale-95 ${task.isDelivered ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-indigo-500 text-indigo-600'}`}
                            >
                               {task.isDelivered ? '✓ DELIVERED' : 'MARK DELIVERED'}
                            </button>
                          ) : (
                            <div className={`w-full py-4 md:py-6 rounded-xl md:rounded-2xl text-center border shadow-inner ${task.isDelivered ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{task.isDelivered ? 'DONE' : 'PENDING'}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* PHASE 1: OFFICE PICKUP (Clean Linen) */}
                          <div className="space-y-2">
                            <p className={labelStyle}>Phase 1: Supply Chain Pickup (Office)</p>
                            {(routeActive || isManagerRole) ? (
                              <button 
                                onClick={() => toggleTaskField(task.id, 'isCleanLinenTakenFromOffice')} 
                                className={`w-full py-4 rounded-xl font-black uppercase text-[9px] md:text-[10px] transition-all shadow-md active:scale-95 ${task.isCleanLinenTakenFromOffice ? 'bg-indigo-600 text-white' : 'bg-slate-100 border border-slate-200 text-slate-500'}`}
                              >
                                 {task.isCleanLinenTakenFromOffice ? '✓ CLEAN LINEN TAKEN FROM OFFICE' : 'MARK TAKEN FROM OFFICE'}
                              </button>
                            ) : (
                              <div className={`w-full py-4 rounded-xl text-center border shadow-inner ${task.isCleanLinenTakenFromOffice ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest">{task.isCleanLinenTakenFromOffice ? 'COLLECTED FROM OFFICE' : 'AWAITING PICKUP'}</span>
                              </div>
                            )}
                          </div>

                          {/* PHASE 2 & 3: UNIT DELIVERY & DIRTY COLLECTION */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div className="space-y-2">
                              <p className={labelStyle}>Phase 2: Unit Delivery (Clean)</p>
                              {(routeActive || isManagerRole) ? (
                                <button 
                                  onClick={() => toggleTaskField(task.id, 'isDelivered')} 
                                  disabled={!task.isCleanLinenTakenFromOffice}
                                  className={`w-full py-4 rounded-xl font-black uppercase text-[9px] md:text-[10px] transition-all shadow-md active:scale-95 disabled:opacity-30 ${task.isDelivered ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-emerald-500 text-emerald-600'}`}
                                >
                                   {task.isDelivered ? '✓ DELIVERED TO UNIT' : 'MARK DELIVERED'}
                                </button>
                              ) : (
                                <div className={`w-full py-4 rounded-xl text-center border shadow-inner ${task.isDelivered ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                                  <span className="text-[9px] font-black uppercase tracking-widest">{task.isDelivered ? 'DELIVERED' : '---'}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <p className={labelStyle}>Phase 3: Unit Collection (Dirty)</p>
                              {(routeActive || isManagerRole) ? (
                                <button 
                                  onClick={() => toggleTaskField(task.id, 'isCollected')} 
                                  className={`w-full py-4 rounded-xl font-black uppercase text-[9px] md:text-[10px] transition-all shadow-md active:scale-95 ${task.isCollected ? 'bg-orange-600 text-white' : 'bg-white border-2 border-orange-500 text-orange-600'}`}
                                >
                                   {task.isCollected ? '✓ COLLECTED FROM UNIT' : 'MARK COLLECTED'}
                                </button>
                              ) : (
                                <div className={`w-full py-4 rounded-xl text-center border shadow-inner ${task.isCollected ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-300'}`}>
                                  <span className="text-[9px] font-black uppercase tracking-widest">{task.isCollected ? 'COLLECTED' : '---'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {routeActive && isViewingToday && (
            <button onClick={handleFinishDay} className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 md:py-7 rounded-[1.5rem] md:rounded-[32px] uppercase tracking-[0.3em] md:tracking-[0.4em] text-[10px] md:text-xs shadow-2xl mt-8 md:mt-12 active:scale-95 transition-all">
              FINISH ROUTE
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default DriverPortal;