
import React from 'react';
import { TabType, UserRole } from '../types';
import { Icons } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  authorizedLaundryUserIds?: string[];
  currentUserId?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, role, onLogout, authorizedLaundryUserIds = [], currentUserId = '' }) => {
  const isLaundryTabVisible = 
    role === 'admin' || 
    (['supervisor', 'driver'].includes(role) && (authorizedLaundryUserIds || []).includes(currentUserId));

  const allNavItems: { id: TabType; label: string; icon: React.FC; roles: UserRole[] }[] = [
    { 
      id: 'dashboard', 
      label: 'DASHBOARD', 
      icon: Icons.Dashboard, 
      roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client', 'outsourced_maintenance'] 
    },
    { 
      id: 'laundry', 
      label: 'LAUNDRY', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
      ),
      roles: ['admin', 'supervisor', 'driver'],
    },
    { 
      id: 'shifts', 
      label: 'SCHEDULE', 
      icon: Icons.Calendar, 
      roles: ['cleaner', 'admin', 'supervisor', 'housekeeping', 'maintenance'] 
    },
    { 
      id: 'logistics', 
      label: role === 'driver' ? 'MY ROUTES' : 'DRIVER ROUTES', 
      icon: Icons.Truck, 
      roles: ['driver', 'admin', 'housekeeping'] 
    },
    { 
      id: 'supervisor_portal', 
      label: 'SUPERVISOR', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 21a8 8 0 0 1 13.29-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/></svg>
      ), 
      roles: ['admin', 'housekeeping'] 
    },
    { 
      id: 'properties', 
      label: 'PROPERTIES', 
      icon: Icons.Building, 
      roles: ['admin', 'housekeeping', 'client'] 
    },
    { 
      id: 'clients', 
      label: 'CLIENTS', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ), 
      roles: ['admin', 'client'] 
    },
    { 
      id: 'tutorials', 
      label: 'KNOWLEDGE BASE', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      ), 
      roles: ['cleaner', 'supervisor', 'housekeeping', 'admin'] 
    },
    { 
      id: 'inventory_admin', 
      label: 'SUPPLIES', 
      icon: Icons.Sparkles, 
      roles: ['admin', 'housekeeping'] 
    },
    { 
      id: 'maintenance', 
      label: 'MAINTENANCE', 
      icon: Icons.Maintenance, 
      roles: ['admin', 'outsourced_maintenance'] 
    },
    { 
      id: 'reports', 
      label: 'REPORTS', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y2="13"/><line x1="16" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      ), 
      roles: ['admin', 'housekeeping', 'hr'] 
    },
    { 
      id: 'finance', 
      label: 'FINANCE', 
      icon: Icons.Payroll, 
      roles: ['admin', 'finance'] 
    },
    { 
      id: 'personnel_profile', 
      label: 'STUDIO DETAILS', 
      icon: Icons.Clock, 
      roles: ['cleaner', 'driver', 'maintenance', 'laundry', 'supervisor', 'housekeeping'] 
    },
    { 
      id: 'users', 
      label: 'HUMAN CAPITAL', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M17 3.13a4 4 0 0 1 0 7.75"/></svg>
      ), 
      roles: ['admin', 'hr', 'housekeeping'] 
    },
    {
      id: 'settings',
      label: 'SETTINGS',
      icon: Icons.Settings,
      roles: ['admin']
    },
    {
      id: 'manual',
      label: 'SYSTEM MANUAL',
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      ),
      roles: ['cleaner', 'driver', 'supervisor', 'admin', 'housekeeping', 'maintenance', 'hr', 'finance', 'laundry', 'client', 'outsourced_maintenance']
    }
  ];

  const navItems = allNavItems.filter(item => {
    if (item.id === 'laundry') return isLaundryTabVisible;
    return item.roles.includes(role);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#1A1A1A]">
      <aside className="hidden md:flex flex-col w-72 bg-[#A68342] border-r border-black/5 text-black shadow-2xl">
        <div className="p-10 pb-6">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
            <span className="text-black/30 text-[10px] font-black tracking-[0.4em] mb-1">RESET</span>
            <span className="text-black font-bold text-2xl tracking-tighter">HOSPITALITY</span>
            <span className="text-black/60 text-base italic tracking-[0.2em] font-bold">STUDIO</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                activeTab === item.id
                  ? 'bg-[#8B6B2E] text-white font-black shadow-lg scale-[1.02]' 
                  : 'bg-transparent text-black/60 hover:text-black hover:bg-black/5 font-bold' 
              }`}
            >
              <div className={activeTab === item.id ? 'text-white' : 'text-black/40'}>
                <item.icon />
              </div>
              <span className="uppercase tracking-[0.15em] text-[10px] font-black">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 space-y-4">
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-black/10 hover:bg-black/20 border border-black/10 text-black font-black rounded-xl text-[10px] uppercase tracking-[0.2em] transition-all"
          >
            EXIT STUDIO
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white">
        <header className="md:hidden sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex justify-between items-center px-6 py-4 z-50">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none scale-75 origin-left">
            <span className="text-black/30 text-[10px] font-black tracking-[0.4em]">RESET</span>
            <span className="text-black font-bold text-xl">HOSPITALITY</span>
          </h1>
          <button 
            onClick={onLogout}
            className="p-2.5 bg-red-50 text-red-600 rounded-xl active:scale-95 transition-all border border-red-100"
            aria-label="Logout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-28 custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-center px-4 py-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] overflow-x-auto no-scrollbar gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 min-w-[50px] shrink-0 transition-all ${
                activeTab === item.id ? 'text-[#C5A059]' : 'text-[#1A1A1A]/30'
              }`}
            >
              <item.icon />
              <span className="text-[7px] font-black uppercase tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
