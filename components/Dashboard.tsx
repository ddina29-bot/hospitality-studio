import React, { useMemo } from 'react';
import { TabType, User, TimeEntry, Shift, SupplyRequest, Property, SupplyItem } from '../types';

// Updated interface to include props passed from App.tsx
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
  // Derive clock status from time entries
  const isClockedIn = useMemo(() => {
    const myEntries = timeEntries.filter(e => e.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return myEntries.length > 0 && myEntries[0].type === 'in';
  }, [timeEntries, user.id]);

  const firstName = user.name ? user.name.split(' ')[0] : 'Member';

  // Connecteam-style Quick Actions
  const actions = [
    { id: 'shifts', label: 'Job Schedule', color: 'bg-[#E3F2FD]', iconColor: 'text-blue-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    )},
    { id: 'logistics', label: 'Logistics', color: 'bg-[#E8F5E9]', iconColor: 'text-green-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
    )},
    { id: 'tutorials', label: 'Knowledge Base', color: 'bg-[#F3E5F5]', iconColor: 'text-purple-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
    )},
    { id: 'ai', label: 'Studio AI', color: 'bg-[#FFF8E1]', iconColor: 'text-amber-600', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M12 12a4 4 0 0 1 4 4v4H8v-4a4 4 0 0 1 4-4z"/><circle cx="12" cy="12" r="10"/></svg>
    )},
  ].filter(a => {
      if (a.id === 'logistics' && !['driver', 'admin', 'housekeeping'].includes(user.role)) return false;
      return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* TIME CLOCK CARD (Connecteam Style - Prominent) */}
      <section className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-200">
        <div className="flex justify-between items-start mb-4">
           <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Good day, {firstName}</h2>
              <p className="text-gray-500 text-xs font-medium mt-1">
                 {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
           </div>
           <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isClockedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isClockedIn ? 'On Shift' : 'Off Duty'}
           </div>
        </div>
        
        <div className="flex flex-col items-center justify-center py-4">
            <button 
                onClick={onToggleClock}
                className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-lg transition-all active:scale-95 ${
                    isClockedIn 
                    ? 'bg-red-500 border-red-200 shadow-red-200' 
                    : 'bg-[#007AFF] border-blue-200 shadow-blue-200' 
                }`}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="mb-1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-white font-bold text-xs uppercase tracking-widest">
                    {isClockedIn ? 'Clock Out' : 'Clock In'}
                </span>
            </button>
            <p className="text-xs text-gray-400 font-medium mt-4">
                {isClockedIn ? 'Time is running...' : 'Tap to start your shift'}
            </p>
        </div>
      </section>

      {/* QUICK ACTIONS GRID (Connecteam Style) */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {actions.map(action => (
            <button 
                key={action.id}
                onClick={() => setActiveTab(action.id as TabType)}
                className="flex flex-col items-center justify-center p-5 bg-white rounded-[24px] shadow-sm border border-gray-200 hover:shadow-md transition-all active:scale-95"
            >
                <div className={`w-12 h-12 rounded-2xl ${action.color} ${action.iconColor} flex items-center justify-center mb-3`}>
                {action.icon}
                </div>
                <span className="text-xs font-bold text-gray-700 text-center">{action.label}</span>
            </button>
            ))}
        </div>
      </section>

      {/* COMMUNICATIONS / UPDATES CARD */}
      <section className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-200">
         <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#C5A059]/10 rounded-xl text-[#C5A059]">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-sm font-bold text-gray-900">Updates</h3>
         </div>
         <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 font-medium">No new announcements today.</p>
         </div>
      </section>

    </div>
  );
};

export default Dashboard;