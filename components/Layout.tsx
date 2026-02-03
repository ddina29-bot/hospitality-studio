
import React, { useState } from 'react';
import { TabType, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, role, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);

  const navItems: { id: TabType; label: string; icon: string; roles: UserRole[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'hr', 'finance', 'client'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'logistics', label: 'Deliveries', icon: '📦', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'tutorials', label: 'Guidelines', icon: '📚', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor'] },
    { id: 'properties', label: 'Properties', icon: '🏠', roles: ['admin', 'housekeeping'] },
    { id: 'clients', label: 'Clients', icon: '🏢', roles: ['admin', 'finance'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'reports', label: 'Reports', icon: '📈', roles: ['admin', 'hr', 'housekeeping'] },
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));
  const mobilePrimary = visibleItems.filter(i => ['dashboard', 'shifts', 'logistics'].includes(i.id));

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* TEAL SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0D9488] text-white shrink-0">
        <div className="p-8">
          <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none">RESET</h1>
          <p className="text-[9px] font-bold text-teal-100 uppercase tracking-[0.25em] mt-2">HOSPITALITY STUDIO</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === item.id ? 'bg-white text-[#0D9488] shadow-lg' : 'text-teal-50 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-teal-700/50">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3 text-teal-100 text-xs font-bold uppercase hover:bg-white/10 rounded-2xl transition-colors">
             <span>🚪</span>
             <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
           <div className="flex flex-col">
              <h2 className="font-brand font-bold text-[#0D9488] text-xl leading-none">RESET</h2>
              <span className="text-[7px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">HOSPITALITY STUDIO</span>
           </div>
           <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-100 text-[#0D9488] flex items-center justify-center text-[10px] font-bold uppercase">
            {role.charAt(0)}
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-28 md:pb-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>

        {/* MOBILE DOCK */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-dock px-2 py-3 flex justify-around items-center z-50">
           {mobilePrimary.map(item => (
             <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === item.id ? 'text-[#0D9488]' : 'text-slate-400'}`}
             >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
             </button>
           ))}
           <button 
            onClick={() => setShowMenu(true)}
            className="flex flex-col items-center gap-1 flex-1 text-slate-400"
           >
              <span className="text-2xl">☰</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
           </button>
        </nav>

        {/* MENU MODAL */}
        {showMenu && (
          <div className="fixed inset-0 bg-white z-[100] p-8 animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-10">
                <div className="flex flex-col text-left">
                  <h2 className="text-2xl font-brand font-bold text-[#0D9488] leading-none">RESET</h2>
                  <span className="text-[8px] font-black text-[#0D9488] uppercase tracking-[0.3em]">HOSPITALITY STUDIO</span>
                </div>
                <button onClick={() => setShowMenu(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-2xl text-slate-500">&times;</button>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {visibleItems.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                    className={`flex flex-col items-center justify-center p-6 rounded-3xl transition-all gap-3 border ${activeTab === item.id ? 'bg-teal-50 border-[#0D9488] text-[#0D9488]' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
