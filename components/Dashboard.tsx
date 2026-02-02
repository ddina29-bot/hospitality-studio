
import React from 'react';
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
  user, setActiveTab, onToggleClock, timeEntries = [], shifts = [], supplyRequests = []
}) => {
  const myEntries = timeEntries.filter(e => e.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const isClockedIn = myEntries.length > 0 && myEntries[0].type === 'in';
  
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  const myShiftsToday = shifts.filter(s => s.userIds.includes(user.id) && s.date === todayStr);
  const myPendingSupplies = supplyRequests.filter(r => r.userId === user.id && r.status === 'pending');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      
      {/* Dossier Header */}
      <header className="space-y-1">
         <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px]">Personnel Briefing</p>
         <h1 className="text-4xl font-serif-brand font-bold text-black uppercase tracking-tight">STUDIO <span className="text-[#C5A059] italic">DOSSIER</span></h1>
         <p className="text-[9px] text-black/30 font-black uppercase tracking-widest mt-1">Authorized for: {user.name.toUpperCase()} ({user.role.toUpperCase()})</p>
      </header>

      {/* Primary Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1A1A1A] p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
           <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                 <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.3em]">Duty Timer</p>
                 <div className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-white/10'}`}></div>
              </div>
              <div>
                 <p className="text-3xl font-serif-brand font-bold text-white uppercase">{isClockedIn ? 'ON DUTY' : 'STANDBY'}</p>
                 <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mt-2">Active Operational State</p>
              </div>
              <button 
                onClick={onToggleClock}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-95 shadow-xl ${
                    isClockedIn ? 'bg-red-600 text-white' : 'bg-[#C5A059] text-black hover:bg-[#D4B476]'
                }`}
              >
                {isClockedIn ? 'STOP DEPLOYMENT' : 'START DEPLOYMENT'}
              </button>
           </div>
           <div className="absolute -right-6 -bottom-6 text-white/5 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
           </div>
        </div>

        <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 shadow-xl space-y-6">
           <p className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-[0.3em]">Deployment Schedule</p>
           <div className="space-y-1">
              <p className="text-4xl font-serif-brand font-bold text-black">{myShiftsToday.length}</p>
              <p className="text-[8px] text-black/30 font-black uppercase tracking-widest mt-2">Units Assigned Today</p>
           </div>
           <button onClick={() => setActiveTab('shifts')} className="w-full py-4 bg-white border border-[#D4B476]/40 rounded-2xl text-[9px] font-black uppercase tracking-widest text-[#8B6B2E] hover:bg-white/50 transition-all">VIEW WORKLIST</button>
        </div>

        <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 shadow-xl space-y-6">
           <p className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-[0.3em]">Supply Inventory</p>
           <div className="space-y-1">
              <p className="text-4xl font-serif-brand font-bold text-black">{myPendingSupplies.length}</p>
              <p className="text-[8px] text-black/30 font-black uppercase tracking-widest mt-2">Pending Requisitions</p>
           </div>
           <button onClick={() => setActiveTab('shifts')} className="w-full py-4 bg-white border border-[#D4B476]/40 rounded-2xl text-[9px] font-black uppercase tracking-widest text-[#8B6B2E] hover:bg-white/50 transition-all">REORDER KIT</button>
        </div>
      </section>

      {/* Lower Briefing Section */}
      <section className="bg-white border border-black/5 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
            <div className="space-y-4">
               <h3 className="text-xl font-serif-brand font-bold uppercase text-black tracking-tight">Studio Announcements</h3>
               <div className="flex items-center gap-4 p-5 bg-[#FDF8EE] border border-[#D4B476]/20 rounded-[32px]">
                  <div className="w-10 h-10 rounded-full bg-[#C5A059] flex items-center justify-center text-black shadow-lg">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-black tracking-widest">System Update Available</p>
                    <p className="text-[9px] text-black/40 font-bold mt-1">Please ensure GPS permissions are enabled for field ops.</p>
                  </div>
               </div>
            </div>
            <div className="text-right">
               <p className="text-[7px] font-black text-black/10 uppercase tracking-[0.5em] mb-4">Telemetry Synchronized</p>
               <button onClick={() => setActiveTab('ai')} className="bg-black text-[#C5A059] px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">QUERY STUDIO AI</button>
            </div>
         </div>
         <div className="absolute bottom-0 right-0 p-12 opacity-[0.02] pointer-events-none">
            <h1 className="font-serif-brand text-[200px] leading-none text-black">S</h1>
         </div>
      </section>

    </div>
  );
};

export default Dashboard;
