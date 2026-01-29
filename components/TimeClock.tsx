
import React, { useState, useEffect } from 'react';
import { TimeEntry } from '../types';
import { Icons } from '../constants';

const TimeClock: React.FC = () => {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Load state from local storage on mount
  useEffect(() => {
    const savedStatus = localStorage.getItem('studio_clock_status');
    const savedEntries = localStorage.getItem('studio_clock_entries');
    const savedStartTime = localStorage.getItem('studio_clock_start');

    if (savedStatus === 'true') setIsClockedIn(true);
    if (savedEntries) {
      // Rehydrate dates from strings
      const parsed = JSON.parse(savedEntries).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
      setEntries(parsed);
    }
    if (savedStartTime) setStartTime(parseInt(savedStartTime, 10));
  }, []);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isClockedIn && startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isClockedIn, startTime]);

  const handleClockToggle = () => {
    const now = new Date();
    const newStatus = !isClockedIn;
    
    if (newStatus) {
      // Clocking In
      setStartTime(Date.now());
      localStorage.setItem('studio_clock_start', Date.now().toString());
    } else {
      // Clocking Out
      setStartTime(null);
      setElapsed(0);
      localStorage.removeItem('studio_clock_start');
    }

    const newEntry: TimeEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type: newStatus ? 'in' : 'out',
      timestamp: now,
    };

    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    setIsClockedIn(newStatus);

    // Persist
    localStorage.setItem('studio_clock_status', newStatus.toString());
    localStorage.setItem('studio_clock_entries', JSON.stringify(updatedEntries));
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700 text-left">
      <header className="text-center space-y-2">
        <h2 className="text-4xl md:text-5xl font-serif-brand font-bold text-black uppercase tracking-tight">Studio Clock</h2>
        <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-xs">Attendance Verification</p>
      </header>

      <div className="bg-[#1A1A1A] rounded-[40px] p-12 border-2 border-white/5 shadow-2xl flex flex-col items-center space-y-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
           <svg width="200" height="200" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>

        <div className="text-center z-10">
          <p className="text-6xl md:text-8xl font-serif-brand font-bold text-white tracking-widest tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[#C5A059] font-black uppercase tracking-[0.5em] text-xs mt-4">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <button
          onClick={handleClockToggle}
          className={`w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-2xl border-[8px] z-10 ${
            isClockedIn 
              ? 'bg-red-900/20 border-red-500 text-red-500 hover:bg-red-900/30' 
              : 'bg-[#C5A059]/10 border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059]/20'
          }`}
        >
          <div className="mb-2">
             {isClockedIn ? (
               <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
             ) : (
               <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
             )}
          </div>
          <span className="font-black text-lg uppercase tracking-widest">
            {isClockedIn ? 'Punch Out' : 'Punch In'}
          </span>
        </button>
        
        <div className="grid grid-cols-2 gap-12 w-full pt-8 border-t-2 border-white/5 z-10">
          <div className="text-center">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">Session Duration</p>
            <p className="text-2xl font-serif-brand font-bold text-white tabular-nums">{isClockedIn ? formatDuration(elapsed) : '--'}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">Status</p>
            <p className={`text-xl font-bold uppercase tracking-widest ${isClockedIn ? 'text-green-500' : 'text-white/20'}`}>
              {isClockedIn ? 'On Duty' : 'Off Duty'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-black text-black/30 uppercase tracking-[0.3em] px-4">Recent Activity Log</h3>
        <div className="bg-white rounded-[32px] border border-gray-200 overflow-hidden shadow-xl divide-y divide-gray-100">
          {entries.length === 0 ? (
            <div className="p-12 text-center text-black/20 italic text-[10px] uppercase font-black tracking-widest">No activity recorded today.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${entry.type === 'in' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {entry.type === 'in' ? (
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    ) : (
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black uppercase tracking-tight">Clocked {entry.type === 'in' ? 'In' : 'Out'}</p>
                    <p className="text-[9px] font-black text-black/30 uppercase tracking-widest mt-0.5">Location Verified</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono font-bold text-black">{entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest mt-0.5">
                    {entry.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeClock;
