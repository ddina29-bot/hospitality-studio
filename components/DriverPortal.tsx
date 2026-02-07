
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
  shifts = [], 
  setShifts,
  properties = [],
  users = [],
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

  // STRICT RULE: Drivers can only interact if it's today, route is active, and they haven't finished yet.
  const isButtonsEnabled = (isViewingToday && routeActive && !isFinishedForViewedDate) || isManagerRole;

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

  const handleStartDay = () => {
    if (!setTimeEntries || !activeUserId) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: activeUserId, type: 'in', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
    setRefreshToggle(p => p + 1);
  };

  const handleFinishDay = () => {
    if (!setTimeEntries || !activeUserId) return;
    if (!window.confirm("Confirm Route Completion? All task interactions will be locked.")) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: activeUserId, type: 'out', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
    setRefreshToggle(p => p + 1);
  };

  const toggleTaskField = (shiftId: string, field: keyof Shift) => {
    if (!isButtonsEnabled) return;
    setShifts?.(prev => prev.map(s => {
      if (s.id === shiftId) {
        return { ...s, [field]: !s[field] };
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

  const sectionLabel = "text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 block px-1";

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-1">
      
      {/* 1. ADMIN MONITOR VIEW (Summary) */}
      {isMonitorMode && (
        <div className="space-y-6">
           <header className="px-1">
             <h2 className="text-xl md:text-2xl font-serif-brand font-bold text-slate-900 tracking-tight leading-none uppercase">Linen Monitor</h2>
             <p className="text-[9px] md:text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-1.5">Real-time route oversight.</p>
           </header>
           <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden divide-y divide-slate-50">
              {users?.filter(u => u.role === 'driver' && u.status === 'active').map((d, i) => {
                const dTasks = getLogisticsTasksForUser(d.id, todayDateStr, 'driver');
                const doneCount = dTasks.filter(s => s.isDelivered && s.isCollected && s.isCleanLinenTakenFromOffice).length;
                return (
                  <div key={i} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">{d.name.charAt(0)}</div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 uppercase">{d.name}</h4>
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{doneCount} / {dTasks.length} DONE</p>
                        </div>
                     </div>
                     <button onClick={() => setOverrideDriverId(d.id)} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest">VIEW</button>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* 2. OPERATIONAL VIEW */}
      {isOperationalMode && (
        <>
          <section className="flex items-center justify-between gap-4 px-1">
             {isManagerRole && (
                <button onClick={() => { setOverrideDriverId(null); onResetOverrideId?.(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                   EXIT PREVIEW
                </button>
             )}
             <div className="flex-1 text-right">
                <p className="text-[7px] font-black text-indigo-600 uppercase tracking-widest">Operator</p>
                <p className="text-[10px] font-bold text-slate-900 uppercase leading-none">{users?.find(u => u.id === activeUserId)?.name || user.name}</p>
             </div>
          </section>

          <section className="bg-white border border-gray-200 p-3 rounded-[2rem] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {weekDays.map((wd) => (
                <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[55px] py-3 rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-slate-400'}`}>
                  <span className={`text-[7px] font-black uppercase mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-slate-400'}`}>{wd.dayName}</span>
                  <span className={`text-xs font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-slate-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          <header className="bg-[#1E293B] p-8 rounded-[3rem] shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
                <svg width="150" height="150" viewBox="0 0 24 24" fill="white"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
            </div>
            <div className="space-y-2 text-center sm:text-left relative z-10">
              <h2 className="text-xl md:text-2xl font-brand text-white uppercase font-black tracking-tight leading-none">
                {isFinishedForViewedDate ? 'ROUTE COMPLETED' : routeActive ? 'ACTIVE ROUTE' : 'READY TO DEPLOY'}
              </h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">{viewedDateStr} • {logisticsTasks.length} STOPS</p>
            </div>
            <div className="relative z-10 w-full sm:w-auto">
              {isViewingToday && routeActive && !isFinishedForViewedDate ? (
                 <div className="flex flex-col items-center sm:items-end">
                   <p className="text-3xl font-black text-indigo-400 font-mono tracking-tighter">{formatElapsedTime(elapsedTime)}</p>
                   <button onClick={handleFinishDay} className="mt-4 bg-rose-600 text-white px-8 py-3 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">FINISH DAY</button>
                 </div>
              ) : isViewingToday && !routeStartTime ? (
                <button onClick={handleStartDay} className="w-full sm:w-auto bg-[#5851DB] text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all hover:bg-indigo-700">START ROUTE</button>
              ) : (
                <div className="flex flex-col items-center sm:items-end gap-2">
                   <span className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-6 py-3 rounded-2xl border border-emerald-400/20">ROUTE ARCHIVED</span>
                   {isFinishedForViewedDate && <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">RECORD LOCKED</p>}
                </div>
              )}
            </div>
          </header>

          {!isButtonsEnabled && !isFinishedForViewedDate && isViewingToday && (
             <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] animate-in slide-in-from-top-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg">!</div>
                <div>
                   <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Action Required</p>
                   <p className="text-[11px] text-amber-700 font-bold uppercase leading-tight">Initialize the route timer above to enable task interactions.</p>
                </div>
             </div>
          )}

          <div className={`space-y-8 transition-all duration-500 ${!isButtonsEnabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
            {logisticsTasks.map(task => {
              const isExtraTask = task.serviceType === 'SUPPLY DELIVERY';
              return (
                <div key={task.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-2xl space-y-8 transition-all hover:shadow-indigo-900/5 group relative overflow-hidden">
                  {!isButtonsEnabled && (
                     <div className="absolute top-4 right-4 z-20 opacity-40">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                     </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1 text-left flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                           <h4 className="text-slate-900 font-black uppercase text-xl leading-tight tracking-tighter truncate">{task.propertyName}</h4>
                           {!isExtraTask && (
                             <button 
                               onClick={() => isButtonsEnabled && toggleTaskField(task.id, 'keysHandled')}
                               disabled={!isButtonsEnabled}
                               className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${task.keysHandled ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                             >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center ${task.keysHandled ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                   {task.keysHandled && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="5"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                                <span className="text-[7px] font-black uppercase tracking-widest">KEYS READY</span>
                             </button>
                           )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{task.serviceType}</p>
                    </div>
                  </div>

                  {/* DEPLOYMENT DETAIL SUITE */}
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Deployment Detail</p>
                          <div className="text-right">
                             <p className="text-[9px] font-black text-slate-900 uppercase leading-none">{task.cleanerDetails?.name || 'Unassigned'}</p>
                             <p className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest mt-1">CLEANER ASSIGNED</p>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                         <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="bg-white border border-slate-200 text-indigo-600 py-3 rounded-xl text-[8px] font-black uppercase text-center shadow-sm hover:border-indigo-200 transition-all">G-MAPS</a>
                         <a href={`https://maps.apple.com/?q=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="bg-white border border-slate-200 text-slate-900 py-3 rounded-xl text-[8px] font-black uppercase text-center shadow-sm hover:border-indigo-200 transition-all">APPLE</a>
                         <a href={task.cleanerDetails?.phone ? `tel:${task.cleanerDetails.phone}` : '#'} className={`bg-white border border-slate-200 text-slate-400 py-3 rounded-xl text-[8px] font-black uppercase text-center shadow-sm hover:text-slate-600 transition-all ${!task.cleanerDetails?.phone && 'opacity-20 pointer-events-none'}`}>CALL STAFF</a>
                         <a href={task.cleanerDetails?.phone ? `https://wa.me/${task.cleanerDetails.phone.replace(/\D/g,'')}` : '#'} target="_blank" className={`bg-emerald-50 border border-emerald-100 text-emerald-600 py-3 rounded-xl text-[8px] font-black uppercase text-center shadow-sm hover:bg-emerald-100 transition-all ${!task.cleanerDetails?.phone && 'opacity-20 pointer-events-none'}`}>WHATSAPP</a>
                      </div>
                  </div>

                  {/* PHASES ACTION AREA */}
                  <div className="space-y-6">
                     <div className="space-y-3">
                        <p className={sectionLabel}>Phase 1: Supply Chain Pickup (Office)</p>
                        <button 
                           onClick={() => toggleTaskField(task.id, 'isCleanLinenTakenFromOffice')} 
                           disabled={!isButtonsEnabled}
                           className={`w-full py-4 md:py-5 rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none ${task.isCleanLinenTakenFromOffice ? 'bg-indigo-600 text-white shadow-indigo-900/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                        >
                           {task.isCleanLinenTakenFromOffice ? '✓ COLLECTED FROM OFFICE' : 'MARK TAKEN FROM OFFICE'}
                        </button>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                           <p className={sectionLabel}>Phase 2: Unit Delivery (Clean)</p>
                           <button 
                              onClick={() => toggleTaskField(task.id, 'isDelivered')} 
                              disabled={!isButtonsEnabled || !task.isCleanLinenTakenFromOffice}
                              className={`w-full py-4 md:py-5 rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:shadow-none ${task.isDelivered ? 'bg-emerald-600 text-white shadow-emerald-900/20' : 'bg-white border-2 border-emerald-500 text-emerald-600'}`}
                           >
                              {task.isDelivered ? '✓ DELIVERED' : 'MARK DELIVERED'}
                           </button>
                        </div>
                        <div className="space-y-3">
                           <p className={sectionLabel}>Phase 3: Unit Collection (Dirty)</p>
                           <button 
                              onClick={() => toggleTaskField(task.id, 'isCollected')} 
                              disabled={!isButtonsEnabled}
                              className={`w-full py-4 md:py-5 rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:shadow-none ${task.isCollected ? 'bg-orange-600 text-white shadow-orange-900/20' : 'bg-white border-2 border-orange-500 text-orange-600'}`}
                           >
                              {task.isCollected ? '✓ COLLECTED' : 'MARK COLLECTED'}
                           </button>
                        </div>
                     </div>
                  </div>
                </div>
              );
            })}
            {logisticsTasks.length === 0 && (
               <div className="py-32 text-center opacity-10 font-black uppercase tracking-[0.4em] text-slate-900">
                  Mission Queue Clear.
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DriverPortal;
