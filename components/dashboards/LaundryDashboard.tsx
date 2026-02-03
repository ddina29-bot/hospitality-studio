import React, { useState, useMemo, useEffect } from 'react';
import { TabType, User, Shift, Property, SpecialReport, TimeEntry } from '../../types';
import LaundryReports from './LaundryReports';

interface LaundryDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  users?: User[];
  properties?: Property[];
  onTogglePrepared: (shiftId: string) => void;
  authorizedLaundryUserIds?: string[];
  onToggleAuthority?: (userId: string) => void;
  timeEntries?: TimeEntry[];
  setTimeEntries?: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
}

const LaundryDashboard: React.FC<LaundryDashboardProps> = ({ 
  user, setActiveTab, onLogout, shifts = [], setShifts, users = [], properties = [], onTogglePrepared, authorizedLaundryUserIds = [], onToggleAuthority, timeEntries = [], setTimeEntries
}) => {
  const [activeView, setActiveView] = useState<'queue' | 'reports'>('queue');
  const [adminOverride, setAdminOverride] = useState(false);
  const [hasCriticalDamage, setHasCriticalDamage] = useState(false);
  
  const myLastEntry = useMemo(() => {
    return timeEntries
      .filter(e => e.userId === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [timeEntries, user.id]);

  const isClockedIn = myLastEntry?.type === 'in';
  
  const startTimeDisplay = useMemo(() => {
    if (isClockedIn && myLastEntry) {
      return new Date(myLastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  }, [isClockedIn, myLastEntry]);

  const isAdmin = user.role === 'admin';
  const isActualLaundry = user.role === 'laundry';
  const isAuthorizedDelegate = (authorizedLaundryUserIds || []).includes(user.id);
  
  const showClockUI = !['admin', 'supervisor', 'driver', 'housekeeping'].includes(user.role);
  const isAuthorizedToView = isAdmin || isActualLaundry || isAuthorizedDelegate;
  
  const canMarkItems = isActualLaundry || isAuthorizedDelegate || (isAdmin && adminOverride);
  
  const showDriverAlerts = isActualLaundry || isAdmin;

  useEffect(() => {
    const checkDamage = () => {
      try {
        const counts = JSON.parse(localStorage.getItem('studio_damage_counts') || '{}');
        const critical = Object.values(counts).some((val: any) => (Number(val) || 0) > 10);
        setHasCriticalDamage(critical);
      } catch(e) {}
    };
    checkDamage();
    const interval = setInterval(checkDamage, 5000);
    return () => clearInterval(interval);
  }, []);

  const getLocalISO = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDate, setViewedDate] = useState(realTodayISO);

  const viewedDateStrShort = useMemo(() => {
    const [y, m, d] = viewedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDate]);
  
  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - 3); 
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = getLocalISO(d);
      days.push({
        iso,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateNum: d.getDate(),
        isToday: iso === realTodayISO,
        displayStr: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
      });
    }
    return days;
  }, [realTodayISO]);

  const collectionAlerts = useMemo(() => {
    return shifts.filter(s => s.date === viewedDateStrShort && !s.isCollected && !s.excludeLaundry);
  }, [shifts, viewedDateStrShort]);

  const missingLaundryItems = useMemo(() => {
    const list: { shiftId: string, propertyName: string, report: SpecialReport }[] = [];
    shifts.forEach(s => {
      s.missingReports?.forEach(r => {
        if (r.status !== 'resolved' && (r.category === 'laundry' || r.description.includes('[FOR LAUNDRY]'))) {
          list.push({ shiftId: s.id, propertyName: s.propertyName || '', report: r });
        }
      });
    });
    return list;
  }, [shifts]);

  const preparationQueue = useMemo(() => {
    return shifts
      .filter(s => s.date === viewedDateStrShort && !s.excludeLaundry)
      .map(s => {
        const prop = properties?.find(p => p.id === s.propertyId);
        return { ...s, propertyDetails: prop };
      })
      .sort((a, b) => {
        if (a.isLaundryPrepared && !b.isLaundryPrepared) return 1;
        if (!a.isLaundryPrepared && b.isLaundryPrepared) return -1;
        return 0;
      });
  }, [shifts, properties, viewedDateStrShort]);

  const delegatePool = useMemo(() => {
    return users.filter(u => ['supervisor', 'admin', 'driver'].includes(u.role));
  }, [users]);

  const handleToggleClock = () => {
    if (!setTimeEntries) return;
    const newType = isClockedIn ? 'out' : 'in';
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: user.id, type: newType, timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
  };

  const handleResolveReport = (shiftId: string, reportId: string) => {
    setShifts?.(prev => prev.map(s => {
      if (s.id === shiftId && s.missingReports) {
        const updatedReports = s.missingReports.map(r => r.id === reportId ? { ...r, status: 'resolved' as const } : r);
        return { ...s, missingReports: updatedReports };
      }
      return s;
    }));
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 text-left pb-24">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col space-y-1">
            <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[7px] md:text-[8px]">LINEN CENTER</p>
            <h1 className="text-2xl md:text-3xl font-serif-brand text-slate-900 tracking-tight uppercase leading-none font-bold">
              LAUNDRY <span className="text-indigo-600 italic">HUB</span>
            </h1>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
             {isAdmin && (
                <button 
                  onClick={() => setAdminOverride(!adminOverride)}
                  className={`flex items-center justify-center md:justify-start gap-2 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${adminOverride ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-black/40 border-gray-200'}`}
                >
                   <div className={`w-1.5 h-1.5 rounded-full ${adminOverride ? 'bg-white animate-pulse' : 'bg-black/20'}`}></div>
                   {adminOverride ? 'OVERRIDE ON' : 'READ-ONLY'}
                </button>
             )}

             <div className="p-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center shadow-inner">
               <button 
                 onClick={() => setActiveView('queue')}
                 className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${
                   activeView === 'queue' ? 'bg-indigo-600 text-white shadow-lg' : 'text-black/30 hover:text-black/60'
                 }`}
               >
                 Queue
               </button>
               <button 
                 onClick={() => setActiveView('reports')}
                 className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${
                   activeView === 'reports' ? 'bg-indigo-600 text-white shadow-lg' : 'text-black/30 hover:text-black/60'
                 }`}
               >
                 Reports
               </button>
             </div>
          </div>

          {showClockUI && activeView === 'queue' && (
            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
              {isClockedIn && (
                <div className="text-left md:text-right flex-1">
                  <p className="text-[6px] md:text-[7px] font-black text-black/30 uppercase tracking-widest leading-none">START</p>
                  <p className="text-sm font-serif-brand font-bold text-indigo-600 leading-none mt-1">{startTimeDisplay}</p>
                </div>
              )}
              <button
                onClick={handleToggleClock}
                className={`${
                  isClockedIn ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'
                } font-black px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-3 shadow-lg flex-1 md:flex-none`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isClockedIn ? 'bg-rose-500 animate-pulse' : 'bg-white'}`}></div>
                {isClockedIn ? 'STOP' : 'START CLOCK'}
              </button>
            </div>
          )}
        </div>
        
        <div className="h-px w-full bg-gray-100/50"></div>
      </div>

      {activeView === 'queue' ? (
        <div className="space-y-6 md:space-y-8">
          {hasCriticalDamage && (
            <div className="bg-red-600 text-white p-4 md:p-5 rounded-2xl md:rounded-[28px] flex flex-col sm:flex-row items-center justify-between shadow-2xl animate-pulse cursor-pointer border-2 border-red-500 gap-4" onClick={() => setActiveView('reports')}>
               <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center text-red-600 font-bold text-lg shadow-md shrink-0">!</div>
                  <div className="min-w-0">
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.3em]">STOCK ALERT</p>
                    <p className="text-[8px] md:text-[9px] font-bold uppercase mt-0.5 opacity-90 truncate">Damages exceed limit (&gt;10). Restock.</p>
                  </div>
               </div>
               <button className="w-full sm:w-auto bg-white text-red-600 px-6 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg">VIEW</button>
            </div>
          )}

          <section className="bg-white border border-gray-200 p-3 md:p-4 rounded-2xl md:rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-1 custom-scrollbar">
              {weekDays.map((wd) => (
                <button
                  key={wd.iso}
                  onClick={() => setViewedDate(wd.iso)}
                  className={`flex flex-col items-center min-w-[55px] md:min-w-[70px] py-3 md:py-4 rounded-xl md:rounded-2xl border transition-all ${
                    viewedDate === wd.iso 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' 
                      : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-600/40 shadow-sm'
                  }`}
                >
                  <span className={`text-[7px] md:text-[8px] font-black uppercase mb-0.5 md:mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                  <span className={`text-xs md:text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-slate-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section className={`bg-white border border-gray-100 p-4 md:p-6 rounded-2xl md:rounded-[40px] shadow-sm space-y-3 md:space-y-4 transition-all ${!adminOverride ? 'opacity-60 grayscale pointer-events-none' : ''}`}>
              <p className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest md:tracking-[0.4em]">DELEGATION CONTROL</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                {delegatePool.map(staff => (
                  <label key={staff.id} className="flex items-center gap-2 md:gap-3 cursor-pointer bg-gray-50/50 p-2.5 md:p-3 rounded-xl border border-transparent hover:border-indigo-600/20 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 md:w-4 md:h-4 accent-indigo-600 rounded"
                      checked={(authorizedLaundryUserIds || []).includes(staff.id)}
                      onChange={() => onToggleAuthority?.(staff.id)}
                      disabled={!adminOverride}
                    />
                    <div className="text-left min-w-0">
                      <p className="text-[9px] font-bold text-slate-900 uppercase truncate">{staff.name}</p>
                      <p className="text-[6px] text-indigo-600 font-black uppercase tracking-widest">{staff.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {isAuthorizedToView && missingLaundryItems.length > 0 && (
            <section className="bg-red-50 border-2 border-red-500 p-5 md:p-6 rounded-3xl md:rounded-[32px] shadow-xl space-y-4">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-600 flex items-center justify-center text-white animate-pulse shrink-0 shadow-md">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div className="min-w-0">
                     <h3 className="text-xs md:text-sm font-black text-red-700 uppercase tracking-widest leading-none">Missing Reports</h3>
                     <p className="text-[8px] md:text-[10px] text-red-600 font-bold uppercase tracking-wide mt-1 leading-none">Field Staff Updates</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {missingLaundryItems.map((item, idx) => (
                     <div key={`${item.shiftId}-${idx}`} className="bg-white p-3.5 md:p-4 rounded-xl md:rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between h-full">
                        <div className="min-w-0">
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-900 uppercase truncate">{item.propertyName}</p>
                            <p className="text-[8px] md:text-[9px] text-red-600 italic mt-1 font-medium leading-tight line-clamp-2">"{item.report.description}"</p>
                            <p className="text-[7px] text-black/30 font-black uppercase mt-2 text-right">{new Date(item.report.timestamp || 0).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-2.5 md:mt-3 pt-2.5 md:pt-3 border-t border-red-50">
                            <label className={`flex items-center gap-2 cursor-pointer group ${!canMarkItems ? 'pointer-events-none opacity-50' : ''}`}>
                                <div className="relative">
                                    <input type="checkbox" className="peer sr-only" onChange={() => handleResolveReport(item.shiftId, item.report.id)} disabled={!canMarkItems} />
                                    <div className="w-4 h-4 border-2 border-red-300 rounded peer-checked:bg-green-50 peer-checked:border-green-50 transition-all"></div>
                                    <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <span className="text-[8px] font-black text-slate-400 group-hover:text-slate-900 uppercase tracking-widest transition-colors">Mark Done</span>
                            </label>
                        </div>
                     </div>
                  ))}
               </div>
            </section>
          )}

          {isAuthorizedToView && showDriverAlerts && collectionAlerts.length > 0 && (
            <section className="bg-orange-50 border border-orange-200 p-4 md:p-6 rounded-[1.5rem] md:rounded-[32px] shadow-sm space-y-3 md:space-y-4">
              <h3 className="text-[9px] md:text-[10px] font-black text-orange-700 uppercase tracking-[0.3em]">Driver Alerts (Today)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {collectionAlerts.slice(0, 6).map(alert => (
                  <div key={alert.id} className="bg-white/80 p-2.5 md:p-3 rounded-xl flex justify-between items-center border border-orange-100 shadow-sm">
                    <p className="text-[9px] font-bold text-slate-900 uppercase truncate pr-3">{alert.propertyName}</p>
                    <span className="text-[6px] md:text-[7px] font-black text-orange-600 uppercase tracking-widest whitespace-nowrap bg-orange-100/50 px-2 py-0.5 rounded-full">Drop-off</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isAuthorizedToView ? (
            <section className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs md:text-sm font-serif-brand text-slate-900 uppercase font-bold tracking-widest">
                  Linen: <span className="text-indigo-600">{viewedDateStrShort}</span>
                </h3>
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{preparationQueue.length} UNITS</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {preparationQueue.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-[2rem] md:rounded-[48px] opacity-30">
                    <p className="text-[9px] md:text-[10px] uppercase font-black tracking-widest">No linens scheduled</p>
                  </div>
                ) : (
                  preparationQueue.map(shift => {
                    const dCount = shift.propertyDetails?.doubleBeds || 0;
                    const sCount = shift.propertyDetails?.singleBeds || 0;
                    const pCount = shift.propertyDetails?.pillows || 0;
                    const bathCount = shift.propertyDetails?.bathrooms || 0;
                    const isDone = shift.isLaundryPrepared;
                    return (
                      <div key={shift.id} className={`p-6 md:p-8 bg-white border rounded-[2rem] md:rounded-[40px] shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between h-full ${isDone ? 'opacity-80 border-green-500/20' : 'border-slate-100'}`}>
                        <div className="space-y-5 md:space-y-6">
                          <div className="flex justify-between items-start gap-3">
                            <h4 className={`text-xs md:text-sm font-serif-brand font-bold uppercase tracking-widest leading-tight min-w-0 truncate ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{shift.propertyName}</h4>
                            {isDone && <span className="text-[6px] md:text-[7px] font-black bg-green-500 text-white px-2 py-0.5 rounded uppercase shadow-sm shrink-0">Ready</span>}
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border ${isDone ? 'bg-gray-50 border-gray-100' : 'bg-slate-50 border-slate-100'}`}>
                              <p className={`text-[6px] md:text-[7px] font-black uppercase tracking-widest mb-1 ${isDone ? 'text-slate-400' : 'text-indigo-600'}`}>Beds & Pillows</p>
                              <p className={`text-[9px] md:text-[10px] font-bold uppercase leading-none ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{dCount}D • {sCount}S • {pCount}P</p>
                            </div>
                            
                            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border ${isDone ? 'bg-gray-50 border-gray-100' : 'bg-slate-50 border-slate-100'}`}>
                              <p className={`text-[6px] md:text-[7px] font-black uppercase tracking-widest mb-1 ${isDone ? 'text-slate-400' : 'text-indigo-600'}`}>Bathrooms / Packs</p>
                              <p className={`text-[9px] md:text-[10px] font-bold uppercase leading-none ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{bathCount} Full Unit{bathCount !== 1 ? 's' : ''}</p>
                            </div>

                            {shift.notes && (
                              <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border border-dashed ${isDone ? 'bg-gray-50/30 border-gray-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                <p className={`text-[6px] md:text-[7px] font-black uppercase tracking-widest mb-1 ${isDone ? 'text-slate-400' : 'text-indigo-400'}`}>Notes</p>
                                <p className={`text-[8px] md:text-[9px] italic leading-tight ${isDone ? 'text-slate-400' : 'text-slate-600'}`}>"{shift.notes}"</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pt-6 md:pt-8">
                           <button 
                             onClick={() => !isDone && onTogglePrepared(shift.id)}
                             disabled={!canMarkItems || isDone}
                             className={`w-full py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                               isDone ? 'bg-green-600 text-white' : canMarkItems ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-slate-400 cursor-not-allowed shadow-none'
                             }`}
                           >
                             {isDone ? '✓ PREPARED' : canMarkItems ? 'MARK AS PREPARED' : 'LOCKED'}
                           </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : (
            <div className="py-32 text-center space-y-3 px-6">
               <h3 className="text-lg font-serif-brand font-bold uppercase text-slate-900">Authorization Required</h3>
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Request official Laundry Authority or Admin Clearance to view.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <LaundryReports shifts={shifts} properties={properties || []} userRole={user.role} />
        </div>
      )}
    </div>
  );
};

export default LaundryDashboard;