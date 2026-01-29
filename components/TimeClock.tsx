import React, { useState, useEffect } from 'react';
import { TimeEntry } from '../types';
import { Icons } from '../constants';

const TimeClock: React.FC = () => {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClockToggle = () => {
    const newEntry: TimeEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type: isClockedIn ? 'out' : 'in',
      timestamp: new Date(),
    };
    setEntries([newEntry, ...entries]);
    setIsClockedIn(!isClockedIn);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="text-center space-y-2">
        <h2 className="text-5xl font-serif-brand font-bold text-white uppercase tracking-tight">Studio Clock</h2>
        <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-sm">Attendance Verification</p>
      </header>

      <div className="bg-[#1A1A1A] rounded-[40px] p-12 border-2 border-white/5 shadow-2xl flex flex-col items-center space-y-12">
        <div className="text-center">
          <p className="text-6xl md:text-8xl font-serif-brand font-bold text-white tracking-widest">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[#C5A059] font-black uppercase tracking-[0.5em] text-xs mt-4">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <button
          onClick={handleClockToggle}
          className={`w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-90 shadow-2xl border-[12px] ${
            isClockedIn 
              ? 'bg-red-900/20 border-red-500 text-red-500' 
              : 'bg-[#C5A059]/10 border-[#C5A059] text-[#C5A059]'
          }`}
        >
          <div className="mb-4">
             {isClockedIn ? (
               <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>
             ) : (
               <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
             )}
          </div>
          <span className="font-black text-xl uppercase tracking-widest">
            {isClockedIn ? 'Stop' : 'Start'}
          </span>
        </button>
        
        <div className="grid grid-cols-2 gap-12 w-full pt-8 border-t-2 border-white/5">
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase font-black tracking-widest mb-2">Shift Duration</p>
            <p className="text-3xl font-serif-brand font-bold text-white">{isClockedIn ? '0h 14m' : '--'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase font-black tracking-widest mb-2">Current Status</p>
            <p className={`text-xl font-bold uppercase tracking-widest ${isClockedIn ? 'text-green-500' : 'text-white/20'}`}>
              {isClockedIn ? 'Active Session' : 'Standby'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-serif-brand text-white uppercase font-bold tracking-tight px-4">Session Logs</h3>
        <div className="bg-[#1A1A1A] rounded-3xl border-2 border-white/5 overflow-hidden shadow-xl divide-y-2 divide-white/5">
          {entries.length === 0 ? (
            <div className="p-16 text-center text-white/20 italic text-lg">No sessions recorded today.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-8 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${entry.type === 'in' ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>
                    <Icons.Clock />
                  </div>
                  <div>
                    <p className="text-2xl font-serif-brand font-bold text-white uppercase italic">Session {entry.type === 'in' ? 'Started' : 'Ended'}</p>
                    <p className="text-sm font-bold text-white/30 uppercase tracking-widest mt-1">Studio Verification Complete</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white tracking-widest">{entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest mt-1">Verified Log</p>
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