import React from 'react';
import { TabType, UserRole, AppNotification } from '../types';
import { Icons } from '../constants';

interface LayoutProps {
  children?: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  authorizedLaundryUserIds?: string[];
  currentUserId?: string;
  notifications?: AppNotification[];
  onOpenActivityCenter?: () => void;
}

const Layout = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  role, 
  onLogout, 
  authorizedLaundryUserIds = [], 
  currentUserId = '',
  notifications = [],
  onOpenActivityCenter
}: LayoutProps) => {
  
  const hasUnread = notifications.some(n => {
      const ts = typeof n.timestamp === 'string' ? new Date(n.timestamp).getTime() : n.timestamp;
      return Date.now() - ts < 24 * 60 * 60 * 1000; 
  });

  const allNavItems: { id: TabType; label: string; icon: React.FC<any>; roles: UserRole[] }[] = [
    { 
      id: 'dashboard', 
      label: 'Home', 
      icon: Icons.Dashboard, 
      roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client', 'outsourced_maintenance'] 
    },
    { 
      id: 'shifts', 
      label: 'Assets', 
      icon: Icons.Building, 
      roles: ['cleaner', 'admin', 'supervisor', 'housekeeping', 'maintenance'] 
    },
    { 
      id: 'logistics', 
      label: 'My Route', 
      icon: Icons.Truck, 
      roles: ['driver', 'admin', 'housekeeping'] 
    },
    {
        id: 'ai',
        label: 'Support',
        icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
        roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client']
    },
    { 
      id: 'manual' as TabType, 
      label: 'Menu', 
      icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
      roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client', 'outsourced_maintenance'] 
    },
  ];

  const desktopNavItems: { id: TabType; label: string; icon: React.FC<any>; roles: UserRole[] }[] = [
    ...allNavItems.filter(i => i.id !== 'manual'),
    { id: 'users' as TabType, label: 'Team', icon: Icons.Dashboard, roles: ['admin', 'hr'] as UserRole[] },
    { id: 'settings' as TabType, label: 'Settings', icon: Icons.Settings, roles: ['admin'] as UserRole[] }
  ].filter(item => item.roles.includes(role));

  const mobileNavItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB] text-[#1A1A1A]">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 z-20">
        <div className="p-8">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
            <span className="text-[#C5A059] text-[10px] font-black tracking-[0.4em] mb-1">RESET</span>
            <span className="text-black font-bold text-2xl tracking-tighter">STUDIO</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {desktopNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-[#C5A059] text-white font-bold shadow-md' 
                  : 'text-gray-500 hover:text-black hover:bg-gray-100 font-medium' 
              }`}
            >
              <item.icon />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-red-500 font-bold rounded-xl text-xs hover:bg-red-50 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            LOG OUT
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white border-b border-gray-100 flex justify-between items-center px-5 py-4 z-50 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-[#C5A059] flex items-center justify-center text-white font-bold text-xs">
                {role.charAt(0).toUpperCase()}
             </div>
             <h1 className="font-serif-brand text-black font-bold text-lg tracking-tight uppercase">Studio</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenActivityCenter}
              className="p-2 text-gray-500 relative"
            >
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
               {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full p-4 md:p-10 pb-32 md:pb-10">
            {children}
          </div>
        </div>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all flex-1 relative ${
                activeTab === item.id ? 'text-[#C5A059]' : 'text-gray-400'
              }`}
            >
              <item.icon />
              <span className={`text-[10px] font-bold ${activeTab === item.id ? 'text-[#C5A059]' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {activeTab === item.id && <div className="nav-active-indicator" />}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;