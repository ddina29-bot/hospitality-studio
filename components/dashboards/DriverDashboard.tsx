
import React, { useMemo, useState } from 'react';
import { TabType, User, Shift, Property } from '../../types';

interface DriverDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  properties: Property[];
  onResolveLogistics: (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => void;
  onUpdateKeyNote?: (shiftId: string, note: string) => void;
  onTogglePickedUp: (shiftId: string) => void;
  isLaundryAuthorized?: boolean;
  onToggleLaundryPrepared: (shiftId: string) => void;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ user, setActiveTab, onLogout, shifts = [], properties = [], onResolveLogistics, onUpdateKeyNote, onTogglePickedUp, isLaundryAuthorized = false, onToggleLaundryPrepared }) => {
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  
  const isRouteFinishedToday = useMemo(() => {
    const finishedDates = JSON.parse(localStorage.getItem(`finished_dates_${user.id}`) || '[]');
    return finishedDates.includes(todayStr);
  }, [user.id, todayStr]);

  const isRouteActive = useMemo(() => {
    return localStorage.getItem(`route_active_${user.id}`) === 'true' && !isRouteFinishedToday;
  }, [user.id, isRouteFinishedToday]);

  const handleStartResume = () => {
    if (!localStorage.getItem(`route_start_time_${user.id}`)) {
      localStorage.setItem(`route_start_time_${user.id}`, Date.now().toString());
    }
    localStorage.setItem(`route_active_${user.id}`, 'true');
    setActiveTab('logistics');
  };

  const logisticsAlerts = useMemo(() => {
    const todayLogistics = shifts.filter(s => s.date === todayStr && !s.excludeLaundry);
    const alerts: { id: string, type: 'isDelivered' | 'isCollected' | 'keysAtOffice', message: string, prop: string }[] = [];
    
    todayLogistics.forEach(s => {
      if (!s.isDelivered) alerts.push({ id: s.id, type: 'isDelivered', prop: s.propertyName || 'Unknown', message: 'Linen Delivery Pending' });
      if (!s.isCollected) alerts.push({ id: s.id, type: 'isCollected', prop: s.propertyName || 'Unknown', message: 'Laundry Collection Pending' });
      if (s.keysHandled && !s.keysAtOffice) alerts.push({ id: s.id, type: 'keysAtOffice', prop: s.propertyName || 'Unknown', message: 'Keys Missing from Office' });
    });

    return alerts;
  }, [shifts, todayStr]);

  const preparedLinensToPickUp = useMemo(() => {
    return shifts.filter(s => s.date === todayStr && s.isLaundryPrepared && !s.isLaundryPickedUp && !s.excludeLaundry);
  }, [shifts, todayStr]);

  const handleUpdateReason = (id: string, val: string) => {
    setReasons(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveNote = (id: string) => {
    if (onUpdateKeyNote && reasons[id]) {
      onUpdateKeyNote(id, reasons[id]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-32">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">LOGISTICS DEPLOYMENT</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4">
        <div className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
           <div className="space-y-1 text-center md:text-left">
              <p className="text-[10px] font-black text-[#A68342] uppercase tracking-[0.4em]">Operational Status</p>
              <h3 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">
                {isRouteFinishedToday ? 'Duty Finalized' : isRouteActive ? 'Route In Progress' : 'Standby Mode'}
              </h3>
              <p className="text-[8px] font-bold text-black/20 uppercase tracking-widest mt-1">Daily logistics workflow management</p>
           </div>
           <button 
            onClick={handleStartResume} 
            disabled={isRouteFinishedToday}
            className={`w-full md:w-64 bg-black text-[#C5A059] py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 ${isRouteFinishedToday ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:bg-zinc-900'}`}
          >
            {isRouteFinishedToday ? 'COMPLETED' : isRouteActive ? 'RESUME ROUTE' : 'START DAY'}
          </button>
        </div>
      </section>

      {preparedLinensToPickUp.length > 0 && (
        <section className="bg-[#FDF8EE] border border-green-500/20 p-8 rounded-[40px] shadow-2xl space-y-6 animate-in slide-in-from-top-2">
           <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="text-[11px] font-black text-green-700 uppercase tracking-[0.5em]">Today's Ready Apartments</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preparedLinensToPickUp.map(shift => (
                <div key={shift.id} className="bg-white p-5 rounded-3xl flex justify-between items-center border border-green-500/10 shadow-sm hover:border-green-500/30 transition-all">
                   <div className="text-left">
                      <h4 className="text-black font-bold uppercase text-sm tracking-tight leading-tight">{shift.propertyName}</h4>
                      <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mt-1">Ready for Vehicle Loading</p>
                   </div>
                   <button 
                    onClick={() => onTogglePickedUp(shift.id)}
                    className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all shadow-md hover:bg-green-700"
                   >
                     PICKED UP
                   </button>
                </div>
              ))}
           </div>
        </section>
      )}

      {logisticsAlerts.length > 0 && (
        <section className="bg-orange-600/5 border border-orange-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
              <h3 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.5em]">Logistics Exceptions</h3>
           </div>
           <div className="space-y-3">
              {logisticsAlerts.map((alert, i) => (
                <div key={i} className="bg-black/40 border border-orange-500/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 group">
                   <div className="text-left flex-1 min-w-0 w-full">
                      <p className="text-sm text-white font-bold uppercase truncate">{alert.prop}</p>
                      <p className="text-[8px] text-orange-500 font-black uppercase tracking-widest mt-1">{alert.message}</p>
                   </div>
                   
                   {alert.type === 'keysAtOffice' && (
                     <div className="w-full md:w-80 flex gap-2">
                       <input 
                         type="text" 
                         placeholder="Key Status Reason..."
                         className="flex-1 bg-black/60 border border-orange-500/20 rounded-xl px-4 py-2 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-orange-500 transition-all"
                         value={reasons[alert.id] || ''}
                         onChange={(e) => handleUpdateReason(alert.id, e.target.value)}
                       />
                       <button 
                        onClick={() => handleSaveNote(alert.id)}
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                       >
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                       </button>
                     </div>
                   )}

                   <button 
                    onClick={() => onResolveLogistics(alert.id, alert.type, reasons[alert.id])} 
                    className="w-full md:w-auto bg-orange-600 text-white px-5 py-2 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all shadow-lg"
                   >
                     RESOLVE
                   </button>
                </div>
              ))}
           </div>
        </section>
      )}
    </div>
  );
};

export default DriverDashboard;
