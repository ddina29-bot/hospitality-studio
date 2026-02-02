
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
  // Fix: Added authorizedLaundryUserIds to LayoutProps to allow it being passed from App.tsx
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
  // Fix: Destructure authorizedLaundryUserIds prop even if not currently used in this component's render logic
  authorizedLaundryUserIds = []
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
      label: 'Schedule', 
      icon: Icons.Calendar, 
      roles: ['cleaner', 'admin', 'supervisor', 'housekeeping', 'maintenance'] 
    },
    { 
      id: 'logistics', 
      label: 'Assets', 
      icon: Icons.Truck, 
      roles: ['driver', 'admin', 'housekeeping'] 
    },
    {
        id: 'ai',
        label: 'Chat',
        icon: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
        roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client']
    },
    { 
      id: 'manual' as TabType, 
      label: 'Admin', 
      icon: Icons.Settings,
      roles: ['admin', 'housekeeping', 'hr'] 
    },
  ];

  const desktopNavItems = [
    ...allNavItems.filter(i => i.id !== 'manual'),
    { id: 'users' as TabType, label: 'Team', icon: Icons.Dashboard, roles: ['admin', 'hr'] },
    { id: 'settings' as TabType, label: 'Settings', icon: Icons.Settings, roles: ['admin'] }
  ].filter(item => (item.roles as string[]).includes(role));

  const mobileNavItems = allNavItems.filter(item => (item.roles as string[]).includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] text-[#1A1A1A]">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-gray-200 z-20">
        <div className="p-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-[#007AFF] flex items-center justify-center text-white shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
             </div>
             <h1 className="font-bold text-xl tracking-tight">Studio Ops</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {desktopNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-[#EBF5FF] text-[#007AFF] font-bold' 
                  : 'text-gray-500 hover:text-black hover:bg-gray-50 font-medium' 
              }`}
            >
              <item.icon />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-500 font-bold rounded-xl text-sm hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white border-b border-gray-100 flex justify-between items-center px-5 py-3 z-50 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                <img src={`https://ui-avatars.com/api/?name=${role}&background=007AFF&color=fff`} className="w-full h-full object-cover" />
             </div>
             <div>
               <h1 className="font-bold text-sm tracking-tight leading-none uppercase">{role} PORTAL</h1>
               <p className="text-[10px] text-gray-400 font-medium mt-0.5">Studio Operations</p>
             </div>
          </div>
          <button 
            onClick={onOpenActivityCenter}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 text-gray-600 relative transition-colors"
          >
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
             {hasUnread && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full p-4 md:p-10 pb-32 md:pb-10">
            {children}
          </div>
        </div>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all flex-1 relative ${
                activeTab === item.id ? 'text-[#007AFF]' : 'text-gray-400'
              }`}
            >
              {activeTab === item.id && <div className="nav-active-indicator" />}
              <item.icon />
              <span className={`text-[10px] font-bold ${activeTab === item.id ? 'text-[#007AFF]' : 'text-gray-400'}`}>
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
