
import React, { useState, useMemo } from 'react';
import { User, Shift, Property } from '../types';
import { getCleanerRateForShift } from './PersonnelProfile';

interface EmployeeWorksheetProps {
  user: User;
  shifts: Shift[];
  properties: Property[];
}

const EmployeeWorksheet: React.FC<EmployeeWorksheetProps> = ({ user, shifts, properties }) => {
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

  const worksheetData = useMemo(() => {
    const filtered = shifts.filter(s => {
      const isMine = s.userIds.includes(user.id);
      const isDone = s.status === 'completed';
      const shiftDate = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${new Date().getFullYear()}`);
      const monthLabel = `${shiftDate.toLocaleString('en-GB', { month: 'short' }).toUpperCase()} ${shiftDate.getFullYear()}`;
      return isMine && isDone && monthLabel === selectedMonth;
    }).sort((a, b) => {
        const dateA = a.date.includes('-') ? new Date(a.date).getTime() : new Date(`${a.date} ${new Date().getFullYear()}`).getTime();
        const dateB = b.date.includes('-') ? new Date(b.date).getTime() : new Date(`${b.date} ${new Date().getFullYear()}`).getTime();
        return dateB - dateA;
    });

    let totalHours = 0;
    let totalEarnings = 0;

    const rows = filtered.map(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = Math.max(0, durationMs / (1000 * 60 * 60));
      totalHours += hours;

      let payout = 0;
      const hourlyRate = user.payRate || 5.00;
      const basePayForHoursSpent = hours * hourlyRate;

      if (s.approvalStatus === 'approved') {
          const teamCount = s.userIds?.length || 1;
          
          let flatRate = 0;
          if (s.serviceType === 'TO FIX') {
              flatRate = s.fixWorkPayment || 0;
          } else if (prop) {
              flatRate = getCleanerRateForShift(s.serviceType, prop) / teamCount;
          }

          if (user.paymentType === 'Per Clean' || user.paymentType === 'Fixed Wage') {
              // For Fixed Wage users, piece rate is a pure bonus.
              // For Per Clean users, it's the target pay.
              payout = Math.max(flatRate, user.paymentType === 'Fixed Wage' ? 0 : basePayForHoursSpent);
          } else {
              payout = basePayForHoursSpent;
          }
      } else {
          payout = s.approvalStatus === 'rejected' ? basePayForHoursSpent : 0;
      }

      totalEarnings += payout;

      return {
        id: s.id,
        date: s.date,
        propertyName: s.propertyName,
        service: s.serviceType,
        time: `${new Date(s.actualStartTime || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.actualEndTime || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        hours: hours.toFixed(1),
        status: s.approvalStatus,
        payout: payout.toFixed(2)
      };
    });

    return { rows, totalHours: totalHours.toFixed(1), totalEarnings: totalEarnings.toFixed(2) };
  }, [shifts, properties, user, selectedMonth]);

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
         <div className="bg-[#1E293B] p-8 rounded-[2.5rem] text-white shadow-xl flex justify-between items-center relative overflow-hidden group">
            <div className="space-y-1 relative z-10"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Period Activity</p><p className="text-4xl font-bold font-brand tracking-tighter">{worksheetData.totalHours} <span className="text-sm text-slate-500">HRS</span></p></div>
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform relative z-10">⏱️</div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-teal-100 shadow-xl flex justify-between items-center relative overflow-hidden group">
            <div className="space-y-1 relative z-10"><p className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Est. Additional Earnings</p><p className="text-4xl font-bold font-brand tracking-tighter text-[#0D9488]">€{worksheetData.totalEarnings}</p></div>
            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform relative z-10">💶</div>
         </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date / Apartment</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Earning (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {worksheetData.rows.length === 0 ? (
                <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">No completed sessions found for this period.</td></tr>
              ) : worksheetData.rows.map(row => (
                <tr key={row.id} className="hover:bg-teal-50/20 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-900 uppercase leading-none">{row.propertyName}</p>
                    <div className="flex items-center gap-2 mt-1.5"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{row.date}</span><span className="w-1 h-1 rounded-full bg-slate-200"></span><span className="text-[8px] font-black text-teal-600 uppercase tracking-widest">{row.service}</span></div>
                  </td>
                  <td className="px-8 py-6 text-center"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${row.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : row.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{row.status}</span></td>
                  <td className="px-8 py-6 text-right"><p className="text-sm font-black text-slate-900 tracking-tight">€{row.payout}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeWorksheet;
