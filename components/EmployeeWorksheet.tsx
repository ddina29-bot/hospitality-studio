
import React, { useState, useMemo } from 'react';
import { User, Shift, Property, TimeEntry } from '../types';
import { getCleanerRateForShift, calculateUserGrossForPeriod } from './PersonnelProfile';

interface EmployeeWorksheetProps {
  user: User;
  shifts: Shift[];
  properties: Property[];
  timeEntries?: TimeEntry[];
}

const EmployeeWorksheet: React.FC<EmployeeWorksheetProps> = ({ user, shifts, properties, timeEntries = [] }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
  });

  const months = useMemo(() => {
    const list = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const target = new Date(d.getFullYear(), d.getMonth() - i, 1);
      list.push(`${target.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${target.getFullYear()}`);
    }
    return list;
  }, []);

  const totalCalculatedGross = useMemo(() => {
    return calculateUserGrossForPeriod(user, shifts, timeEntries, properties, selectedMonth);
  }, [user, shifts, timeEntries, properties, selectedMonth]);

  const stats = useMemo(() => {
    const isLaundry = user.role === 'laundry';
    let totalHours = 0;

    if (isLaundry) {
      const periodEntries = timeEntries.filter(e => {
        const d = new Date(e.timestamp);
        const m = `${d.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
        return e.userId === user.id && m === selectedMonth;
      }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let clockedMinutes = 0;
      for (let i = 0; i < periodEntries.length; i++) {
        if (periodEntries[i].type === 'in' && periodEntries[i+1]?.type === 'out') {
            clockedMinutes += (new Date(periodEntries[i+1].timestamp).getTime() - new Date(periodEntries[i].timestamp).getTime()) / 60000;
            i++;
        }
      }
      totalHours = clockedMinutes / 60;
    } else {
      shifts.filter(s => {
        const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${new Date().getFullYear()}`);
        const m = `${d.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
        return s.userIds.includes(user.id) && s.status === 'completed' && m === selectedMonth;
      }).forEach(s => {
        totalHours += ((s.actualEndTime || 0) - (s.actualStartTime || 0)) / (1000 * 60 * 60);
      });
    }

    return { totalHours };
  }, [user, shifts, timeEntries, selectedMonth]);

  const shiftRows = useMemo(() => {
    if (user.role === 'laundry') return [];
    
    return shifts.filter(s => {
      const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${new Date().getFullYear()}`);
      const m = `${d.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
      return s.userIds.includes(user.id) && s.status === 'completed' && m === selectedMonth;
    }).map(s => {
        const hours = ((s.actualEndTime || 0) - (s.actualStartTime || 0)) / (1000 * 60 * 60);
        const hourlyRate = user.payRate || 5.0;
        const hourlyEarned = hours * hourlyRate;
        
        let pieceRate = 0;
        if (user.paymentType === 'Per Clean' && s.approvalStatus === 'approved') {
            const prop = properties.find(p => p.id === s.propertyId);
            const teamCount = s.userIds.length || 1;
            if (s.serviceType === 'TO FIX') pieceRate = s.fixWorkPayment || 0;
            else if (prop) pieceRate = getCleanerRateForShift(s.serviceType, prop) / teamCount;
        }

        return {
            id: s.id,
            date: s.date,
            name: s.propertyName,
            service: s.serviceType,
            hours: hours.toFixed(1),
            earned: Math.max(hourlyEarned, pieceRate).toFixed(2),
            method: pieceRate > hourlyEarned ? 'PIECE' : 'HOURLY'
        };
    });
  }, [shifts, user, selectedMonth, properties]);

  const laundryRows = useMemo(() => {
    if (user.role !== 'laundry') return [];
    
    const entries = timeEntries.filter(e => {
        const d = new Date(e.timestamp);
        const m = `${d.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
        return e.userId === user.id && m === selectedMonth;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const rows = [];
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'in' && entries[i+1]?.type === 'out') {
            const start = new Date(entries[i].timestamp);
            const end = new Date(entries[i+1].timestamp);
            const hrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            rows.push({
                id: entries[i].id,
                date: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
                time: `${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`,
                hours: hrs.toFixed(1),
                earned: (hrs * (user.payRate || 5.0)).toFixed(2)
            });
            i++;
        }
    }
    return rows;
  }, [timeEntries, user, selectedMonth]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1">
        <div className="space-y-1">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px]">Operations Ledger</p>
          <h2 className="text-2xl md:text-3xl font-brand font-bold text-slate-900 uppercase tracking-tighter">My Worksheet</h2>
        </div>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-teal-500 shadow-sm">
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-[#1E293B] p-8 rounded-[2.5rem] text-white shadow-xl flex justify-between items-center">
            <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Period Activity</p><p className="text-4xl font-bold font-brand tracking-tighter">{stats.totalHours.toFixed(1)} <span className="text-sm text-slate-500">HRS</span></p></div>
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">{user.role === 'laundry' ? '🧺' : '⏱️'}</div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-teal-100 shadow-xl flex justify-between items-center">
            <div className="space-y-1"><p className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Est. Gross Earnings</p><p className="text-4xl font-bold font-brand tracking-tighter text-[#0D9488]">€{totalCalculatedGross.toFixed(2)}</p></div>
            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center text-3xl">💶</div>
         </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.role === 'laundry' ? 'Work Session' : 'Apartment / Service'}</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Hours</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Earning (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {user.role === 'laundry' ? (
                laundryRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">No HQ Clock-ins found.</td></tr>
                ) : laundryRows.map(row => (
                  <tr key={row.id} className="hover:bg-teal-50/20 transition-colors">
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-900 uppercase leading-none">Laundry HQ Session</p>
                      <div className="flex items-center gap-2 mt-1.5"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{row.date}</span><span className="w-1 h-1 rounded-full bg-slate-200"></span><span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">{row.time}</span></div>
                    </td>
                    <td className="px-8 py-6 text-center text-xs font-bold text-slate-500">{row.hours}</td>
                    <td className="px-8 py-6 text-right font-black text-slate-900">€{row.earned}</td>
                  </tr>
                ))
              ) : (
                shiftRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">No completed sessions found.</td></tr>
                ) : shiftRows.map(row => (
                  <tr key={row.id} className="hover:bg-teal-50/20 transition-colors">
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-900 uppercase leading-none">{row.name}</p>
                      <div className="flex items-center gap-2 mt-1.5"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{row.date}</span><span className="w-1 h-1 rounded-full bg-slate-200"></span><span className="text-[8px] font-black text-teal-600 uppercase tracking-widest">{row.service}</span></div>
                    </td>
                    <td className="px-8 py-6 text-center text-xs font-bold text-slate-500">{row.hours}</td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex flex-col items-end">
                         <p className="text-sm font-black text-slate-900 tracking-tight">€{row.earned}</p>
                         <span className={`text-[6px] font-black uppercase px-1 rounded ${row.method === 'PIECE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                           {row.method} RATE
                         </span>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeWorksheet;
