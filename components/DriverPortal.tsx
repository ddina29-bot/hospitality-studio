
import React, { useMemo, useState, useEffect } from 'react';
import { TabType, User, Shift, Property, ManualTask, SupplyRequest, TimeEntry } from '../../types';

interface DriverPortalProps {
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
}

const DriverPortal: React.FC<DriverPortalProps> = ({ 
  supplyRequests = [], 
  setSupplyRequests,
  manualTasks = [],
  setManualTasks,
  shifts = [], 
  setShifts,
  properties = [],
  users = [],
  setActiveTab,
  timeEntries = []
}) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overrideDriverId, setOverrideDriverId] = useState<string | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  
  const getLocalISO = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const realTodayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  const [viewedDate, setViewedDate] = useState(realTodayISO);
  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDate]);

  const activeUserId = overrideDriverId || currentUser.id;
  const isViewingToday = viewedDate === realTodayISO;
  const isAdmin = currentUser.role === 'admin';
  const isHousekeeping = currentUser.role === 'housekeeping';
  const isManager = isAdmin || isHousekeeping;

  // Derive Route Status from Time Entries (Server Sync)
  const todaysEntries = useMemo(() => {
    return timeEntries
        .filter(e => e.userId === activeUserId && e.timestamp.startsWith(realTodayISO))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [timeEntries, activeUserId, realTodayISO]);

  const routeStartTime = useMemo(() => {
    const startEntry = todaysEntries.find(e => e.type === 'in');
    return startEntry ? new Date(startEntry.timestamp) : null;
  }, [todaysEntries]);

  const routeEndTime = useMemo(() => {
    // Only valid if there's a corresponding start
    if (!routeStartTime) return null;
    const endEntry = todaysEntries.reverse().find(e => e.type === 'out' && new Date(e.timestamp) > routeStartTime);
    return endEntry ? new Date(endEntry.timestamp) : null;
  }, [todaysEntries, routeStartTime]);

  const routeActive = !!routeStartTime && !routeEndTime;
  const isFinishedForViewedDate = !!routeEndTime;

  // Local Timer
  useEffect(() => {
    let interval: any;
    if (routeActive && isViewingToday && !isManager) {
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
  }, [routeActive, isViewingToday, routeStartTime, isManager]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  };

  const currentManualTasks = useMemo(() => {
    const relevantTasks = manualTasks.filter(t => 
      t.date.split('T')[0] === viewedDate &&
      (t.userId === activeUserId || !t.userId)
    );
    return relevantTasks.filter(t => {
       const shiftForProp = shifts.find(s => s.propertyId === t.propertyId && s.date === viewedDateStr);
       if (shiftForProp && !shiftForProp.isPublished) return false;
       return true;
    });
  }, [manualTasks, viewedDate, activeUserId, shifts, viewedDateStr]);

  const logisticsTasks = useMemo(() => {
    return (shifts || []).filter(s => {
      if (!s.isPublished) return false;
      if (s.excludeLaundry) return false;
      if (s.date !== viewedDateStr) return false;
      const assignedToOtherDriver = s.userIds.some(id => {
         const u = users.find(user => user.id === id);
         return u?.role === 'driver' && id !== activeUserId;
      });
      if (assignedToOtherDriver) return false;
      if (s.userIds.includes(activeUserId)) return true;
      const isLogisticsOrCleaning = ['CHECK OUT / CHECK IN CLEANING', 'REFRESH', 'MID STAY CLEANING', 'BEDS ONLY', 'LINEN DROP / COLLECTION'].includes(s.serviceType);
      return isLogisticsOrCleaning;
    }).map(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      const cleanerId = s.userIds.find(uid => {
        const u = users.find(user => user.id === uid);
        return u?.role === 'cleaner' || u?.role === 'supervisor';
      });
      const cleaner = users.find(u => u.id === cleanerId);
      const relatedExtraTasks = currentManualTasks.filter(mt => mt.propertyId === s.propertyId);
      return { ...s, propDetails: prop, cleanerDetails: cleaner, extraTasks: relatedExtraTasks };
    });
  }, [shifts, viewedDateStr, properties, users, currentManualTasks, activeUserId]);

  const activeSupplyTasks = useMemo(() => {
    return supplyRequests.filter(r => (r.status === 'approved' || r.status === 'pending') && r.date.split('T')[0] === viewedDate && (r.userId === activeUserId || true));
  }, [supplyRequests, viewedDate, activeUserId]);

  const standaloneManualTasks = useMemo(() => {
    const logisticsPropIds = new Set(logisticsTasks.map(t => t.propertyId));
    return currentManualTasks.filter(t => !logisticsPropIds.has(t.propertyId));
  }, [currentManualTasks, logisticsTasks]);

  const groupedStandaloneByProperty = useMemo(() => {
    const propertyGroups: Record<string, { propertyId: string, propertyName: string, items: ManualTask[] }> = {};
    standaloneManualTasks.forEach(t => {
      if (!propertyGroups[t.propertyId]) {
        propertyGroups[t.propertyId] = { propertyId: t.propertyId, propertyName: t.propertyName, items: [] };
      }
      propertyGroups[t.propertyId].items.push(t);
    });
    return Object.values(propertyGroups);
  }, [standaloneManualTasks]);

  const groupedSuppliesByUser = useMemo(() => {
    const groups: Record<string, SupplyRequest[]> = {};
    activeSupplyTasks.forEach(s => {
      if (!groups[s.userId]) groups[s.userId] = [];
      groups[s.userId].push(s);
    });
    return Object.values(groups);
  }, [activeSupplyTasks]);

  const tomorrowTasks = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = getLocalISO(tomorrow);
    return [
      ...supplyRequests.filter(r => r.date.split('T')[0] === tomorrowISO).map(r => ({ name: r.itemName, type: 'Supply' })),
      ...manualTasks.filter(t => t.date.split('T')[0] === tomorrowISO).map(t => ({ name: t.taskName, type: 'Extra Task' }))
    ];
  }, [supplyRequests, manualTasks, activeUserId]);

  // LOGISTICS ALERTS (For Driver's own view)
  const unresolvedLogistics = useMemo(() => {
    return logisticsTasks.filter(t => !t.isDelivered || !t.isCollected || (t.keysHandled && !t.keysAtOffice));
  }, [logisticsTasks]);

  const handleStartDay = () => {
    // We assume App.tsx passes setTimeEntries to trigger a real save
    localStorage.setItem(`route_start_time_${activeUserId}`, Date.now().toString());
    localStorage.setItem(`route_active_${activeUserId}`, 'true');
    setRefreshToggle(prev => prev + 1);
  };

  const handleFinishDay = () => {
    if (isHousekeeping && !overrideDriverId) return; 
    localStorage.removeItem(`route_active_${activeUserId}`);
    localStorage.removeItem(`route_start_time_${activeUserId}`);
    setRefreshToggle(prev => prev + 1);
    if (setActiveTab && !overrideDriverId) setActiveTab('dashboard');
  };

  const toggleTaskField = (shiftId: string, field: keyof Shift, reason?: string) => {
    // Allow toggle if driver/admin is viewing today, regardless of route timer
    if (!canInteract) return;
    
    setShifts?.(prev => prev.map(s => {
      if (s.id === shiftId) {
        const updated = { ...s, [field]: !s[field] };
        if (field === 'keysAtOffice' && reason) {
            updated.keyLocationReason = reason;
        }
        if (isAdmin && overrideDriverId) updated.replacedUserId = currentUser.id;
        return updated;
      }
      return s;
    }));
  };

  const toggleManualTaskDone = (taskId: string) => {
    if (!canInteract) return;
    setManualTasks?.(prev => prev.map(t => t.id === taskId ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t));
  };

  const handleUpdateReason = (id: string, val: string) => {
    setReasons(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveKeyNote = (id: string) => {
    if (!reasons[id]) return;
    setShifts?.(prev => prev.map(s => 
      s.id === id ? { ...s, keyLocationReason: reasons[id] } : s
    ));
    alert("Reason Saved");
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
      days.push({
        iso,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateNum: d.getDate(),
        isToday: iso === realTodayISO
      });
    }
    return days;
  }, [realTodayISO]);

  const driverList = useMemo(() => users.filter(u => u.role === 'driver' && u.status === 'active' && u.id !== currentUser.id), [users, currentUser.id]);
  const canInteract = (currentUser.role === 'driver' || isAdmin) && isViewingToday;
  const labelStyle = "text-[7px] font-black text-[#A68342] uppercase tracking-[0.4em] mb-1 opacity-60";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-2">
      {isAdmin && (
        <section className="bg-[#F6E6C2] text-black p-8 rounded-[40px] shadow-2xl border border-[#C5A059]/40 space-y-6">
           <div className="flex items-center justify-between">
              <div><p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1 opacity-40">Admin Overload Portal</p><h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight text-black">Emergency Route Override</h3></div>
              <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-pulse"></div>
           </div>
           <div className="space-y-2">
              <label className="text-[7px] font-black uppercase tracking-[0.2em] opacity-40 text-black">Select Driver to Replace</label>
              <select className="w-full bg-white border border-[#C5A059]/30 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black outline-none focus:border-[#C5A059] shadow-sm" value={overrideDriverId || ''} onChange={(e) => { setOverrideDriverId(e.target.value || null); setRefreshToggle(prev => prev + 1); }}>
                <option value="">VIEW MY TASKS / SELECT DRIVER...</option>
                {driverList.map(d => (<option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>))}
              </select>
           </div>
           {overrideDriverId && <p className="text-[8px] font-black uppercase tracking-widest text-green-700 animate-in slide-in-from-top-2">* ACTIVE: You are currently managing the route for {users.find(u => u.id === overrideDriverId)?.name.toUpperCase()}</p>}
        </section>
      )}

      {isHousekeeping && !overrideDriverId && (
        <div className="mb-6 px-2"><p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px] mb-1">Administrative Terminal</p><h2 className="text-2xl font-serif-brand text-black uppercase tracking-tight">READ-ONLY ACCESS: DRIVER ROUTES</h2></div>
      )}

      <section className="bg-white border border-gray-200 p-4 rounded-[32px] shadow-sm">
        <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {weekDays.map((wd) => (
            <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-400 hover:border-[#C5A059]/40'}`}>
              <span className={`text-[8px] font-black uppercase mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
              <span className={`text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
            </button>
          ))}
        </div>
      </section>

      {/* HEADER WITH TIMES */}
      <header className="flex justify-between items-center bg-[#FDF8EE] p-6 rounded-[32px] border border-[#D4B476]/30 shadow-xl">
        <div className="space-y-2 text-left">
          <h2 className="text-xl font-serif-brand text-black uppercase font-bold tracking-tight">
            {isViewingToday ? (isFinishedForViewedDate ? 'Route Archive' : 'Daily Route') : `Route Preview`}
          </h2>
          <div className="space-y-1">
             <p className="text-[10px] text-black/60 uppercase tracking-widest">{viewedDateStr} • {logisticsTasks.length + activeSupplyTasks.length + standaloneManualTasks.length} STOP(S)</p>
             {(routeStartTime || routeEndTime) && (
               <div className="flex gap-4 text-[9px] font-bold text-black/80 uppercase pt-1">
                  {routeStartTime && <span>Start: {routeStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                  {routeEndTime && <span>Finish: {routeEndTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
               </div>
             )}
          </div>
        </div>
        <div className="text-right">
          {isViewingToday && routeActive ? (
             <>
               {!isManager ? (
                 <p className="text-xl font-bold text-black font-mono leading-none">{formatElapsedTime(elapsedTime)}</p>
               ) : (
                 <span className="text-[9px] font-black text-green-600 uppercase bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">ROUTE ACTIVE</span>
               )}
             </>
          ) : isViewingToday && canInteract && !isFinishedForViewedDate ? (
            <button onClick={handleStartDay} className="bg-[#C5A059] text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 transition-transform">START ROUTE</button>
          ) : isFinishedForViewedDate ? (
            <span className="text-[9px] font-black text-green-600 uppercase bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">FINISHED</span>
          ) : isHousekeeping && !overrideDriverId ? (
            <span className="text-[9px] font-black text-[#A68342] uppercase bg-[#A68342]/10 px-4 py-2 rounded-xl border border-[#A68342]/20">VIEWING</span>
          ) : null}
        </div>
      </header>

      {/* ALERT FOR UNDELIVERED ITEMS */}
      {isViewingToday && unresolvedLogistics.length > 0 && (
         <div className="bg-red-50 border-2 border-red-500 p-6 rounded-[32px] shadow-xl animate-pulse">
            <div className="flex items-center gap-3 mb-2">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
               <h3 className="text-xs font-black text-red-700 uppercase tracking-widest">PENDING LOGISTICS ALERT</h3>
            </div>
            <p className="text-[10px] font-bold text-red-600 uppercase mb-3">You have {unresolvedLogistics.length} incomplete delivery/collection tasks.</p>
            <div className="space-y-1">
               {unresolvedLogistics.slice(0, 3).map(t => (
                  <div key={t.id} className="text-[9px] text-red-500 font-bold uppercase">• {t.propertyName} ({!t.isDelivered ? 'Delivery' : ''} {!t.isCollected ? 'Collection' : ''})</div>
               ))}
               {unresolvedLogistics.length > 3 && <div className="text-[9px] text-red-500 font-bold uppercase italic">...and {unresolvedLogistics.length - 3} more</div>}
            </div>
         </div>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          {logisticsTasks.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em]">No active route assignments.</div>
          ) : logisticsTasks.map(task => (
            <div key={task.id} className={`bg-[#FDF8EE] p-6 rounded-[32px] border shadow-xl space-y-6 transition-all hover:border-[#D4B476] ${(!task.isDelivered || !task.isCollected) ? 'border-orange-300 ring-2 ring-orange-100' : 'border-[#D4B476]/30'}`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1 text-left flex-1">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h4 className="text-black font-bold uppercase text-lg leading-tight">{task.propertyName}</h4>
                      <label className={`flex items-center gap-2 cursor-pointer group bg-white/60 px-3 py-1.5 rounded-full border border-orange-500/30 ${(isHousekeeping && !overrideDriverId) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div 
                          onClick={() => !(isHousekeeping && !overrideDriverId) && toggleTaskField(task.id, 'keysHandled')}
                          className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${task.keysHandled ? 'bg-orange-50 border-orange-500' : 'bg-white border-gray-300'}`}
                        >
                          {task.keysHandled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest whitespace-nowrap">Keys from Office</span>
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-white/40 p-4 rounded-2xl border border-gray-100">
                      <div>
                        <p className={labelStyle}>Staff Assigned</p>
                        <p className="text-[11px] text-black font-bold uppercase">{task.cleanerDetails?.name || 'N/A'}</p>
                        {task.cleanerDetails?.phone && (
                          <a href={`tel:${task.cleanerDetails.phone}`} className="text-[10px] text-[#A68342] font-black uppercase flex items-center gap-1.5 mt-1 hover:underline">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              {task.cleanerDetails.phone}
                          </a>
                        )}
                      </div>
                      <div>
                        <p className={labelStyle}>Address Link</p>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.propDetails?.address || '')}`} target="_blank" className="text-[10px] text-black underline uppercase font-black hover:text-[#A68342] transition-colors">Navigate</a>
                      </div>
                    </div>

                    {task.extraTasks && task.extraTasks.length > 0 && (
                      <div className="mt-4 bg-[#FCF5E5] border border-[#A68342]/20 p-5 rounded-2xl space-y-4 shadow-sm animate-in slide-in-from-top-2">
                        <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em] mb-1">Extra Tasks for Unit</p>
                        {task.extraTasks.map(et => (
                          <div key={et.id} className="flex items-center justify-between gap-3 group">
                            <p className={`text-[10px] font-bold uppercase transition-all ${et.status === 'completed' ? 'text-[#A68342]/30 line-through' : 'text-[#A68342]'}`}>{et.taskName}</p>
                            <button 
                              onClick={() => toggleManualTaskDone(et.id)}
                              className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center shrink-0 ${et.status === 'completed' ? 'bg-[#A68342] border-[#A68342] shadow-inner' : 'bg-white border-[#A68342]/30 hover:border-[#A68342]'}`}
                            >
                              {et.status === 'completed' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {task.notes && (
                      <div className="mt-3 p-3 bg-white/50 rounded-xl border border-[#D4B476]/10">
                        <p className={labelStyle}>Scheduling Note</p>
                        <p className="text-[10px] text-black/80 italic font-medium leading-relaxed">"{task.notes}"</p>
                      </div>
                    )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {canInteract ? (
                    <>
                        <button onClick={() => toggleTaskField(task.id, 'isDelivered')} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.isDelivered ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-black/40 hover:bg-gray-50'}`}>DELIVERED</button>
                        <button onClick={() => toggleTaskField(task.id, 'isCollected')} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.isCollected ? 'bg-[#C5A059] text-white' : 'bg-white border border-gray-200 text-black/40 hover:bg-gray-50'}`}>COLLECTED</button>
                    </>
                    ) : (
                    <>
                        <div className={`flex-1 py-4 rounded-2xl text-center border shadow-sm ${task.isDelivered ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                        <span className="text-[9px] font-black uppercase">{task.isDelivered ? '✓ DELIVERED' : 'PENDING'}</span>
                        </div>
                        <div className={`flex-1 py-4 rounded-2xl text-center border shadow-sm ${task.isCollected ? 'bg-yellow-50 border-yellow-200 text-[#A68342]' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                        <span className="text-[9px] font-black uppercase">{task.isCollected ? '✓ COLLECTED' : 'PENDING'}</span>
                        </div>
                    </>
                    )}
                </div>

                {task.keysHandled && (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 flex flex-col sm:flex-row items-center gap-4">
                       <div className="flex-1 w-full">
                          <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1.5">Key Status Reason (If Not Returned)</p>
                          <div className="flex gap-2">
                             <input 
                                className="flex-1 bg-white border border-orange-300 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-orange-500"
                                placeholder="Why key isn't back? (e.g. Guest inside)"
                                value={reasons[task.id] || task.keyLocationReason || ''}
                                onChange={(e) => handleUpdateReason(task.id, e.target.value)}
                             />
                             <button onClick={() => handleSaveKeyNote(task.id)} className="px-4 bg-orange-200 text-orange-700 font-bold rounded-lg text-[9px] hover:bg-orange-300">SAVE</button>
                          </div>
                       </div>
                       {canInteract ? (
                          <button onClick={() => toggleTaskField(task.id, 'keysAtOffice', reasons[task.id])} className={`w-full sm:w-auto px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm ${task.keysAtOffice ? 'bg-orange-600 text-white' : 'bg-white border border-orange-300 text-orange-500 hover:bg-orange-50'}`}>
                             {task.keysAtOffice ? 'RETURNED' : 'MARK RETURNED'}
                          </button>
                       ) : (
                          <div className={`px-8 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest ${task.keysAtOffice ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white/40 border-gray-200 text-black/10'}`}>
                             {task.keysAtOffice ? '✓ RETURNED' : 'KEYS HELD'}
                          </div>
                       )}
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ... (Rest of existing content like groupedStandaloneByProperty and groupedSuppliesByUser) ... */}
        {groupedStandaloneByProperty.length > 0 && (
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A68342] animate-pulse"></span>
                <p className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.4em] italic">Extra tasks</p>
             </div>
             {groupedStandaloneByProperty.map((group, i) => (
               <div key={i} className={`bg-[#FCF5E5] p-6 rounded-[32px] border shadow-2xl flex flex-col gap-4 border-[#A68342]/30 animate-in fade-in`}>
                  <div className="flex justify-between items-start border-b border-[#A68342]/20 pb-4">
                    <div className="text-left space-y-1">
                      <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] mb-1">Unit Address:</p>
                      <p className="text-sm font-bold text-[#A68342] uppercase tracking-tight">{group.propertyName}</p>
                    </div>
                    <span className="text-[7px] text-[#A68342] uppercase font-black bg-white/40 px-2 py-0.5 rounded border border-[#A68342]/10">STANDALONE</span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-4 group">
                         <div className="text-left flex-1 min-w-0">
                            <p className={`text-[11px] font-bold uppercase truncate transition-all ${task.status === 'completed' ? 'text-[#A68342]/40 line-through' : 'text-[#A68342]'}`}>{task.taskName}</p>
                         </div>
                         <button 
                          onClick={() => toggleManualTaskDone(task.id)}
                          className={`w-7 h-7 rounded border-2 transition-all flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-[#A68342] border-[#A68342] shadow-inner' : 'bg-white border-[#A68342]/30 hover:border-[#A68342]'}`}
                         >
                            {task.status === 'completed' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                         </button>
                      </div>
                    ))}
                  </div>
               </div>
             ))}
          </div>
        )}

        {groupedSuppliesByUser.length > 0 && (
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A68342] animate-pulse"></span>
                <p className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.4em] italic">Supply Chain Drop-Offs</p>
             </div>
             {groupedSuppliesByUser.map((batch, i) => (
               <div key={i} className={`bg-[#FDF8EE] p-6 rounded-[32px] border shadow-md flex flex-col gap-4 group transition-all border-[#D4B476]/30`}>
                  <div className="flex justify-between items-start border-b border-black/5 pb-4">
                    <div className="text-left space-y-1">
                      <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] mb-1">To staff member:</p>
                      <p className="text-sm font-bold text-black uppercase tracking-tight">{batch[0].userName}</p>
                    </div>
                    <span className="text-[7px] text-black/20 uppercase font-black">Provisioning</span>
                  </div>
                  <div className="space-y-3">
                    {batch.map(req => (
                      <div key={req.id} className="flex items-center justify-between">
                         <div className="text-left">
                            <p className="text-[11px] font-bold text-black uppercase">{req.itemName}</p>
                            {req.status === 'pending' && (
                              <span className="text-[7px] font-black text-orange-500 uppercase bg-orange-50 px-2 py-0.5 rounded border border-orange-200 inline-block mt-1">Awaiting Approval</span>
                            )}
                         </div>
                         <p className="text-[11px] font-black text-[#A68342] uppercase">QTY: {req.quantity}</p>
                      </div>
                    ))}
                  </div>
               </div>
             ))}
          </div>
        )}
        
        {isViewingToday && tomorrowTasks.length > 0 && (
          <section className="bg-[#A68342] text-white p-8 rounded-[40px] shadow-2xl space-y-4 animate-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                   <h3 className="text-xs font-serif-brand uppercase font-bold tracking-widest text-white">Tomorrow's Outlook</h3>
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Next Day Preview</span>
             </div>
             <div className="space-y-3">
                {tomorrowTasks.map((t, idx) => (
                  <div key={idx} className="bg-white/10 border border-white/10 p-4 rounded-2xl flex justify-between items-center">
                    <p className="text-[11px] font-bold uppercase text-white">{t.name}</p>
                    <p className="text-[9px] text-white/60 font-black uppercase tracking-widest">{t.type}</p>
                  </div>
                ))}
             </div>
             <p className="text-[8px] text-white/40 text-center uppercase tracking-widest italic pt-2">These tasks will appear in your route at midnight.</p>
          </section>
        )}

        {canInteract && routeActive && (
          <button onClick={handleFinishDay} className="w-full bg-red-600 text-white font-black py-6 rounded-3xl uppercase tracking-[0.3em] text-xs shadow-2xl mt-8 active:scale-95 transition-all">FINISH THE DAY</button>
        )}
      </div>
    </div>
  );
};

export default DriverPortal;