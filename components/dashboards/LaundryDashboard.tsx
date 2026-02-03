import React, { useState, useMemo } from 'react';
import { TabType, User, Shift, Property, TimeEntry } from '../../types';
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
  
  const getLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDate, setViewedDate] = useState(realTodayISO);

  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDate]);

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

  const linenQueue = useMemo(() => {
    return shifts.filter(s => s.isPublished && !s.excludeLaundry && s.date === viewedDateStr)
      .map(s => ({ ...s, propDetails: properties?.find(p => p.id === s.propertyId) }));
  }, [shifts, viewedDateStr, properties]);

  const myLastEntry = useMemo(() => {
    return (timeEntries || []).filter(e => e.userId === user.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [timeEntries, user.id]);

  const isClockedIn = myLastEntry?.type === 'in';
  const isAdmin = user.role === 'admin';
  const isActualLaundry = user.role === 'laundry';
  const isAuthorizedDelegate = (authorizedLaundryUserIds || []).includes(user.id);
  const isAuthorizedToView = isAdmin || isActualLaundry || isAuthorizedDelegate;
  const canMarkItems = isActualLaundry || isAuthorizedDelegate || (isAdmin && adminOverride);

  const handleToggleClock = () => {
    if (!setTimeEntries) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: user.id, type: isClockedIn ? 'out' : 'in', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
        <div className="flex flex-col space-y-1">
          <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[7px] md:text-[8px]">LINEN CENTER</p>
          <h1 className="text-2xl md:text-3xl font-serif-brand text-slate-900 tracking-tight uppercase leading-none font-bold">LAUNDRY <span className="text-indigo-600 italic">HUB</span></h1>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
           <button onClick={() => setActiveView('queue')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'queue' ? 'bg-white text-indigo-600 shadow' : 'text-slate-400'}`}>Queue</button>
           <button onClick={() => setActiveView('reports')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'reports' ? 'bg-white text-indigo-600 shadow' : 'text-slate-400'}`}>Reports</button>
        </div>
      </header>

      {activeView === 'queue' ? (
        <>
          <section className="bg-white border border-gray-200 p-2.5 md:p-4 rounded-3xl md:rounded-[32px] shadow-sm">
            <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {weekDays.map((wd) => (
                <button key={wd.iso} onClick={() => setViewedDate(wd.iso)} className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${viewedDate === wd.iso ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-slate-400 shadow-sm'}`}>
                  <span className={`text-[7px] md:text-[8px] font-black uppercase mb-0.5 ${viewedDate === wd.iso ? 'text-white/80' : 'text-slate-400'}`}>{wd.dayName}</span>
                  <span className={`text-sm font-bold ${viewedDate === wd.iso ? 'text-white' : 'text-slate-600'}`}>{wd.dateNum}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {linenQueue.length === 0 ? (
               <div className="col-span-full py-20 text-center opacity-20 font-black uppercase tracking-widest text-[10px]">No laundry deployments on this date.</div>
            ) : linenQueue.map(item => (
              <div key={item.id} className={`bg-white p-6 rounded-3xl border transition-all ${item.isLaundryPrepared ? 'border-emerald-100 bg-emerald-50/20' : 'border-gray-200 shadow-sm'}`}>
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-start">
                     <h4 className="text-sm font-bold text-slate-900 uppercase truncate">{item.propertyName}</h4>
                     {item.isLaundryPrepared && <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest">Prepared</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-white/60 p-3 rounded-xl border border-slate-100">
                     <div className="text-center border-r border-slate-100">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Double Beds</p>
                        <p className="text-base font-bold text-indigo-600">{item.propDetails?.doubleBeds || 0}</p>
                     </div>
                     <div className="text-center">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Single Beds</p>
                        <p className="text-base font-bold text-indigo-600">{item.propDetails?.singleBeds || 0}</p>
                     </div>
                  </div>
                  {canMarkItems && (
                    <button 
                      onClick={() => onTogglePrepared(item.id)} 
                      className={`w-full py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${item.isLaundryPrepared ? 'bg-white border border-emerald-500 text-emerald-600' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95'}`}
                    >
                      {item.isLaundryPrepared ? 'Unmark Prepared' : 'Mark as Prepared'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isAdmin && (
             <button onClick={handleToggleClock} className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-2xl transition-all ${isClockedIn ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white shadow-indigo-900/20'}`}>
                {isClockedIn ? 'Finish Shift (Clock-Out)' : 'Start Laundry Shift (Clock-In)'}
             </button>
          )}
        </>
      ) : (
        <LaundryReports shifts={shifts} properties={properties || []} userRole={user.role} />
      )}
    </div>
  );
};

export default LaundryDashboard;