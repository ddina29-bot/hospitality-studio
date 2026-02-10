
import React, { useState } from 'react';
import { TabType, UserRole, OrganizationSettings } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  isSyncing?: boolean;
  organization?: OrganizationSettings;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, setActiveTab, role, onLogout, 
  notificationCount = 0, onOpenNotifications, isSyncing = false,
  organization
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const navItems: { id: TabType; label: string; icon: string; roles: UserRole[] }[] = [
    { id: 'dashboard', label: 'Home', icon: '📊', roles: ['admin', 'driver', 'housekeeping', 'hr', 'finance', 'client', 'supervisor', 'cleaner'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'worksheet', label: 'Worksheet', icon: '📄', roles: ['cleaner', 'supervisor', 'laundry'] },
    { id: 'logistics', label: 'Deliveries', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'Laundry', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'properties', label: 'Portfolio', icon: '🏠', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'Partners', icon: '🏢', roles: ['admin'] },
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'pulse', label: 'Pulse', icon: '📡', roles: ['admin', 'housekeeping', 'supervisor', 'cleaner', 'driver'] },
    { 
      id: 'settings', 
      label: role === 'admin' ? 'Studio' : 'My Profile', 
      icon: role === 'admin' ? '⚙️' : '👤', 
      roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'laundry', 'maintenance'] 
    },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  const bottomNavItems = visibleItems.filter(item => 
    ['dashboard', 'shifts', 'logistics', 'users', 'settings', 'worksheet'].includes(item.id)
  ).slice(0, 5);

  const studioName = organization?.name || 'STUDIO';
  const brandFirstWord = studioName.split(' ')[0];
  const brandRemainder = studioName.split(' ').slice(1).join(' ');

  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden w-full selection:bg-teal-100 selection:text-teal-900">
      
      <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none truncate max-w-[180px]">
                {brandFirstWord}
              </h1>
              {brandRemainder && (
                <p className="text-[9px] font-bold text-teal-400 uppercase tracking-[0.25em] mt-2 truncate">
                  {brandRemainder}
                </p>
              )}
            </div>
          </div>

          <div className={`px-4 py-2 rounded-xl border transition-all duration-500 flex items-center gap-3 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-[#0D9488] animate-ping' : 'bg-slate-50'}`}></div>
            <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-[#0D9488]' : 'text-slate-50'}`}>
               {isSyncing ? 'Syncing...' : 'Cloud Verified'}
            </span>
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

        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 text-xs font-bold uppercase hover:bg-white/5 rounded-2xl transition-colors hover:text-white">
             <span>🚪</span>
             <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative w-full overflow-hidden">
        <header className="md:hidden bg-white border-b border-teal-100 px-5 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
           <div className="flex flex-col">
              <h2 className="font-brand font-bold text-[#1E293B] text-lg leading-none tracking-tighter truncate max-w-[150px]">
                {studioName.toUpperCase()}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'SYNCING' : 'VERIFIED'}</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={onOpenNotifications} className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
               <span className="text-lg">🔔</span>
               {notificationCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">{notificationCount}</span>}
             </button>
             <button onClick={() => setShowMenu(!showMenu)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-50 text-[#0D9488] border border-teal-100">
               <span className="text-xl">☰</span>
             </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar w-full pb-24 md:pb-10">
          <div className="w-full max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-dock flex justify-around items-center px-2 py-3 z-[100] h-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
           {bottomNavItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all ${activeTab === item.id ? 'text-[#0D9488] scale-110' : 'text-slate-400 opacity-60'}`}
              >
                <span className="text-2xl leading-none">{item.icon}</span>
                <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                {activeTab === item.id && <div className="w-1 h-1 bg-[#0D9488] rounded-full mt-0.5"></div>}
              </button>
           ))}
        </nav>

        {showMenu && (
          <div className="fixed inset-0 bg-black/40 z-[200] md:hidden animate-in fade-in" onClick={() => setShowMenu(false)}>
            <div className="absolute top-0 right-0 bottom-0 w-4/5 bg-white shadow-2xl p-8 space-y-8 animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Navigation</h3>
                  <button onClick={() => setShowMenu(false)} className="text-2xl text-slate-300">&times;</button>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  {visibleItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                      className={`flex items-center gap-4 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${activeTab === item.id ? 'bg-[#0D9488] border-[#0D9488] text-white' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
               </div>

               <div className="mt-auto space-y-3">
                  <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-rose-100">Terminate Session</button>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
