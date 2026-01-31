
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
  
  // Logic to derive current clock status from persistent history
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
  
  // ACTION PERMISSION: 
  // - Laundry Staff: Always Enabled
  // - Delegates: Always Enabled (if authorized)
  // - Admin: Only if Override is ON
  const canMarkItems = isActualLaundry || isAuthorizedDelegate || (isAdmin && adminOverride);
  
  const showDriverAlerts = isActualLaundry || isAdmin;

  // Check for critical damage (Simulated real-time check when viewing reports or mounting)
  useEffect(() => {
    const checkDamage = () => {
      try {
        const counts = JSON.parse(localStorage.getItem('studio_damage_counts') || '{}');
        const critical = Object.values(counts).some((val: any) => (Number(val) || 0) > 10);
        setHasCriticalDamage(critical);
      } catch(e) {}
    };
    checkDamage();
    // Poll for changes if needed, or just re-check when switching views
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
    const newEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      userId: user.id,
      type: newType,
      timestamp: new Date().toISOString()
    };

    setTimeEntries(prev => [...prev, newEntry]);
  };

  const handleResolveReport = (shiftId: string, reportId: string) => {
    setShifts?.(prev => prev.map(s => {
      if (s.id === shiftId && s.missingReports) {
        const updatedReports = s.missingReports.map(r => 
          r.id === reportId ? { ...r, status: 'resolved' as const } : r
        );
        return { ...s, missingReports: updatedReports };
      }
      return s;
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-32">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col space-y-0.5">
            <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">LINEN & FABRIC CENTER</p>
            <h1 className="text-2xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
              LAUNDRY <span className="text-[#C5A059] italic">HUB</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
             {isAdmin && (
                <button 
                  onClick={() => setAdminOverride(!adminOverride)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${adminOverride ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-black/40 border-gray-200'}`}
                >
                   <div className={`w-2 h-2 rounded-full ${adminOverride ? 'bg-white animate-pulse' : 'bg-black/20'}`}></div>
                   {adminOverride ? 'ADMIN OVERRIDE ACTIVE' : 'READ-ONLY MODE'}
                </button>
             )}

             <div className="p-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center shadow-inner">
               <button 
                 onClick={() => setActiveView('queue')}
                 className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                   activeView === 'queue' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/30 hover:text-black/60'
                 }`}
               >
                 Work Queue
               </button>
               <button 
                 onClick={() => setActiveView('reports')}
                 className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                   activeView === 'reports' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/30 hover:text-black/60'
                 }`}
               >
                 Inventory & Reports
               </button>
             </div>
          </div>

          {showClockUI && activeView === 'queue' && (
            <div className="flex items-center gap-6">
              {isClockedIn && (
                <div className="text-right">
                  <p className="text-[7px] font-black text-black/30 uppercase tracking-widest">START TIME</p>
                  <p className="text-sm font-serif-brand font-bold text-[#C5A059]">{startTimeDisplay}</p>
                </div>
              )}
              <button
                onClick={handleToggleClock}
                className={`${
                  isClockedIn ? 'bg-red-500/10 text-red-500' : 'bg-black text-[#C5A059]'
                } font-black px-6 py-3 rounded-2xl text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isClockedIn ? 'bg-red-500 animate-pulse' : 'bg-[#C5A059]'}`}></div>
                {isClockedIn ? 'STOP' : 'START CLOCK'}
              </button>
            </div>
          )}
        </div>
        
        <div className="h-px w-full bg-gray-100"></div>
      </div>

      {activeView === 'queue' ? (
        <div className="space-y-8">
          
          {/* CRITICAL STOCK ALERT BANNER */}
          {hasCriticalDamage && (
            <div className="bg-red-600 text-white p-5 rounded-[28px] flex items-center justify-between shadow-2xl animate-pulse cursor-pointer border-2 border-red-500" onClick={() => setActiveView('reports')}>
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-600 font-bold text-xl shadow-md">
                     !
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">STOCK LEVEL ALERT</p>
                    {/* FIXED: Escaped > symbol to &gt; */}
                    <p className="text-[9px] font-bold uppercase mt-0.5 opacity-90">Critical damage threshold exceeded (&gt;10 units). Restock required.</p>
                  </div>
               </div>
               <button className="bg-white text-red-600 px-6 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg hover:bg-red-50 transition-all">
                  VIEW REPORTS
               </button>
            </div>
          )}

          <section className="bg-white border border-gray-200 p-4 rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2 custom-scrollbar">
              {weekDays.map((wd) => (
                <button
                  key={wd.iso}
                  onClick={() => setViewedDate(wd.iso)}
                  className={`flex flex-col items-center min-w-[70px] py-4 rounded-2xl border transition-all ${
                    viewedDate === wd.iso 
                      ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-lg scale-105' 
                      : 'bg-white border-gray-200 text-gray-400 hover:border-[#C5A059]/40'
                  }`}
                >
                  <span className={`text-[8px] font-black uppercase mb-1 ${viewedDate === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                  <span className={`text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section className={`bg-white border border-gray-100 p-6 rounded-[40px] shadow-sm space-y-4 transition-all ${!adminOverride ? 'opacity-60 grayscale pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                 <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.4em]">DELEGATION CONTROL</p>
                 {!adminOverride && <span className="text-[8px] font-black text-black/20 uppercase tracking-widest">LOCKED (ENABLE OVERRIDE TO EDIT)</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {delegatePool.map(staff => (
                  <label key={staff.id} className="flex items-center gap-3 cursor-pointer bg-gray-50/50 p-3 rounded-xl border border-transparent hover:border-[#C5A059]/20 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-[#C5A059] rounded border-gray-300"
                      checked={(authorizedLaundryUserIds || []).includes(staff.id)}
                      onChange={() => onToggleAuthority?.(staff.id)}
                      disabled={!adminOverride}
                    />
                    <div className="text-left">
                      <p className="text-[9px] font-bold text-black uppercase truncate">{staff.name}</p>
                      <p className="text-[6px] text-[#C5A059] font-black uppercase tracking-widest">{staff.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {isAuthorizedToView && missingLaundryItems.length > 0 && (
            <section className="bg-red-50 border-2 border-red-500 p-6 rounded-[32px] shadow-xl space-y-4 mb-8">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white animate-pulse">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-red-700 uppercase tracking-widest">Missing Laundry Reports</h3>
                     <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide">Reported by Cleaning Staff</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {missingLaundryItems.map((item, idx) => (
                     <div key={`${item.shiftId}-${idx}`} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between h-full">
                        <div>
                            <p className="text-[10px] font-bold text-black uppercase">{item.propertyName}</p>
                            <p className="text-[9px] text-red-600 italic mt-1 font-medium">"{item.report.description}"</p>
                            <p className="text-[8px] text-black/30 font-black uppercase mt-2 text-right">{new Date(item.report.timestamp || 0).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-red-50">
                            <label className={`flex items-center gap-2 cursor-pointer group ${!canMarkItems ? 'pointer-events-none opacity-50' : ''}`}>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="peer sr-only"
                                        onChange={() => handleResolveReport(item.shiftId, item.report.id)}
                                        disabled={!canMarkItems}
                                    />
                                    <div className="w-4 h-4 border-2 border-red-300 rounded peer-checked:bg-green-50 peer-checked:border-green-50 transition-all"></div>
                                    <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <span className="text-[8px] font-black text-black/40 group-hover:text-black uppercase tracking-widest transition-colors">Mark Prepared</span>
                            </label>
                        </div>
                     </div>
                  ))}
               </div>
            </section>
          )}

          {isAuthorizedToView && showDriverAlerts && collectionAlerts.length > 0 && (
            <section className="bg-orange-50 border border-orange-200 p-6 rounded-[32px] shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                <h3 className="text-[10px] font-black text-orange-700 uppercase tracking-[0.4em]">Driver Collection Alerts (Today)</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {collectionAlerts.slice(0, 6).map(alert => (
                  <div key={alert.id} className="bg-white/80 p-3 rounded-xl flex justify-between items-center border border-orange-100">
                    <p className="text-[9px] font-bold text-black uppercase truncate pr-4">{alert.propertyName}</p>
                    <span className="text-[7px] font-black text-orange-600 uppercase tracking-widest whitespace-nowrap">Awaiting Drop-off</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isAuthorizedToView ? (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-serif-brand text-black uppercase font-bold tracking-widest">
                  Linen Preparation: <span className="text-[#C5A059]">{viewedDateStrShort}</span>
                </h3>
                <p className="text-[9px] font-black text-black/30 uppercase tracking-widest">{preparationQueue.length} UNITS</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {preparationQueue.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-[48px]">
                    <p className="opacity-10 italic text-[10px] uppercase font-black tracking-[0.5em]">No linens scheduled</p>
                  </div>
                ) : (
                  preparationQueue.map(shift => {
                    const dCount = shift.propertyDetails?.doubleBeds || 0;
                    const sCount = shift.propertyDetails?.singleBeds || 0;
                    const pCount = shift.propertyDetails?.pillows || 0;
                    const bathCount = shift.propertyDetails?.bathrooms || 0;
                    const isDone = shift.isLaundryPrepared;
                    return (
                      <div key={shift.id} className={`p-8 bg-[#FDF8EE] border rounded-[40px] shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between h-full ${isDone ? 'opacity-80 border-green-500/20' : 'border-[#D4B476]/30'}`}>
                        <div className="space-y-6">
                          <div className="flex justify-between items-start">
                            <h4 className={`text-sm font-serif-brand font-bold uppercase tracking-widest leading-tight ${isDone ? 'text-black/40' : 'text-black'}`}>{shift.propertyName}</h4>
                            {isDone && <span className="text-[7px] font-black bg-green-500 text-white px-2 py-1 rounded uppercase shadow-sm">Prepared</span>}
                          </div>
                          <div className="space-y-4">
                            <div className={`p-4 rounded-2xl border ${isDone ? 'bg-gray-50 border-gray-200' : 'bg-white/60 border-[#D4B476]/10'}`}>
                              <p className={`text-[7px] font-black uppercase tracking-widest mb-1.5 ${isDone ? 'text-black/20' : 'text-[#8B6B2E]'}`}>Beds & Pillows Required</p>
                              <p className={`text-[10px] font-bold uppercase ${isDone ? 'text-black/30' : 'text-black'}`}>{dCount} Double • {sCount} Single • {pCount} Pillows</p>
                            </div>
                            
                            <div className={`p-4 rounded-2xl border ${isDone ? 'bg-gray-50 border-gray-200' : 'bg-white/60 border-[#D4B476]/10'}`}>
                              <p className={`text-[7px] font-black uppercase tracking-widest mb-1.5 ${isDone ? 'text-black/20' : 'text-[#8B6B2E]'}`}>Bathrooms / Towel Packs</p>
                              <p className={`text-[10px] font-bold uppercase ${isDone ? 'text-black/30' : 'text-black'}`}>{bathCount} Full Bathroom{bathCount !== 1 ? 's' : ''}</p>
                            </div>

                            {shift.notes && (
                              <div className={`p-4 rounded-2xl border border-dashed ${isDone ? 'bg-gray-50/30 border-gray-200' : 'bg-white/40 border-[#D4B476]/30'}`}>
                                <p className={`text-[7px] font-black uppercase tracking-widest mb-1.5 ${isDone ? 'text-black/10' : 'text-[#8B6B2E]'}`}>Notes</p>
                                <p className={`text-[10px] italic leading-relaxed ${isDone ? 'text-black/20' : 'text-black/70'}`}>"{shift.notes}"</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pt-8">
                           <button 
                             onClick={() => !isDone && onTogglePrepared(shift.id)}
                             disabled={!canMarkItems || isDone}
                             className={`w-full py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                               isDone ? 'bg-green-600 text-white' : canMarkItems ? 'bg-[#C5A059] text-black hover:bg-[#D4B476]' : 'bg-gray-100 text-black/20 cursor-not-allowed'
                             }`}
                           >
                             {isDone ? '✓ PREPARED' : canMarkItems ? 'MARK AS PREPARED' : 'LOCKED (READ-ONLY)'}
                           </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : (
            <div className="py-40 text-center space-y-4">
               <h3 className="text-xl font-serif-brand font-bold uppercase text-black">Authorization Required</h3>
               <p className="text-[10px] text-black/40 font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Please request official Laundry Authority or Admin Clearance.</p>
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
