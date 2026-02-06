
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

const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, setActiveTab, role, onLogout, 
  notificationCount = 0, onOpenNotifications, isSyncing = false
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // RESTRICTED TABS: Strictly enforce that only 'admin' sees Finance, Reports, and Team
  const navItems: { id: TabType; label: string; icon: string; roles: UserRole[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'driver', 'housekeeping', 'hr', 'finance', 'client', 'cleaner', 'supervisor', 'laundry'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'logistics', label: 'Deliveries', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'Laundry', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'inventory_admin', label: 'Supplies', icon: '📦', roles: ['admin', 'housekeeping'] },
    { id: 'tutorials', label: 'Guidelines', icon: '📚', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor'] },
    { id: 'properties', label: 'Properties', icon: '🏠', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'Clients', icon: '🏢', roles: ['admin'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin'] }, // Admin Only
    { id: 'reports', label: 'Reports', icon: '📈', roles: ['admin'] }, // Admin Only
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin'] },    // Admin Only
    { id: 'settings', label: 'My Studio', icon: '⚙️', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'maintenance', 'hr', 'finance', 'laundry'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <div className="fixed inset-0 flex bg-[#F0FDFA] overflow-hidden w-full h-[100dvh]">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
        <div className="p-8 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col text-left">
              <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none">RESET</h1>
              <p className="text-[9px] font-bold text-teal-400 uppercase tracking-[0.25em] mt-2 text-left">HOSPITALITY STUDIO</p>
            </div>
          </div>
          <div className="pt-2">
             <div className={`px-4 py-2 rounded-xl border transition-all duration-500 flex items-center gap-3 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-teal-400 animate-ping' : 'bg-slate-50'}`}></div>
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-teal-400' : 'text-slate-500'}`}>
                   {isSyncing ? 'Syncing...' : 'Cloud Verified'}
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

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 relative w-full h-full overflow-hidden">
        {/* MOBILE HEADER (ONLY NAVIGATION HUB) */}
        <header className="md:hidden bg-white border-b border-teal-100 px-5 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm shrink-0 w-full">
           <div className="flex flex-col text-left">
              <h2 className="font-brand font-bold text-[#1E293B] text-xl leading-none tracking-tighter">RESET</h2>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{isSyncing ? 'SYNCING' : 'SECURE SESSION'}</p>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={onOpenNotifications} className="relative p-2">
               <span className="text-2xl">🔔</span>
               {notificationCount > 0 && (
                 <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg">
                   {notificationCount}
                 </span>
               )}
             </button>
             <button onClick={() => setShowMenu(true)} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
               <span>MENU</span>
               <span className="text-lg">☰</span>
             </button>
           </div>
        </header>

        {/* SCROLLABLE CONTENT - Removed Bottom Padding for Dock */}
        <div className="flex-1 overflow-y-auto w-full p-4 md:p-10 pb-10 bg-[#F0FDFA]">
          <div className="w-full max-w-[1400px] mx-auto text-left">
            {children}
          </div>
        </div>

        {/* FULL SCREEN MENU (MOBILE OVERLAY) */}
        {showMenu && (
          <div className="fixed inset-0 bg-white z-[200] p-6 animate-in slide-in-from-right duration-300 overflow-y-auto flex flex-col h-full">
             <div className="flex justify-between items-center mb-10 shrink-0">
                <div className="flex flex-col text-left">
                  <h2 className="text-2xl font-brand font-bold text-[#1E293B] leading-none tracking-tighter">RESET</h2>
                  <span className="text-[8px] font-black text-[#0D9488] uppercase tracking-[0.3em] mt-1 text-left">OPERATIONS HUB</span>
                </div>
                <button onClick={() => setShowMenu(false)} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-full text-2xl text-slate-400 border border-slate-100 shadow-sm active:scale-90 transition-all">&times;</button>
             </div>
             
             <div className="grid grid-cols-2 gap-4 flex-1 mb-10">
                {visibleItems.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                    className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] transition-all gap-3 border min-h-[110px] ${activeTab === item.id ? 'bg-[#F0FDFA] border-[#0D9488] text-[#0D9488] shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">{item.label}</span>
                  </button>
                ))}
             </div>

             <div className="pt-6 border-t border-slate-100 shrink-0 pb-10">
                <button 
                  onClick={() => { setShowMenu(false); onLogout(); }}
                  className="w-full bg-rose-50 text-rose-600 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-sm flex items-center justify-center gap-3 border border-rose-100 active:scale-95 transition-all"
                >
                  <span className="text-xl">🚪</span>
                  LOG OUT
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
