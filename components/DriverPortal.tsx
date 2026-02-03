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
  user, supplyRequests = [], setSupplyRequests, manualTasks = [], setManualTasks, shifts = [], setShifts, properties = [], users = [], setActiveTab, timeEntries = [], setTimeEntries, initialOverrideId = null, onResetOverrideId
}) => {
  const getLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDate, setViewedDate] = useState(realTodayISO);
  const isViewingToday = viewedDate === realTodayISO;

  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDate]);

  const activeUserId = initialOverrideId || user.id;

  const todaysEntries = useMemo(() => {
    return (timeEntries || []).filter(e => e.userId === activeUserId && e.timestamp.startsWith(realTodayISO)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [timeEntries, activeUserId, realTodayISO]);

  const routeActive = !!todaysEntries.find(e => e.type === 'in') && !todaysEntries.slice().reverse().find(e => e.type === 'out');

  const logisticsTasks = useMemo(() => {
    return (shifts || []).filter(s => s.isPublished && !s.excludeLaundry && s.date === viewedDateStr)
      .map(s => ({ ...s, propDetails: properties.find(p => p.id === s.propertyId) }));
  }, [shifts, viewedDateStr, properties]);

  const handleStartDay = () => {
    if (!setTimeEntries || !isViewingToday) return;
    const newEntry: TimeEntry = { id: `time-${Date.now()}`, userId: activeUserId, type: 'in', timestamp: new Date().toISOString() };
    setTimeEntries(prev => [...prev, newEntry]);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-32 max-w-2xl mx-auto px-1">
      <header className="bg-slate-900 p-8 rounded-[40px] text-white space-y-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-bold uppercase tracking-tight">{isViewingToday ? 'Active Deployment' : 'Route Preview'}</h2>
          <p className="text-[10px] opacity-40 uppercase tracking-widest">{viewedDateStr} • {logisticsTasks.length} STOPS</p>
        </div>
        {isViewingToday && !routeActive && (
          <button onClick={handleStartDay} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">START ROUTE</button>
        )}
        {!isViewingToday && (
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
             <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 italic">Deployment locked for future dates. Preview only.</p>
          </div>
        )}
      </header>
      
      <div className="space-y-4">
        {logisticsTasks.map(task => (
           <div key={task.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                 <h4 className="text-base font-bold uppercase tracking-tight">{task.propertyName}</h4>
                 <span className="text-[9px] font-black uppercase text-indigo-600">{task.startTime}</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-medium">{task.propDetails?.address}</p>
           </div>
        ))}
      </div>
    </div>
  );
};

export default DriverPortal;