
import React, { useMemo } from 'react';
import { TabType, User, Shift, Property } from '../../types';

interface DriverDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  properties: Property[];
  onResolveLogistics: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onUpdateKeyNote?: (shiftId: string, note: string) => void;
  onTogglePickedUp: (shiftId: string) => void;
  isLaundryAuthorized?: boolean;
  onToggleLaundryPrepared: (shiftId: string) => void;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ 
  user, setActiveTab, onLogout, shifts = [], properties = [], 
  onResolveLogistics, onUpdateKeyNote, onTogglePickedUp, 
  isLaundryAuthorized = false, onToggleLaundryPrepared 
}) => {
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
        <div className="space-y-1">
          <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px]">Studio Operator</p>
          <h1 className="text-3xl font-brand text-slate-900 tracking-tighter uppercase leading-none font-extrabold">
            Welcome, {user.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab('logistics')}
            className="bg-indigo-600 text-white font-black px-8 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-indigo-700"
          >
            OPEN DELIVERIES
          </button>
          <button onClick={onLogout} className="border border-slate-200 text-slate-500 font-black px-6 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white transition-all bg-white">
            LOG OUT
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Card: Daily Route (The "Action" Card) */}
        <section className="bg-white border-l-4 border-indigo-500 p-10 rounded-[40px] shadow-xl space-y-8 flex flex-col justify-between h-full">
           <div className="space-y-6">
              <div className="flex justify-between items-start">
                 <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M15 13h6"/></svg>
                 </div>
                 <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-200 animate-pulse shadow-sm">FLEET DEPLOYMENT ACTIVE</span>
              </div>
              <div>
                 <h3 className="text-2xl font-brand font-extrabold uppercase text-slate-900 tracking-tight leading-none">Daily Logistics Queue</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3">Active Operations • {todayStr}</p>
              </div>
           </div>
           <button onClick={() => setActiveTab('logistics')} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl active:scale-95">GO TO DEPLOYMENT</button>
        </section>

        {/* Right Card: Operational Intelligence (The "Data" Card) */}
        <section className="bg-slate-900 p-10 rounded-[40px] shadow-2xl space-y-10 relative overflow-hidden flex flex-col h-full">
           <div className="absolute -right-4 -bottom-4 text-white/5 opacity-5 pointer-events-none">
              <svg width="250" height="250" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
           </div>
           <div className="relative z-10">
              <h3 className="text-xs font-black text-teal-400 uppercase tracking-[0.4em] mb-10">Operational Intelligence</h3>
              <div className="space-y-8">
                 {[
                   { label: 'Planned Stops', value: '08', sub: 'Locations Today' },
                   { label: 'Key Pickup Required', value: 'HQ Central', sub: 'Access Verification' },
                   { label: 'Fleet Sync Status', value: 'Active', sub: 'GPS Online' }
                 ].map((data, i) => (
                    <div key={i} className="flex justify-between items-end border-b border-white/5 pb-4">
                       <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{data.label}</p>
                          <p className="text-xl font-bold text-white uppercase tracking-tight">{data.value}</p>
                       </div>
                       <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">{data.sub}</p>
                    </div>
                 ))}
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default DriverDashboard;
