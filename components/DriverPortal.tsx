
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
  
  // ROLE LOGIC
  // 'user' here is the "mockUser" from App.tsx, so user.role is actually the effectiveRole
  const isDriverRole = user.role === 'driver';
  const isManagerRole = user.role === 'admin' || user.role === 'housekeeping';
  
  // Operational View: Shown if user is acting as a Driver OR an Admin deep-diving into a specific driver
  const isOperationalMode = isDriverRole || (isManagerRole && !!overrideDriverId);
  
  // Monitor View: Shown to Managers only when they are NOT overriding a specific driver
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

  // Which user ID are we interacting with for the current view?
  const activeUserId = isOperationalMode ? (overrideDriverId || user.id) : null;
  const isViewingToday = viewedDate === realTodayISO;

  // SHARED LOGISTICS FILTER LOGIC (Used by both Monitor and Operational Views)
  const getLogisticsTasksForUser = (userId: string, dateStr: string, activeRole: string) => {
    return (shifts || []).filter(s => {
      if (!s.isPublished || s.excludeLaundry || s.date !== dateStr) return false;
      
      // 1. Explicit Assignment (Always show if ID is in list)
      if (s.userIds.includes(userId)) return true;
      
      // 2. Implicit Driver Access (Show all unassigned logistics to any personnel currently acting as a driver)
      const isLogisticsType = ['Check out/check in', 'REFRESH', 'MID STAY CLEANING', 'BEDS ONLY', 'Common Area'].includes(s.serviceType);
      return isLogisticsType && activeRole === 'driver';
    });
  };

  // ROUTE TIMING
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
    // Find the latest 'out' after the first 'in'
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
      interval = setInterval(updateTimer, 10000); 
    }
    return () => clearInterval(interval);
  }, [routeActive, isViewingToday, routeStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  };

  // STOP LIST FILTERING
  const logisticsTasks = useMemo(() => {
    if (!activeUserId) return [];
    
    // Determine the role of the person we are viewing
    // If override, it's that user's database role. If simulating, it's the simulated role from 'user.role'
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

  // MONITOR VIEW DATA
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

  const handleSaveKeyNote = (id: string) => {
    if (!reasons[id]) return;
    setShifts?.(prev => prev.map(s => s.id === id ? { ...s, keyLocationReason: reasons[id] } : s));
    alert("Key status updated.");
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

  const labelStyle = "text-[7px] font-black text-teal-700 uppercase tracking-[0.4em] mb-1.5 opacity-60";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-2">
      
      {/* 1. ADMIN MONITOR VIEW */}
      {isMonitorMode && (
        <div className="space-y-8">
           <header>
             <h2 className="text-2xl font-serif-brand font-bold text-slate-900 tracking-tight leading-none uppercase">Activity Monitor</h2>
             <p className="text-[9px] text-teal-600 font-bold uppercase tracking-[0.4em] mt-2">FLEET STATUS OVERVIEW</p>
           </header>

           <div className="bg-white border border-teal-100 rounded-[40px] shadow-2xl overflow-hidden divide-y divide-slate-50">
              {monitorData.length === 0 ? (
                <div className="p-20 text-center opacity-20 font-black uppercase text-[10px]">No active drivers.</div>
              ) : monitorData.map((session, i) => (
                <div key={i} className="p-8 flex flex-col md:flex-row justify-between items-center gap-6 hover:bg-teal-50/20 transition-colors">
                   <div className="flex items-center gap-6 flex-1">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl ${session.isActive ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                         {session.driver.name.charAt(0)}
                      </div>
                      <div className="text-left">
                         <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{session.driver.name}</h4>
                         <p className="text-[9px] font-black uppercase tracking-widest text-teal-500">Progress: {session.progress} STOPS</p>
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
                <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Active Personnel</p>
                <p className="text-[10px] font-bold text-slate-900 uppercase leading-none">{users?.find(u => u.id === activeUserId)?.name || user.name}</p>
             </div>
          </section>

          <section className="bg-white border border-gray-200 p-4 rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {weekDays.map((wd) => (
                <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-400 hover:border-teal-600/40'}`}>
                  <span className={`text-[8px] font-black uppercase mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                  <span className={`text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          <header className="flex justify-between items-center bg-teal-50 p-6 rounded-[32px] border border-teal-100 shadow-xl">
            <div className="space-y-2 text-left">
              <h2 className="text-xl font-brand text-black uppercase font-bold tracking-tight leading-none">
                {isViewingToday ? (isFinishedForViewedDate ? 'Route Archive' : 'Active Route') : `Route Preview`}
              </h2>
              <div className="space-y-1">
                 <p className="text-[10px] text-teal-800/60 uppercase tracking-widest">{viewedDateStr} • {logisticsTasks.length} STOP(S)</p>
                 {routeStartTime && <p className="text-[9px] font-bold text-black/80 uppercase">Started: {routeStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>}
              </div>
            </div>
            <div className="text-right">
              {isViewingToday && routeActive ? (
                 <div className="flex flex-col items-end">
                   <p className="text-xl font-bold text-black font-mono leading-none">{formatElapsedTime(elapsedTime)}</p>
                   <span className="text-[7px] font-black text-green-600 uppercase tracking-widest mt-1 animate-pulse">SESSION LIVE</span>
                 </div>
              ) : isViewingToday && !isFinishedForViewedDate ? (
                <button onClick={handleStartDay} className="bg-[#0D9488] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform">START ROUTE</button>
              ) : isFinishedForViewedDate ? (
                <span className="text-[9px] font-black text-green-600 uppercase bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">FINISHED</span>
              ) : (
                 <span className="text-[9px] font-black text-teal-600 uppercase bg-teal-50 px-4 py-2 rounded-xl border border-teal-100">LOCKED</span>
              )}
            </div>
          </header>

          <div className="space-y-6">
            {logisticsTasks.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em]">No active route assignments for this personnel.</div>
            ) : (
              logisticsTasks.map(task => (
                <div key={task.id} className={`bg-white p-6 rounded-[32px] border shadow-xl space-y-6 transition-all hover:border-teal-200 ${(!task.isDelivered || !task.isCollected) ? 'border-orange-300 ring-2 ring-orange-50' : 'border-slate-100'} ${(!routeActive && !isManagerRole) ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 text-left flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <h4 className="text-black font-bold uppercase text-lg leading-tight tracking-tight">{task.propertyName}</h4>
                          <label className={`flex items-center gap-2 group bg-teal-50 px-3 py-1.5 rounded-full border border-teal-200 ${(!routeActive && !isManagerRole) ? 'opacity-50' : 'cursor-pointer'}`}>
                            <div 
                              onClick={() => (routeActive || isManagerRole) && toggleTaskField(task.id, 'keysHandled')}
                              className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${task.keysHandled ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300'}`}
                            >
                              {task.keysHandled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="text-[8px] font-black text-teal-600 uppercase tracking-widest whitespace-nowrap">Keys from Office</span>
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                          <div>
                            <p className={labelStyle}>Staff Onsite</p>
                            <p className="text-[11px] text-black font-bold uppercase">{task.cleanerDetails?.name || 'N/A'}</p>
                            {task.cleanerDetails?.phone && (
                              <div className="flex gap-2 mt-1.5">
                                 <a href={`tel:${task.cleanerDetails.phone}`} className="text-[8px] bg-white text-teal-700 px-3 py-1 rounded-lg border border-teal-100 font-black uppercase shadow-sm">Call</a>
                                 <a href={`https://wa.me/${task.cleanerDetails.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[8px] bg-green-50 text-green-600 px-3 py-1 rounded-lg border border-green-100 font-black uppercase shadow-sm">WhatsApp</a>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className={labelStyle}>Navigate To Stop</p>
                            <div className="flex gap-2">
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="text-[9px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase border border-blue-100">G-Maps</a>
                              <a href={`https://maps.apple.com/?q=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="text-[9px] bg-gray-50 text-black px-3 py-1.5 rounded-lg font-black uppercase border border-gray-200">Apple</a>
                            </div>
                          </div>
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {(routeActive || isManagerRole) ? (
                        <>
                            <button onClick={() => toggleTaskField(task.id, 'isDelivered')} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.isDelivered ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-black/40 hover:bg-gray-50'}`}>DELIVERED</button>
                            <button onClick={() => toggleTaskField(task.id, 'isCollected')} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.isCollected ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-black/40 hover:bg-gray-50'}`}>COLLECTED</button>
                        </>
                        ) : (
                        <>
                            <div className={`flex-1 py-4 rounded-2xl text-center border shadow-sm ${task.isDelivered ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                            <span className="text-[9px] font-black uppercase">{task.isDelivered ? '✓ DELIVERED' : 'PENDING'}</span>
                            </div>
                            <div className={`flex-1 py-4 rounded-2xl text-center border shadow-sm ${task.isCollected ? 'bg-teal-50 border-teal-200 text-teal-600' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                            <span className="text-[9px] font-black uppercase">{task.isCollected ? '✓ COLLECTED' : 'PENDING'}</span>
                            </div>
                        </>
                        )}
                    </div>

                    {task.keysHandled && (
                        <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 flex flex-col sm:flex-row items-center gap-4">
                           <div className="flex-1 w-full text-left">
                              <p className="text-[8px] font-black text-teal-700 uppercase tracking-widest mb-1.5">Key Status (If Not Back)</p>
                              <div className="flex gap-2">
                                 <input 
                                    className="flex-1 bg-white border border-teal-200 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-teal-500"
                                    placeholder="Enter reason..."
                                    value={reasons[task.id] || task.keyLocationReason || ''}
                                    onChange={(e) => setReasons({...reasons, [task.id]: e.target.value})}
                                    disabled={!routeActive && !isManagerRole}
                                 />
                                 <button onClick={() => handleSaveKeyNote(task.id)} disabled={!routeActive && !isManagerRole} className="px-4 bg-teal-100 text-teal-700 font-bold rounded-lg text-[9px] hover:bg-teal-200">SAVE</button>
                              </div>
                           </div>
                           {(routeActive || isManagerRole) ? (
                              <button onClick={() => toggleTaskField(task.id, 'keysAtOffice', reasons[task.id])} className={`w-full sm:w-auto px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.keysAtOffice ? 'bg-teal-600 text-white' : 'bg-white border border-teal-300 text-teal-500'}`}>
                                 {task.keysAtOffice ? 'RETURNED' : 'MARK RETURNED'}
                              </button>
                           ) : (
                              <div className={`px-8 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest ${task.keysAtOffice ? 'bg-teal-50 border-teal-200 text-teal-600' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                                 {task.keysAtOffice ? '✓ RETURNED' : 'KEYS HELD'}
                              </div>
                           )}
                        </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {routeActive && isViewingToday && (
            <button onClick={handleFinishDay} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-3xl uppercase tracking-[0.3em] text-xs shadow-2xl mt-12 active:scale-95 transition-all border-4 border-red-500/20">
              FINISH THE DAY
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default DriverPortal;
