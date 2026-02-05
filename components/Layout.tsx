
import React, { useState } from 'react';
import { TabType, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  isSyncing?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, role, onLogout, notificationCount = 0, onOpenNotifications, isSyncing = false }) => {
  const [showMenu, setShowMenu] = useState(false);

  const navItems: { id: TabType; label: string; icon: string; roles: UserRole[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'driver', 'housekeeping', 'hr', 'finance', 'client'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'logistics', label: 'Deliveries', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'Laundry', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'inventory_admin', label: 'Supplies', icon: '📦', roles: ['admin', 'housekeeping'] },
    { id: 'tutorials', label: 'Guidelines', icon: '📚', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor'] },
    { id: 'properties', label: 'Properties', icon: '🏠', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'Clients', icon: '🏢', roles: ['admin', 'finance'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'reports', label: 'Reports', icon: '📈', roles: ['admin', 'hr', 'housekeeping'] },
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'settings', label: 'My Studio', icon: '⚙️', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'maintenance', 'hr', 'finance', 'laundry'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));
  const mobilePrimary = visibleItems.filter(i => ['dashboard', 'shifts', 'logistics', 'laundry'].includes(i.id));

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden w-full">
      {/* SECONDARY SIDEBAR: DARK SLATE (DESKTOP) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
        <div className="p-8 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none">RESET</h1>
              <p className="text-[9px] font-bold text-teal-400 uppercase tracking-[0.25em] mt-2">HOSPITALITY STUDIO</p>
            </div>
            <button 
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <span className="text-xl">🔔</span>
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black animate-bounce shadow-lg">
                  {notificationCount}
                </span>
              )}
            </button>
          </div>

          {/* CLOUD SYNC INDICATOR */}
          <div className="pt-2">
             <div className={`px-4 py-2 rounded-xl border transition-all duration-500 flex items-center gap-3 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-teal-400 animate-ping' : 'bg-slate-500'}`}></div>
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-teal-400' : 'text-slate-500'}`}>
                   {isSyncing ? 'Cloud Syncing...' : 'Cloud Verified'}
                </span>
             </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 custom-scrollbar mt-4">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === item.id ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 text-xs font-bold uppercase hover:bg-white/5 rounded-2xl transition-colors hover:text-white">
             <span>🚪</span>
             <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative w-full overflow-hidden">
        {/* MOBILE HEADER */}
        <header className="md:hidden bg-white border-b border-teal-100 px-4 py-3 flex justify-between items-center sticky top-0 z-40 shadow-sm">
           <div className="flex flex-col">
              <h2 className="font-brand font-bold text-[#1E293B] text-lg leading-none tracking-tighter">RESET</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'SYNCING' : 'VERIFIED'}</span>
              </div>
           </div>
           <div className="flex items-center gap-3">
             <button onClick={onOpenNotifications} className="relative p-2">
               <span className="text-xl">🔔</span>
               {notificationCount > 0 && (
                 <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg">
                   {notificationCount}
                 </span>
               )}
             </button>
             <button 
               onClick={onLogout}
               className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shadow-sm active:scale-95 transition-all"
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
             </button>
           </div>
        </header>

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 pb-24 md:pb-10 custom-scrollbar w-full">
          <div className="w-full max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>

        {/* MOBILE DOCK */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-dock px-1 py-2 flex justify-around items-center z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.03)]">
           {mobilePrimary.map(item => (
             <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 flex-1 transition-all ${activeTab === item.id ? 'text-[#0D9488]' : 'text-slate-400'}`}
             >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
             </button>
           ))}
           <button 
            onClick={() => setShowMenu(true)}
            className="flex flex-col items-center gap-0.5 flex-1 text-slate-400"
           >
              <span className="text-xl">☰</span>
              <span className="text-[8px] font-black uppercase tracking-tighter">More</span>
           </button>
        </nav>

        {/* FULL SCREEN MENU MODAL (MOBILE) */}
        {showMenu && (
          <div className="fixed inset-0 bg-[#F0FDFA] z-[100] p-5 animate-in slide-in-from-bottom-5 duration-300 overflow-y-auto flex flex-col">
             <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex flex-col text-left">
                  <h2 className="text-xl font-brand font-bold text-[#1E293B] leading-none tracking-tighter">RESET</h2>
                  <span className="text-[7px] font-black text-[#0D9488] uppercase tracking-[0.3em]">HOSPITALITY STUDIO</span>
                </div>
                <button onClick={() => setShowMenu(false)} className="w-9 h-9 flex items-center justify-center bg-white rounded-full text-xl text-slate-400 border border-slate-100">&times;</button>
             </div>
             
             <div className="grid grid-cols-2 gap-3 flex-1 mb-6">
                {navItems.filter(item => item.roles.includes(role)).map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                    className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all gap-2 border h-24 ${activeTab === item.id ? 'bg-white border-[#0D9488] text-[#0D9488] shadow-md shadow-teal-900/5' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
             </div>

             <div className="pt-4 border-t border-teal-100 shrink-0 pb-2">
                <button 
                  onClick={() => { setShowMenu(false); onLogout(); }}
                  className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-sm flex items-center justify-center gap-2 border border-rose-100 active:scale-95 transition-all"
                >
                  <span className="text-lg">🚪</span>
                  LOG OUT SESSION
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
