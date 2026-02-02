
import React from 'react';
import { TabType, UserRole, AppNotification } from '../types';
import { Icons } from '../constants';

interface LayoutProps {
  children?: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  currentUserId?: string;
  notifications?: AppNotification[];
  onOpenActivityCenter?: () => void;
  authorizedLaundryUserIds?: string[];
}

const Layout = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  role, 
  onLogout, 
  notifications = [],
  onOpenActivityCenter,
  authorizedLaundryUserIds = []
}: LayoutProps) => {
  
  const hasUnread = notifications.some(n => {
      const ts = typeof n.timestamp === 'string' ? new Date(n.timestamp).getTime() : n.timestamp;
      return Date.now() - ts < 24 * 60 * 60 * 1000; 
  });

  const allNavItems: { id: TabType; label: string; icon: React.FC<any>; roles: UserRole[] }[] = [
    { 
      id: 'dashboard', 
      label: 'DASHBOARD', 
      icon: Icons.Dashboard, 
      roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client', 'outsourced_maintenance'] 
    },
    { 
      id: 'shifts', 
      label: 'SCHEDULE', 
      icon: Icons.Calendar, 
      roles: ['cleaner', 'admin', 'supervisor', 'housekeeping', 'maintenance'] 
    },
    { 
      id: 'logistics', 
      label: 'LOGISTICS', 
      icon: Icons.Truck, 
      roles: ['driver', 'admin', 'housekeeping'] 
    },
    {
        id: 'ai',
        label: 'INTEL',
        icon: Icons.Sparkles,
        roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client']
    },
    { 
      id: 'manual' as TabType, 
      label: 'GUIDE', 
      icon: Icons.Settings,
      roles: ['admin', 'housekeeping', 'hr'] 
    },
  ];

  const desktopNavItems = [
    ...allNavItems,
    { id: 'users' as TabType, label: 'TEAM', icon: Icons.Dashboard, roles: ['admin', 'hr'] },
    { id: 'settings' as TabType, label: 'CORE', icon: Icons.Settings, roles: ['admin'] }
  ].filter(item => (item.roles as string[]).includes(role));

  const mobileNavItems = allNavItems.filter(item => (item.roles as string[]).includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#1A1A1A]">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 bg-[#1A1A1A] text-white z-20 shadow-2xl">
        <div className="p-10">
          <div className="flex flex-col">
             <span className="text-[#C5A059] text-[10px] font-black tracking-[0.4em] mb-1">RESET</span>
             <h1 className="font-serif-brand font-bold text-2xl tracking-tighter leading-none">STUDIO</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {desktopNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
                activeTab === item.id
                  ? 'bg-[#C5A059] text-black font-black shadow-xl scale-[1.02]' 
                  : 'text-white/40 hover:text-white hover:bg-white/5 font-bold' 
              }`}
            >
              <item.icon />
              <span className="text-[10px] tracking-[0.2em] uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-3 text-white/20 font-black rounded-xl text-[9px] uppercase tracking-widest hover:text-red-500 transition-all"
          >
            EXIT STUDIO
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white/80 backdrop-blur-md border-b border-black/5 flex justify-between items-center px-6 py-4 z-50 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex flex-col">
             <span className="text-[#C5A059] text-[8px] font-black tracking-[0.3em] leading-none">RESET</span>
             <h1 className="font-serif-brand font-bold text-lg tracking-tighter leading-none">STUDIO</h1>
          </div>
          <button 
            onClick={onOpenActivityCenter}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 text-black relative transition-colors"
          >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
             {hasUnread && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#C5A059] rounded-full border-2 border-white"></span>}
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="max-w-6xl mx-auto w-full p-6 md:p-12 pb-32 md:pb-12">
            {children}
          </div>
        </div>

        {/* BOTTOM NAV (Mobile) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 flex items-center justify-around px-4 py-2 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all flex-1 relative ${
                activeTab === item.id ? 'text-[#C5A059]' : 'text-black/20'
              }`}
            >
              {activeTab === item.id && <div className="nav-active-indicator" />}
              <item.icon />
              <span className={`text-[8px] font-black tracking-widest ${activeTab === item.id ? 'text-black' : 'text-black/20'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
