
import React, { useMemo, useState } from 'react';
import { User, TabType, Shift, Client, Invoice, TimeEntry } from '../types';

interface DashboardProps {
  user: User;
  users?: User[];
  setActiveTab: (tab: TabType) => void;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  clients?: Client[];
  invoices?: Invoice[];
  timeEntries?: TimeEntry[];
  onInjectDemo?: () => void;
  onLogisticsAlertClick?: (userId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, users = [], setActiveTab, shifts = [], setShifts, invoices = [], timeEntries = [], onInjectDemo, onLogisticsAlertClick 
}) => {
  const [approvingShiftId, setApprovingShiftId] = useState<string | null>(null);
  const [extraTimeVal, setExtraTimeVal] = useState('1.0');

  const isAdmin = user.role === 'admin';
  const isHousekeeping = user.role === 'housekeeping';
  const isSupervisorRole = user.role === 'supervisor';
  const isDriverRole = user.role === 'driver';
  const isCleanerRole = user.role === 'cleaner';
  const isManager = isAdmin || isHousekeeping;

  const handleDecision = (shiftId: string, status: 'approved' | 'rejected') => {
    if (!setShifts) return;
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId && s.messReport) {
        const note = status === 'approved' 
          ? `Authorized +${extraTimeVal}h extra time.` 
          : 'Extra time request declined.';
        return { 
          ...s, 
          messReport: { ...s.messReport, status, decisionNote: note } 
        };
      }
      return s;
    }));
    setApprovingShiftId(null);
  };

  const personnelStats = useMemo(() => {
    if (isManager && !isSupervisorRole) return null; 
    
    const todayISO = new Date().toISOString().split('T')[0];
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    
    const todayEntries = (timeEntries || []).filter(e => e.userId === user.id && e.timestamp.startsWith(todayISO));
    let todayMs = 0;
    for (let i = 0; i < todayEntries.length; i += 2) {
      const start = new Date(todayEntries[i]?.timestamp).getTime();
      const end = todayEntries[i+1] ? new Date(todayEntries[i+1].timestamp).getTime() : Date.now();
      if (todayEntries[i]?.type === 'in') todayMs += (end - start);
    }

    const todayShifts = (shifts || []).filter(s => s.date === todayStr && s.userIds.includes(user.id));

    return {
      hoursToday: (todayMs / 3600000).toFixed(1),
      countToday: todayShifts.length,
      isCurrentlyClockedIn: todayEntries.length > 0 && todayEntries[todayEntries.length - 1].type === 'in'
    };
  }, [isManager, isSupervisorRole, timeEntries, shifts, user.id]);

  if (isDriverRole && personnelStats) {
    return (
      <div className="space-y-10 text-left animate-in fade-in duration-500 pb-32">
        <header>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none uppercase">Driver Hub</h2>
          <p className="text-[9px] text-teal-600 font-bold uppercase tracking-[0.4em] mt-2">FLEET OPERATIONS • {user.name.toUpperCase()}</p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-teal-100 p-8 flex flex-col justify-between min-h-[140px] shadow-sm rounded-[2rem]">
             <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Hours Today</p>
             <div>
                <p className="text-3xl font-bold text-slate-900">{personnelStats.hoursToday}h</p>
                <p className="text-[10px] font-medium text-teal-500/60 uppercase mt-1">Clock Session</p>
             </div>
          </div>
          <div className="bg-white border border-teal-100 p-8 flex flex-col justify-between min-h-[140px] shadow-sm rounded-[2rem]">
             <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Stops Today</p>
             <div>
                <p className="text-3xl font-bold text-slate-900">{personnelStats.countToday}</p>
                <p className="text-[10px] font-medium text-teal-500/60 uppercase mt-1">Route Points</p>
             </div>
          </div>
        </div>

        <section className="bg-teal-600 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl font-bold tracking-tight uppercase leading-none">Ready for Deployment?</h3>
              <p className="text-teal-50/70 text-sm font-medium">Access your interactive route to start delivering linens and keys.</p>
           </div>
           <button 
            onClick={() => setActiveTab('logistics')}
            className="w-full md:w-auto bg-white text-teal-600 font-black px-12 py-5 rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all"
           >
              Open Active Route
           </button>
        </section>
      </div>
    );
  }

  if (isCleanerRole && personnelStats) {
    return (
      <div className="space-y-6 text-left animate-in fade-in duration-500 pb-32 max-w-2xl mx-auto px-1">
        <header className="px-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">Studio Dashboard</h2>
          <p className="text-[9px] text-[#0D9488] font-black uppercase tracking-[0.3em] mt-2">Personnel: {user.name.toUpperCase()}</p>
        </header>

        <section className="bg-[#0D9488] p-5 rounded-[2rem] text-white shadow-lg space-y-4">
           <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight uppercase leading-none">Your Assignments</h3>
              <p className="text-teal-50/80 text-[11px] font-medium">You have <span className="font-black text-white">{personnelStats.countToday}</span> deployments scheduled for today.</p>
           </div>
           <button 
            onClick={() => setActiveTab('shifts')}
            className="w-full bg-white text-[#0D9488] font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-md active:scale-95 transition-all"
           >
              Start Today's Work
           </button>
        </section>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white border border-teal-50 p-5 rounded-[1.5rem] shadow-sm">
              <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mb-1.5">Hours Today</p>
              <p className="text-sm font-bold text-slate-900 uppercase">{personnelStats.hoursToday}h</p>
           </div>
           <div className={`bg-white border p-5 rounded-[1.5rem] shadow-sm ${personnelStats.isCurrentlyClockedIn ? 'border-teal-200' : 'border-teal-50'}`}>
              <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mb-1.5">Session Status</p>
              <p className={`text-sm font-bold uppercase ${personnelStats.isCurrentlyClockedIn ? 'text-teal-600' : 'text-slate-400'}`}>
                {personnelStats.isCurrentlyClockedIn ? 'Clocked In' : 'Off-duty'}
              </p>
           </div>
        </div>
      </div>
    );
  }

  if (isSupervisorRole && personnelStats) {
    return (
      <div className="space-y-8 text-left animate-in fade-in duration-500 pb-32 max-w-3xl mx-auto px-2">
        <header className="px-1">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none uppercase">Supervisor Hub</h2>
          <p className="text-[9px] text-[#0D9488] font-black uppercase tracking-[0.4em] mt-2">Personnel: {user.name.toUpperCase()}</p>
        </header>

        <section className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-6">
           <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight uppercase leading-none">Field Deployment</h3>
              <p className="text-slate-400 text-xs font-medium">You have <span className="font-bold text-teal-400">{personnelStats.countToday}</span> cleaning or inspection tasks for today.</p>
           </div>
           <button 
            onClick={() => setActiveTab('shifts')}
            className="w-full bg-teal-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all"
           >
              Open My Task List
           </button>
        </section>

        <div className="grid grid-cols-2 gap-6">
           <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm">
              <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-2">Hours Today</p>
              <p className="text-3xl font-bold text-slate-900 leading-none">{personnelStats.hoursToday}h</p>
           </div>
           <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm text-center flex flex-col items-center justify-center">
              <span className="text-2xl mb-1">📋</span>
              <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Active Status</p>
              <p className="text-xs font-bold text-slate-900 uppercase">On Duty</p>
           </div>
        </div>

        <div className="pt-4">
          <button 
            onClick={() => setActiveTab('tutorials')}
            className="w-full bg-slate-50 border border-slate-200 text-slate-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-[9px] hover:bg-white transition-all shadow-sm"
          >
            Review Operational SOPs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 text-left animate-in fade-in duration-700 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none uppercase">Dashboard</h2>
          <p className="text-[9px] text-[#0D9488] font-bold uppercase tracking-[0.4em] mt-2">Personnel: {user.name.toUpperCase()} • Protocol: {user.role.toUpperCase()}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {onInjectDemo && isAdmin && (
             <button onClick={onInjectDemo} className="flex-1 md:flex-none px-6 py-3 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all">Mock Data</button>
          )}
          {isAdmin && (
            <button className="flex-1 md:flex-none px-8 py-3 btn-teal text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/10">Initialize Session</button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Ops', value: (shifts || []).filter(s => s.status === 'active').length, detail: 'Personnel Onsite', visible: true },
          { label: 'Quality Audit', value: (shifts || []).filter(s => s.status === 'completed' && s.approvalStatus === 'pending').length, detail: 'Awaiting Sign-off', visible: true },
          { label: 'Ledger Balance', value: `€${(invoices || []).filter(i => i.status === 'sent').length * 150}`, detail: 'Pending Collection', visible: isAdmin },
          { label: 'Assets Ready', value: (shifts || []).filter(s => s.status === 'completed').length, detail: 'Protocol Finalized', visible: true }
        ].filter(m => m.visible).map((m, i) => (
          <div key={i} className="soft-card p-8 flex flex-col justify-between min-h-[140px] bg-white/50">
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{m.label}</p>
            <div>
               <p className="text-3xl font-bold text-slate-900 leading-none">{m.value}</p>
               <p className="text-[10px] font-medium text-teal-500/60 uppercase mt-1.5">{m.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
           <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-800">Deployment Feed</h3>
              <button onClick={() => setActiveTab('shifts')} className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest hover:underline">View History</button>
           </div>
           <div className="flex-1 p-6 space-y-3">
              {shifts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-20 grayscale">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Active Records</p>
                </div>
              ) : (
                shifts.slice(0, 15).map(s => {
                  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
                  const todayISO = new Date().toISOString().split('T')[0];

                  const assignedDriverId = s.userIds.find(id => users.find(u => u.id === id)?.role === 'driver');
                  const driverEntries = (timeEntries || [])
                    .filter(e => e.userId === assignedDriverId && e.timestamp.startsWith(todayISO))
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const isDriverFinished = driverEntries.length > 0 && driverEntries[0].type === 'out';

                  const isPendingLogistics = isManager && 
                                            s.date === todayStr && 
                                            s.isPublished && 
                                            !s.excludeLaundry && 
                                            (!s.isDelivered || !s.isCollected) &&
                                            isDriverFinished;

                  const isPendingMess = isManager && s.messReport && s.messReport.status === 'pending';
                  const isApprovedMess = s.messReport && s.messReport.status === 'approved';
                  const isRejectedMess = s.messReport && s.messReport.status === 'rejected';

                  const alertClass = isPendingMess ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-100 shadow-md' : 
                                    isPendingLogistics ? 'bg-red-50/50 border-red-200 ring-2 ring-red-100 shadow-sm' : 
                                    'bg-teal-50/30 border-teal-50 hover:bg-teal-50 hover:border-teal-100';

                  return (
                    <div key={s.id} className={`p-5 rounded-2xl border flex flex-col transition-all cursor-pointer ${alertClass}`}>
                       <div className="flex justify-between items-center">
                          <div className="min-w-0">
                             <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">{s.propertyName}</p>
                                {isPendingLogistics && <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">⚠️ Logistics Alert</span>}
                                {isPendingMess && <span className="bg-amber-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">⚠️ Extra Time Req</span>}
                                {isApprovedMess && <span className="bg-green-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">✅ Extra Time Approved</span>}
                                {isRejectedMess && <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">❌ Extra Time Rejected</span>}
                             </div>
                             <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{s.serviceType}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{s.startTime}</span>
                             </div>
                          </div>
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            s.status === 'active' ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
                          }`}>{s.status}</div>
                       </div>

                       {isPendingLogistics && (
                         <div className="mt-3 pt-3 border-t border-red-100 space-y-1.5">
                            <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">Incomplete Post-Shift Logistics:</p>
                            <div className="flex gap-2">
                               {!s.isDelivered && <span className="text-[9px] font-bold text-red-500 bg-white px-2 py-0.5 rounded border border-red-100 uppercase">• Delivery Fail</span>}
                               {!s.isCollected && <span className="text-[9px] font-bold text-red-500 bg-white px-2 py-0.5 rounded border border-red-100 uppercase">• Collection Fail</span>}
                            </div>
                            <button 
                               onClick={() => onLogisticsAlertClick?.(s.userIds.find(uid => users.find(u => u.id === uid)?.role === 'driver') || s.userIds[0])}
                               className="mt-2 text-[8px] font-black text-red-700 underline uppercase tracking-widest hover:text-red-900"
                            >
                               View Failed Route Details →
                            </button>
                         </div>
                       )}

                       {isPendingMess && (
                         <div className="mt-4 pt-4 border-t border-amber-200/50 space-y-3 animate-in slide-in-from-top-2">
                            <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                               <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Cleaner Request Reason:</p>
                               <p className="text-[11px] text-slate-600 italic font-medium leading-relaxed">"{s.messReport?.description}"</p>
                            </div>
                            <div className="flex gap-2">
                               {approvingShiftId === s.id ? (
                                 <div className="flex-1 flex gap-2 animate-in slide-in-from-right-2">
                                    <div className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 flex items-center gap-2">
                                       <span className="text-[9px] font-black text-amber-600">ADD HOURS:</span>
                                       <input 
                                          autoFocus
                                          type="number" 
                                          step="0.5" 
                                          className="w-12 bg-amber-50 text-[11px] font-bold text-black outline-none border-none rounded px-1"
                                          value={extraTimeVal}
                                          onChange={e => setExtraTimeVal(e.target.value)}
                                       />
                                    </div>
                                    <button 
                                      onClick={() => handleDecision(s.id, 'approved')}
                                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95"
                                    >
                                      CONFIRM
                                    </button>
                                    <button 
                                      onClick={() => setApprovingShiftId(null)}
                                      className="bg-slate-100 text-slate-400 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
                                    >
                                      ×
                                    </button>
                                 </div>
                               ) : (
                                 <>
                                    <button 
                                      onClick={() => { setApprovingShiftId(s.id); setExtraTimeVal('1.0'); }}
                                      className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 hover:bg-amber-700 transition-all"
                                    >
                                      APPROVE EXTRA TIME
                                    </button>
                                    <button 
                                      onClick={() => handleDecision(s.id, 'rejected')}
                                      className="px-6 bg-white border border-red-200 text-red-500 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                                    >
                                      REJECT
                                    </button>
                                 </>
                               )}
                            </div>
                         </div>
                       )}
                    </div>
                  );
                })
              )}
           </div>
        </section>

        <div className="space-y-6">
           <section className="bg-[#0D9488] p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between text-white min-h-[220px]">
              <div className="relative z-10">
                 <p className="text-[10px] font-bold text-teal-100 uppercase tracking-[0.4em]">Studio Registry</p>
                 <h3 className="text-2xl font-bold tracking-tight mt-3 uppercase leading-none">Team Hub</h3>
                 <p className="text-xs text-teal-50 mt-4 leading-relaxed opacity-80 font-medium">Manage personnel records and contracts.</p>
              </div>
              <button onClick={() => setActiveTab('users')} className="w-full py-4 bg-white text-[#0D9488] rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Open Staff Hub</button>
           </section>

           <div className="grid grid-cols-2 gap-4">
              <div onClick={() => setActiveTab('properties')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 cursor-pointer hover:bg-teal-50 hover:border-teal-400 transition-all flex flex-col items-center gap-4 group shadow-sm">
                 <span className="text-3xl">🏠</span>
                 <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Portfolio</p>
              </div>
              {isAdmin && (
                <div onClick={() => setActiveTab('finance')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 cursor-pointer hover:bg-teal-50 hover:border-teal-400 transition-all flex flex-col items-center gap-4 group shadow-sm">
                  <span className="text-3xl">💳</span>
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ledger</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
