
import React, { useMemo } from 'react';
import { TabType, User, TimeEntry, Shift, SupplyRequest, Property, SupplyItem } from '../types';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  setActiveTab: (tab: TabType) => void;
  timeEntries?: TimeEntry[];
  onToggleClock?: () => void;
  shifts?: Shift[];
  supplyRequests?: SupplyRequest[];
  properties?: Property[];
  inventoryItems?: SupplyItem[];
  onAddSupplyRequest?: (items: Record<string, number>) => void;
  onUpdateSupplyStatus?: (id: string, status: 'pending' | 'approved' | 'delivered') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, setActiveTab, onToggleClock, timeEntries = []
}) => {
  const isClockedIn = useMemo(() => {
    const myEntries = timeEntries.filter(e => e.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return myEntries.length > 0 && myEntries[0].type === 'in';
  }, [timeEntries, user.id]);

  const firstName = user.name ? user.name.split(' ')[0] : 'Member';

  const actions = [
    { id: 'shifts', label: 'Job Schedule', color: 'bg-blue-50', iconColor: 'text-blue-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    )},
    { id: 'logistics', label: 'My Assets', color: 'bg-green-50', iconColor: 'text-green-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
    )},
    { id: 'tutorials', label: 'Guidelines', color: 'bg-purple-50', iconColor: 'text-purple-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
    )},
    { id: 'ai', label: 'Assistant', color: 'bg-orange-50', iconColor: 'text-orange-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    )},
  ].filter(a => {
      if (a.id === 'logistics' && !['driver', 'admin', 'housekeeping'].includes(user.role)) return false;
      return true;
  });

  return (
    <div className="space-y-6 app-screen-transition">
      
      {/* WELCOME SECTION */}
      <section className="mb-2">
         <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Hey {firstName},</h2>
         <p className="text-gray-500 font-medium">Ready for your shift today?</p>
      </section>

      {/* TIME CLOCK CARD */}
      <section className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>
        <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {isClockedIn ? 'On the clock' : 'Current Status'}
              </span>
           </div>
           <p className="text-xs font-bold text-gray-900">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
           </p>
        </div>
        
        <div className="flex flex-col items-center justify-center py-4">
            <button 
                onClick={onToggleClock}
                className={`w-36 h-36 rounded-full border-[6px] flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 hover:scale-105 ${
                    isClockedIn 
                    ? 'bg-red-500 border-red-100 text-white' 
                    : 'bg-[#007AFF] border-blue-100 text-white' 
                }`}
            >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mb-1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="font-black text-sm uppercase tracking-widest">
                    {isClockedIn ? 'Stop' : 'Start'}
                </span>
            </button>
            <p className="text-xs text-gray-400 font-semibold mt-6">
                {isClockedIn ? 'Shift duration is recording...' : 'Tap to start your daily shift'}
            </p>
        </div>
      </section>

      {/* QUICK ACTIONS GRID */}
      <section>
        <h3 className="text-sm font-bold text-gray-900 mb-3 ml-1">Tools & Links</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {actions.map(action => (
            <button 
                key={action.id}
                onClick={() => setActiveTab(action.id as TabType)}
                className="flex flex-col items-center justify-center p-5 bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
                <div className={`w-14 h-14 rounded-2xl ${action.color} ${action.iconColor} flex items-center justify-center mb-3 shadow-sm`}>
                {action.icon}
                </div>
                <span className="text-xs font-bold text-gray-700 text-center">{action.label}</span>
            </button>
            ))}
        </div>
      </section>

      {/* UPDATES SECTION */}
      <section className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Announcements</h3>
            <button className="text-[10px] font-bold text-[#007AFF] uppercase tracking-widest">View all</button>
         </div>
         <div className="flex items-center gap-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div>
               <p className="text-xs font-bold text-gray-900">Welcome to the new Studio App!</p>
               <p className="text-[10px] text-gray-500 font-medium mt-0.5">Please check your schedule for tomorrow.</p>
            </div>
         </div>
      </section>

    </div>
  );
};

export default Dashboard;
