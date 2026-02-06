
import React from 'react';
import { User, UserRole, TabType } from '../types';

interface BuildModeOverlayProps {
  currentUser: User | null;
  onSwitchUser: (role: UserRole) => void;
  onToggleTab: (tab: TabType) => void;
  stats: {
    users: number;
    properties: number;
    shifts: number;
  };
  onClose: () => void;
}

const BuildModeOverlay: React.FC<BuildModeOverlayProps> = ({ 
  currentUser, onSwitchUser, onToggleTab, stats, onClose 
}) => {
  const roles: UserRole[] = ['admin', 'supervisor', 'cleaner', 'driver', 'housekeeping', 'laundry', 'finance', 'hr'];

  const features = [
    { name: 'Top Right Navigation', status: 'Implemented' },
    { name: 'Employee Worksheet', status: 'Implemented' },
    { name: 'Piece-Rate Logic', status: 'Implemented' },
    { name: 'Geofence Logic', status: 'Implemented' },
    { name: 'Cloud Sync (SQLite)', status: 'Active' },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/30 w-full max-w-2xl rounded-[2.5rem] shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CONSOLE HEADER */}
        <header className="bg-amber-500 p-6 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-amber-500 font-black text-xs">🛠️</div>
              <div>
                <h2 className="text-black font-black uppercase text-sm tracking-[0.2em] leading-none">Studio Build Console</h2>
                <p className="text-[10px] text-black/60 font-bold uppercase tracking-widest mt-1">Version 1.0.4-beta • Active Session</p>
              </div>
           </div>
           <button onClick={onClose} className="bg-black/10 hover:bg-black/20 w-10 h-10 rounded-full text-black font-black text-xl transition-all">×</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
           
           {/* ROLE IMPERSONATION */}
           <section className="space-y-4">
              <div className="flex items-center gap-3">
                 <span className="text-amber-500 text-xs">👤</span>
                 <h3 className="text-amber-500 font-black uppercase text-[10px] tracking-[0.4em]">Identity Overwrite</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                 {roles.map(role => (
                    <button 
                      key={role}
                      onClick={() => onSwitchUser(role)}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${currentUser?.role === role ? 'bg-amber-500 text-black border-amber-500 shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-500/50'}`}
                    >
                       {role}
                    </button>
                 ))}
              </div>
              <p className="text-[8px] text-slate-500 italic uppercase">* Clicking a role will instantly refresh the UI state for that persona.</p>
           </section>

           {/* FEATURE AUDIT */}
           <section className="space-y-4">
              <div className="flex items-center gap-3">
                 <span className="text-amber-500 text-xs">📜</span>
                 <h3 className="text-amber-500 font-black uppercase text-[10px] tracking-[0.4em]">Feature Roadmap Check</h3>
              </div>
              <div className="bg-black/40 border border-slate-800 rounded-3xl p-6 space-y-3">
                 {features.map((f, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-slate-800/50 pb-2 last:border-0">
                       <span className="text-slate-300 text-[10px] font-bold uppercase tracking-tight">{f.name}</span>
                       <span className="text-emerald-500 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">{f.status}</span>
                    </div>
                 ))}
              </div>
           </section>

           {/* LIVE TELEMETRY */}
           <section className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center">
                 <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Users</p>
                 <p className="text-xl font-bold text-white">{stats.users}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center">
                 <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Assets</p>
                 <p className="text-xl font-bold text-white">{stats.properties}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-center">
                 <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Shifts</p>
                 <p className="text-xl font-bold text-white">{stats.shifts}</p>
              </div>
           </section>

        </div>

        <footer className="bg-slate-800/50 p-6 border-t border-slate-800 text-center">
           <button 
             onClick={() => { localStorage.clear(); window.location.reload(); }}
             className="text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] hover:underline"
           >
             Hard Reset Environment (Clear Cache)
           </button>
        </footer>
      </div>
    </div>
  );
};

export default BuildModeOverlay;
