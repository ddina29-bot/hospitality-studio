
import React from 'react';
import { TabType, UserRole } from '../types';
import { Icons } from '../constants';

interface LayoutProps {
  children?: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  role: UserRole;
  onLogout: () => void;
  authorizedLaundryUserIds?: string[];
  currentUserId?: string;
}

const Layout = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  role, 
  onLogout, 
  authorizedLaundryUserIds = [], 
  currentUserId = ''
}: LayoutProps) => {
  
  const isLaundryTabVisible = 
    role === 'admin' || 
    role === 'laundry' ||
    (['supervisor', 'driver'].includes(role) && (authorizedLaundryUserIds || []).includes(currentUserId));

  // Define navigation items with their visibility logic
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
      id: 'laundry', 
      label: 'Laundry', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
      ),
      roles: ['admin', 'supervisor', 'driver', 'laundry'],
    },
    { 
      id: 'logistics', 
      label: 'Routes', 
      icon: Icons.Truck, 
      roles: ['driver', 'admin', 'housekeeping'] 
    },
    { 
      id: 'properties', 
      label: 'Units', 
      icon: Icons.Building, 
      roles: ['admin', 'housekeeping', 'client'] 
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
      roles: ['admin', 'housekeeping', 'finance']
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Icons.Maintenance,
      roles: ['admin', 'housekeeping', 'maintenance']
    },
    {
      id: 'inventory_admin',
      label: 'Inventory',
      icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
      roles: ['admin', 'housekeeping']
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: Icons.Sparkles,
      roles: ['admin', 'housekeeping', 'client']
    },
    { 
      id: 'finance', 
      label: 'Finance', 
      icon: Icons.Payroll, 
      roles: ['admin', 'finance'] 
    },
    {
      id: 'tutorials',
      label: 'SOPs',
      icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
      roles: ['admin', 'housekeeping', 'cleaner', 'supervisor']
    },
    { 
      id: 'users', 
      label: 'Team', 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M17 3.13a4 4 0 0 1 0 7.75"/></svg>
      ), 
      roles: ['admin', 'hr', 'housekeeping'] 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Icons.Settings, 
      roles: ['admin'] 
    }
  ];

  const navItems = allNavItems.filter(item => {
    if (item.id === 'laundry') return isLaundryTabVisible;
    return item.roles.includes(role);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] text-[#1A1A1A]">
      
      {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-gray-100 text-black shadow-sm z-20">
        <div className="p-8 pb-6 flex items-center justify-between">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
            <span className="text-[#C5A059] text-[10px] font-black tracking-[0.4em] mb-1">RESET</span>
            <span className="text-black font-bold text-2xl tracking-tighter">STUDIO</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-[#FDF8EE] text-[#C5A059] font-bold shadow-sm border border-[#C5A059]/20' 
                  : 'bg-transparent text-gray-500 hover:text-black hover:bg-gray-50 font-medium' 
              }`}
            >
              <div className={activeTab === item.id ? 'text-[#C5A059]' : 'text-gray-400'}>
                <item.icon />
              </div>
              <span className="uppercase tracking-widest text-[10px] font-bold pt-0.5">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 space-y-3 border-t border-gray-50">
          <button 
            onClick={onLogout}
            className="w-full py-3 text-red-500 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all hover:bg-red-50"
          >
            LOG OUT
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F9FAFB]">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-100 flex justify-between items-center px-5 py-4 z-50 pt-[calc(1rem+env(safe-area-inset-top))]">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
            <span className="text-[#C5A059] text-[9px] font-black tracking-[0.3em]">RESET</span>
            <span className="text-black font-bold text-lg tracking-tight">STUDIO</span>
          </h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={onLogout}
              className="p-2.5 rounded-full bg-red-50 text-red-500 transition-all active:scale-95 border border-red-100"
              title="Log Out"
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`p-2.5 rounded-full transition-all ${activeTab === 'ai' ? 'bg-[#C5A059] text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </button>
          </div>
        </header>

        {/* Content - Padding Bottom added for mobile nav */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 pb-28 md:pb-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>

        {/* --- MOBILE BOTTOM NAVIGATION (Connecteam Style) --- */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 pb-[calc(1.2rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 ${
                activeTab === item.id ? 'text-[#C5A059]' : 'text-gray-300'
              }`}
            >
              <div className={`${activeTab === item.id ? 'transform scale-110 transition-transform' : ''}`}>
                <item.icon />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${activeTab === item.id ? 'text-black' : 'text-gray-300'}`}>
                {item.label}
              </span>
            </button>
          ))}
          
          {/* "Menu" button for remaining items */}
          {navItems.length > 4 && (
             <button
                onClick={() => setActiveTab('manual')} 
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 ${
                  activeTab === 'manual' ? 'text-[#C5A059]' : 'text-gray-300'
                }`}
             >
                <div className={`${activeTab === 'manual' ? 'transform scale-110 transition-transform' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wide ${activeTab === 'manual' ? 'text-black' : 'text-gray-300'}`}>
                  Menu
                </span>
             </button>
          )}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
