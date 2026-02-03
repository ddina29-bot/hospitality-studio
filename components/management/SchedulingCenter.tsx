
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Shift, Property, User, TabType } from '../../types';
import { SERVICE_TYPES } from '../../constants';

// --- HELPER FUNCTIONS ---

const convertTo12h = (time24h: string) => {
  if (!time24h) return "10:00 AM";
  try {
    let [hours, minutes] = time24h.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  } catch { return "10:00 AM"; }
};

const toLocalDateString = (date: Date) => {
  if (!date) return new Date().toISOString().split('T')[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseShiftDate = (dateStr: string) => {
  if (!dateStr) return toLocalDateString(new Date());
  if (dateStr.includes('-')) return dateStr; 
  const currentYear = new Date().getFullYear();
  try {
    const date = new Date(`${dateStr} ${currentYear}`);
    if (isNaN(date.getTime())) return toLocalDateString(new Date());
    return toLocalDateString(date);
  } catch { return toLocalDateString(new Date()); }
};

interface SchedulingCenterProps {
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties: Property[];
  users: User[];
  setActiveTab?: (tab: TabType) => void;
}

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ 
  shifts = [], 
  setShifts, 
  properties = [], 
  users = []
}) => {
  const [search, setSearch] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentWeekStart]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + (direction * 7));
      return d;
    });
  };

  const getShiftsForUserAndDay = (userId: string, dayDate: Date) => {
    const isoStr = toLocalDateString(dayDate);
    const shortStr = dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    return (shifts ?? []).filter(s => s?.userIds?.includes(userId) && (s?.date === shortStr || s?.date === isoStr));
  };

  const filteredPersonnel = useMemo(() => {
    const query = search.toLowerCase();
    return (users ?? []).filter(u => 
      ['cleaner', 'supervisor'].includes(u?.role) && 
      u?.status === 'active' && 
      (!query || u?.name?.toLowerCase().includes(query))
    );
  }, [users, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left pb-24 bg-white min-h-screen">
      <header className="space-y-4 px-1">
        <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">SCHEDULE</h2>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
           <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm h-10 w-fit">
              <button onClick={() => navigateWeek(-1)} className="px-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors">◀</button>
              <button onClick={() => setCurrentWeekStart(new Date())} className="px-6 flex items-center text-[9px] font-black text-black uppercase tracking-widest border-x border-slate-200">TODAY</button>
              <button onClick={() => navigateWeek(1)} className="px-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors">▶</button>
           </div>
           <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-inner">
                <p className="text-[10px] font-black text-black uppercase tracking-[0.15em]">
                  {weekDates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} — {weekDates[6].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                </p>
           </div>
        </div>
        <div className="relative w-full">
            <input type="text" placeholder="SEARCH STAFF..." className="w-full bg-white border border-slate-200 rounded-xl px-10 py-3 text-[10px] text-[#1A1A1A] outline-none focus:border-[#0D9488] uppercase tracking-widest font-black h-11" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="absolute left-4 top-3.5 opacity-30">🔍</div>
        </div>
      </header>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl mt-2">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse table-fixed min-w-[1200px]">
            <thead>
              <tr className="bg-white border-b border-slate-200">
                <th className="p-4 text-left w-48 border-r border-slate-300 bg-teal-600 text-white sticky left-0 z-20">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Personnel</span>
                </th>
                {weekDates.map((date, idx) => (
                  <th key={idx} className="p-3 text-center border-r border-slate-200 min-w-[160px] bg-white">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{date.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                    <p className="text-sm font-serif-brand font-bold text-[#1A1A1A] uppercase tracking-tight">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center opacity-20 uppercase font-black italic">No personnel matching search</td>
                </tr>
              ) : filteredPersonnel.map(cleaner => (
                <tr key={cleaner.id} className="group hover:bg-teal-50/10">
                  <td className="p-4 border-r border-slate-300 bg-white sticky left-0 z-10 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center font-serif-brand text-xs font-bold text-teal-700">
                          {cleaner.name?.charAt(0) ?? '?'}
                      </div>
                      <p className="text-[10px] font-bold uppercase truncate text-teal-700">{cleaner.name ?? 'Unknown'}</p>
                    </div>
                  </td>
                  {weekDates.map((date, idx) => {
                    const dayShifts = getShiftsForUserAndDay(cleaner.id, date);
                    return (
                      <td key={idx} className="p-2 border-r border-slate-200 align-top group-hover:bg-teal-50/20 transition-colors">
                        <div className="space-y-2 min-h-[50px]">
                          {dayShifts.map(s => (
                            <div key={s.id} className="border border-teal-200 bg-teal-50 rounded-xl p-2 shadow-sm">
                              <p className="text-[9px] font-black uppercase truncate">{s.propertyName ?? 'Unit'}</p>
                              <p className="text-[7px] font-bold uppercase mt-1 opacity-70">{s.startTime ?? '---'} — {s.endTime ?? '---'}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchedulingCenter;
