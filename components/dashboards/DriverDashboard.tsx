
import React, { useMemo } from 'react';
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

const DriverDashboard: React.FC<DriverDashboardProps> = ({ 
  user, setActiveTab, onLogout, shifts = [], properties = [], 
  onResolveLogistics, onUpdateKeyNote, onTogglePickedUp, 
  isLaundryAuthorized = false, onToggleLaundryPrepared 
}) => {
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">Delivery Terminal</p>
          <h1 className="text-xl font-serif-brand font-bold text-black uppercase tracking-tight">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab('logistics')}
            className="bg-black text-[#C5A059] font-black px-6 py-2.5 rounded-xl text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
          >
            OPEN DELIVERIES
          </button>
          <button onClick={onLogout} className="bg-red-50 text-red-600 font-black px-4 py-2.5 rounded-xl text-[9px] uppercase tracking-widest border border-red-100">
            LOG OUT
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-teal-50 border border-teal-100 p-8 rounded-[40px] shadow-xl">
           <h3 className="text-xs font-serif-brand font-bold uppercase tracking-widest mb-6">Daily Route • {todayStr}</h3>
           <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center space-y-4">
              <span className="text-4xl">🚚</span>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Fleet Deployment Active</p>
           </div>
        </section>

        <section className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-xl">
           <h3 className="text-xs font-serif-brand font-bold uppercase tracking-widest mb-6">Operational Intelligence</h3>
           <div className="space-y-4 opacity-20 grayscale">
              <div className="h-4 bg-gray-100 rounded-full w-3/4"></div>
              <div className="h-4 bg-gray-100 rounded-full w-full"></div>
              <div className="h-4 bg-gray-100 rounded-full w-1/2"></div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default DriverDashboard;
