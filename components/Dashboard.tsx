
import React, { useState, useMemo, useEffect } from 'react';
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
  user, onLogout, setActiveTab, shifts = [], supplyRequests, properties, inventoryItems, onAddSupplyRequest, timeEntries = [], onToggleClock 
}) => {
  const [showRequisition, setShowRequisition] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockTimer, setClockTimer] = useState(0);
  
  // Date Logic for Header & Filtering
  const todayDateObj = new Date();
  const tomorrowDateObj = new Date();
  tomorrowDateObj.setDate(todayDateObj.getDate() + 1);

  const todayStr = todayDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  const tomorrowStr = tomorrowDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();

  // START EMPTY - No demo feed
  const newsFeed: Announcement[] = [];

  // --- CLOCK LOGIC ---
  const myLastEntry = useMemo(() => {
    return timeEntries
      .filter(e => e.userId === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [timeEntries, user.id]);

  const isClockedIn = myLastEntry?.type === 'in';

  useEffect(() => {
    let interval: any;
    if (isClockedIn && myLastEntry) {
      const startTime = new Date(myLastEntry.timestamp).getTime();
      interval = setInterval(() => {
        setClockTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setClockTimer(0);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, myLastEntry]);

  const formatClockTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // --- SUPPLY REQUEST LOGIC (24H Cooldown) ---
  const lastRequest = useMemo(() => {
    return supplyRequests
      .filter(r => r.userId === user.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [supplyRequests, user.id]);

  const hoursSinceLastRequest = useMemo(() => {
    if (!lastRequest) return 999;
    const diffMs = Date.now() - new Date(lastRequest.date).getTime();
    return diffMs / (1000 * 60 * 60);
  }, [lastRequest]);

  const isCooldownActive = hoursSinceLastRequest < 24;

  const nextAvailableTime = useMemo(() => {
    if (!lastRequest) return null;
    const nextDate = new Date(new Date(lastRequest.date).getTime() + 24 * 60 * 60 * 1000);
    return nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [lastRequest]);

  const handleUpdateQty = (id: string, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleSubmitRequisition = () => {
    if (Object.values(selectedItems).every(v => v === 0)) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onAddSupplyRequest(selectedItems);
      setIsSubmitting(false);
      setShowRequisition(false);
      setSelectedItems({});
    }, 1000);
  };

  // Shift Filtering: Separate Today from Tomorrow
  const todayShifts = useMemo(() => 
    shifts
      .filter(s => s.date === todayStr && s.status !== 'completed' && s.userIds.includes(user.id))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts, todayStr, user.id]
  );

  const tomorrowShifts = useMemo(() => 
    shifts
      .filter(s => s.date === tomorrowStr && s.userIds.includes(user.id))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts, tomorrowStr, user.id]
  );

  const firstName = user.name ? user.name.split(' ')[0].toUpperCase() : 'MEMBER';

  const myMetrics = useMemo(() => {
    const myProcessed = shifts.filter(s => 
      s.serviceType !== 'FIX WORK' && 
      s.status === 'completed' &&
      (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected') &&
      s.userIds.includes(user.id)
    );
    const approved = myProcessed.filter(s => s.approvalStatus === 'approved').length;
    const rejected = myProcessed.filter(s => s.approvalStatus === 'rejected').length;
    const total = approved + rejected;
    let score = 5.0;
    if (total > 0) score = 1 + (approved / total) * 4;
    return { score: score.toFixed(1), approved, rejected };
  }, [shifts, user.id]);

  const isCleaner = user.role === 'cleaner' || user.role === 'supervisor';

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-700 pb-32 text-left bg-white">
      
      {/* HEADER: WELCOME & RATING (Side-by-side) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-50 pb-8">
        <div className="flex flex-col space-y-1">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px] italic opacity-90 leading-none">Command Terminal</p>
          <h1 className="text-2xl md:text-3xl font-serif-brand text-black tracking-tight uppercase leading-none font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{firstName}</span>
          </h1>
        </div>

        {isCleaner && (
          <div className="bg-[#C5A059] text-black px-5 py-3 rounded-2xl flex items-center justify-between gap-6 shadow-lg h-[60px] min-w-[180px]">
             <div className="text-left">
                <p className="text-[7px] font-black text-black/40 uppercase tracking-widest mb-0.5 leading-none">RATING</p>
                <h3 className="text-lg font-bold uppercase tracking-tight leading-none">{myMetrics.score}</h3>
             </div>
             <div className="flex items-center gap-3 border-l border-black/10 pl-4 h-full">
                <div className="flex flex-col items-center">
                  <p className="text-[6px] font-black text-black/60 uppercase leading-none">OK</p>
                  <p className="text-sm font-bold text-black leading-none mt-1">{myMetrics.approved}</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-[6px] font-black text-black/60 uppercase leading-none">NO</p>
                  <p className="text-sm font-bold text-black leading-none mt-1">{myMetrics.rejected}</p>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* QUICK CLOCK SECTION - Connecteam Style */}
      {onToggleClock && (
        <section className={`rounded-[32px] p-1 flex items-center justify-between shadow-xl transition-all border ${isClockedIn ? 'bg-green-50 border-green-200' : 'bg-[#1A1A1A] border-black'}`}>
           <div className="flex items-center gap-4 px-6 py-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isClockedIn ? 'bg-green-500 text-white animate-pulse' : 'bg-white/10 text-white'}`}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                 <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${isClockedIn ? 'text-green-700' : 'text-white/40'}`}>
                    {isClockedIn ? 'CURRENT SESSION' : 'READY TO WORK?'}
                 </p>
                 <p className={`text-xl font-mono font-bold leading-none ${isClockedIn ? 'text-green-800' : 'text-white'}`}>
                    {isClockedIn ? formatClockTime(clockTimer) : '00:00:00'}
                 </p>
              </div>
           </div>
           <button 
             onClick={onToggleClock}
             className={`h-16 px-8 rounded-[28px] text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isClockedIn ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#C5A059] text-black hover:bg-[#E2C994]'}`}
           >
             {isClockedIn ? 'END SHIFT' : 'START SHIFT'}
           </button>
        </section>
      )}

      {/* TOP SECTION: KNOWLEDGE BASE & SUPPLIES (Equal sizing) */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setActiveTab('tutorials')} className="bg-white border border-gray-100 p-5 rounded-2xl text-left group hover:border-[#C5A059]/50 transition-all shadow-md flex items-center justify-between h-[64px]">
           <div className="min-w-0">
              <p className="text-[7px] font-black text-[#C5A059] uppercase tracking-[0.3em] leading-none mb-1.5">LEARNING</p>
              <h3 className="text-[10px] md:text-xs font-serif-brand text-black font-bold uppercase leading-none truncate">KNOWLEDGE BASE</h3>
           </div>
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#C5A059] group-hover:translate-x-1 transition-transform shrink-0 ml-2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button onClick={() => setShowRequisition(true)} className={`bg-[#FDF8EE] border border-[#D4B476]/30 text-black px-5 py-3 rounded-2xl group hover:border-[#C5A059] transition-all shadow-md flex items-center gap-3 h-[64px] ${isCooldownActive ? 'opacity-70' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 flex items-center justify-center shrink-0 text-[#C5A059]">
             {isCooldownActive ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             )}
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">SUPPLIES</h3>
            <p className={`text-[6px] font-black uppercase tracking-[0.2em] mt-1 leading-none ${isCooldownActive ? 'text-red-500' : 'text-black/40'}`}>
                {isCooldownActive ? 'COOLDOWN ACTIVE' : 'REQUEST KIT'}
            </p>
          </div>
        </button>
      </div>

      {/* MIDDLE SECTION: SCHEDULED APARTMENTS */}
      <div className="space-y-8 pt-4">
        
        {/* TODAY'S SECTION */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em] whitespace-nowrap">ACTIVE SCHEDULE • {todayStr}</h2>
            <div className="h-px flex-1 bg-gray-50"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayShifts.length === 0 ? (
              <div className="py-8 border-2 border-dashed border-gray-100 rounded-[32px] text-center w-full col-span-full">
                <p className="text-[10px] text-black/10 uppercase tracking-widest font-black italic">No pending assignments for today</p>
              </div>
            ) : todayShifts.map((shift) => (
              <div key={shift.id} onClick={() => setActiveTab('shifts')} className="bg-white border border-gray-100 rounded-[32px] p-6 flex items-center justify-between cursor-pointer hover:border-[#C5A059]/20 transition-all shadow-sm group">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3 className="text-base font-serif-brand font-bold text-black uppercase tracking-tight leading-tight truncate group-hover:text-[#C5A059] transition-colors">{shift.propertyName}</h3>
                    <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-widest leading-none">{shift.startTime} • {shift.serviceType}</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 shrink-0 ml-4 group-hover:text-[#C5A059]/30 transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>

        {/* TOMORROW'S SECTION (Disabled Interaction) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-[9px] font-black text-black/20 uppercase tracking-[0.4em] whitespace-nowrap">TOMORROW'S OUTLOOK • {tomorrowStr}</h2>
            <div className="h-px flex-1 bg-gray-50"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 grayscale">
            {tomorrowShifts.length === 0 ? (
              <div className="py-8 border-2 border-dashed border-gray-100 rounded-[32px] text-center w-full col-span-full">
                <p className="text-[10px] text-black/10 uppercase tracking-widest font-black italic">No shifts scheduled for tomorrow</p>
              </div>
            ) : tomorrowShifts.map((shift) => (
              <div key={shift.id} className="bg-gray-50 border border-gray-200 rounded-[32px] p-6 flex items-center justify-between cursor-not-allowed">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3 className="text-base font-serif-brand font-bold text-black/60 uppercase tracking-tight leading-tight truncate">{shift.propertyName}</h3>
                    <p className="text-[9px] font-black text-black/30 uppercase tracking-widest leading-none">{shift.startTime} • {shift.serviceType}</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10 shrink-0 ml-4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
            ))}
          </div>
          <p className="text-[7px] font-black text-black/20 uppercase tracking-widest text-center italic">Future shifts are locked until deployment date.</p>
        </div>
      </div>

      {/* BOTTOM SECTION: BROADCAST UPDATES (< 24h old) */}
      {newsFeed.length > 0 && (
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em] whitespace-nowrap">INTELLIGENCE STREAM</h2>
            <div className="h-px flex-1 bg-gray-50"></div>
          </div>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 duration-1000">
             {newsFeed.slice(0, 3).map((item) => (
                <div key={item.id} className="bg-[#F6E6C2] text-black p-5 rounded-[32px] shadow-sm relative overflow-hidden flex flex-col gap-3 border border-[#C5A059]/20">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-white/60 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                     </div>
                     <div className="min-w-0">
                        <p className="text-[7px] font-black text-[#A68342] uppercase tracking-[0.2em] leading-none mb-1">FRESH • {item.date}</p>
                        <h3 className="text-[11px] font-bold uppercase leading-tight truncate tracking-wide">{item.title}</h3>
                     </div>
                   </div>
                   <p className="text-[9px] text-black/60 italic leading-relaxed pl-1">"{item.content}"</p>
                </div>
             ))}
          </section>
        </div>
      )}

      {showRequisition && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 overflow-y-auto">
          <div className="bg-white border border-gray-100 rounded-[48px] w-full max-w-2xl p-8 md:p-12 space-y-10 my-auto text-left shadow-[0_30px_100px_rgba(0,0,0,0.2)] relative">
            <button onClick={() => setShowRequisition(false)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors z-10"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-serif-brand font-bold text-black uppercase tracking-tight leading-none">Provisioning</h2>
              <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px] italic">Operational Replenishment Order</p>
            </div>
            
            {isCooldownActive && lastRequest && (
               <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold shrink-0">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">REQUEST COOLDOWN ACTIVE</p>
                     <p className="text-[10px] text-black/60 leading-relaxed mt-2 font-medium">
                        You last requested supplies on <span className="text-black font-bold">{new Date(lastRequest.date).toLocaleDateString()}</span> at <span className="text-black font-bold">{new Date(lastRequest.date).toLocaleTimeString()}</span>.
                     </p>
                     <p className="text-[9px] text-black/40 mt-1 uppercase tracking-wider font-bold">
                        Next available slot: {nextAvailableTime}
                     </p>
                  </div>
               </div>
            )}

            <div className={`space-y-3 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar ${isCooldownActive ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
              {inventoryItems.map(item => (
                <div key={item.id} className="p-5 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#C5A059]/20 transition-all">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <img src={item.photo} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm" alt={item.name} />
                      <div>
                        <p className="text-xs font-bold text-black uppercase tracking-wider leading-tight">{item.name}</p>
                        <p className="text-[7px] text-[#C5A059] font-black uppercase tracking-widest">{item.unit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleUpdateQty(item.id, -1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-black hover:bg-white">-</button>
                      <span className="text-sm font-mono font-bold text-[#C5A059] w-4 text-center">{selectedItems[item.id] || 0}</span>
                      <button onClick={() => handleUpdateQty(item.id, 1)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-black hover:bg-white">+</button>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-50">
                     <p className="text-[7px] font-black text-black/30 uppercase tracking-widest mb-1 italic leading-none">Protocol:</p>
                     <p className="text-[10px] text-black/60 italic leading-relaxed">{item.explanation}</p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleSubmitRequisition}
              disabled={isSubmitting || isCooldownActive || Object.values(selectedItems).every(v => v === 0)}
              className="w-full bg-black text-[#C5A059] font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[11px] md:text-sm shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isCooldownActive ? 'REQ. LIMIT REACHED' : isSubmitting ? 'TRANSMITTING...' : 'SEND REQUEST'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
