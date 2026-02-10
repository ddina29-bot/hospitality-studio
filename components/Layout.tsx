
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

  // Navigation Items with updated labels and grouping
  const navItems: { id: TabType; label: string; icon: string; roles: UserRole[] }[] = [
    { id: 'dashboard', label: 'HOME', icon: '🏠', roles: ['admin', 'driver', 'housekeeping', 'supervisor', 'cleaner', 'finance', 'hr', 'laundry'] },
    { id: 'pulse', label: 'PULSE', icon: '✨', roles: ['admin', 'driver', 'housekeeping', 'supervisor', 'cleaner', 'finance', 'hr', 'laundry'] },
    { id: 'shifts', label: 'SCHEDULE', icon: '📋', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'worksheet', label: 'EARNINGS', icon: '📄', roles: ['cleaner', 'supervisor', 'laundry', 'driver'] },
    { id: 'logistics', label: 'DELIVERIES', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'LINEN', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'tutorials', label: 'ACADEMY', icon: '🎓', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'laundry', 'finance', 'hr'] },
    // Grouped Asset Management
    { id: 'properties', label: 'PROPERTIES', icon: '🏢', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'CLIENTS', icon: '🤝', roles: ['admin', 'housekeeping', 'finance'] },
    // Management & Finance
    { id: 'finance', label: 'FINANCE', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'users', label: 'STAFF', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'settings', label: 'PROFILE', icon: '👤', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'laundry', 'finance', 'hr'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  // Mobile prioritized bottom nav items
  const bottomNavItems = visibleItems.filter(item => 
    ['dashboard', 'pulse', 'shifts', 'tutorials', 'worksheet'].includes(item.id)
  ).slice(0, 5);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden w-full selection:bg-teal-100 selection:text-teal-900">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
        <div className="p-8 space-y-4">
          <h1 className="font-brand text-2xl text-white tracking-tighter uppercase font-black leading-none">
            {organization?.name || 'STUDIO'}
          </h1>
          <div className={`px-4 py-1.5 rounded-full border text-[7px] font-black uppercase tracking-[0.2em] w-fit flex items-center gap-2 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-slate-800/30 border-slate-700/50 text-slate-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-teal-400 animate-pulse' : 'bg-slate-500'}`}></div>
            {isSyncing ? 'Synchronizing' : 'Connected'}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 mt-2 custom-scrollbar">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
                activeTab === item.id ? 'bg-[#0D9488] text-white shadow-xl' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-xl opacity-80">{item.icon}</span>
              <span className="tracking-tight uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-700/50">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3 text-slate-500 text-[10px] font-black uppercase hover:text-white transition-colors">
             <span>🚪</span>
             <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 relative w-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
           <h2 className="font-brand font-black text-[#1E293B] text-lg leading-none tracking-tighter truncate uppercase">
             {organization?.name || 'STUDIO'}
           </h2>
           <div className="flex items-center gap-4">
             <button onClick={onOpenNotifications} className="relative text-xl">
               🔔
               {notificationCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[7px] font-black shadow-lg">{notificationCount}</span>}
             </button>
             <button onClick={() => setShowMenu(true)} className="text-2xl">☰</button>
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar w-full pb-32 md:pb-10">
          <div className="w-full max-w-5xl mx-auto">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center px-2 py-3 z-[100] h-20 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
           {bottomNavItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all ${activeTab === item.id ? 'text-[#0D9488]' : 'text-slate-400'}`}
              >
                <span className={`text-2xl leading-none transition-transform ${activeTab === item.id ? 'scale-110' : ''}`}>{item.icon}</span>
                <span className={`text-[8px] font-black uppercase tracking-widest ${activeTab === item.id ? 'opacity-100' : 'opacity-40'}`}>{item.label}</span>
              </button>
           ))}
        </nav>

        {/* Side Drawer */}
        {showMenu && (
          <div className="fixed inset-0 bg-black/40 z-[200] md:hidden backdrop-blur-sm animate-in fade-in" onClick={() => setShowMenu(false)}>
            <div className="absolute top-0 right-0 bottom-0 w-3/4 bg-white shadow-2xl p-8 space-y-8 animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Main Menu</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management Controls</p>
                  </div>
                  <button onClick={() => setShowMenu(false)} className="text-3xl text-slate-300">&times;</button>
               </div>
               
               <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                  {visibleItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                      className={`w-full flex items-center gap-5 p-5 rounded-[1.5rem] text-sm font-bold tracking-tight transition-all ${activeTab === item.id ? 'bg-teal-50 text-teal-700' : 'bg-slate-50 text-slate-500'}`}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
               </div>

               <div className="pt-6 border-t border-slate-100">
                  <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-rose-100">Sign Out</button>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
