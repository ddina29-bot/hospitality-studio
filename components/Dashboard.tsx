import React, { useState, useMemo } from 'react';
import { TabType, SupplyItem, Shift, SupplyRequest, Property, User, Announcement, TimeEntry } from '../types';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  setActiveTab: (tab: TabType) => void;
  shifts?: Shift[];
  supplyRequests: SupplyRequest[];
  properties: Property[];
  inventoryItems: SupplyItem[];
  onAddSupplyRequest: (item: Record<string, number>) => void;
  onUpdateSupplyStatus: (id: string, status: 'pending' | 'approved' | 'delivered') => void;
  timeEntries?: TimeEntry[];
  onToggleClock?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, setActiveTab, shifts = [], properties, onToggleClock 
}) => {
  // Derive clock status from user data or prop
  const isClockedIn = false; // Mock for initial Connecteam feel refinement

  const firstName = user.name ? user.name.split(' ')[0] : 'Member';

  // Quick Action Tiles
  const actions = [
    { id: 'shifts', label: 'Job Schedule', color: 'bg-blue-500', icon: '📅' },
    { id: 'logistics', label: 'My Route', color: 'bg-green-500', icon: '🚚' },
    { id: 'tutorials', label: 'Academy / SOPs', color: 'bg-purple-500', icon: '📚' },
    { id: 'ai', label: 'Studio AI', color: 'bg-[#C5A059]', icon: '🤖' },
  ].filter(a => {
      // Basic role filtering for tiles
      if (a.id === 'logistics' && !['driver', 'admin'].includes(user.role)) return false;
      return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* GREETING & CLOCK */}
      <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
           <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Good day, {firstName}!</h2>
           <p className="text-gray-500 text-sm mt-1">Ready for your shift? Clock in to begin.</p>
        </div>
        <button 
            onClick={onToggleClock}
            className={`w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 ${
                isClockedIn ? 'bg-red-500 text-white shadow-red-200' : 'bg-black text-white shadow-gray-200'
            }`}
        >
            {isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}
        </button>
      </section>

      {/* QUICK ACTIONS GRID (Connecteam Style) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map(action => (
          <button 
            key={action.id}
            onClick={() => setActiveTab(action.id as TabType)}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md hover:border-[#C5A059]/30 transition-all group"
          >
            <div className={`w-14 h-14 rounded-2xl ${action.color} flex items-center justify-center text-2xl shadow-inner mb-4 group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <span className="text-xs font-bold text-gray-700 text-center uppercase tracking-wider">{action.label}</span>
          </button>
        ))}
      </section>

      {/* NOTICE BOARD & TASKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Notice Board</h3>
                <button className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">View All</button>
            </div>
            <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm text-center py-20">
               <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
               </div>
               <p className="text-sm text-gray-400 font-medium">No active announcements for today.</p>
            </div>
         </div>

         <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Today's Jobs</h3>
            </div>
            <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm min-h-[300px]">
               <div className="flex flex-col items-center justify-center h-full py-10 opacity-30 text-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <p className="text-xs font-bold uppercase mt-4">Empty Schedule</p>
               </div>
            </div>
         </div>

      </div>

    </div>
  );
};

export default Dashboard;