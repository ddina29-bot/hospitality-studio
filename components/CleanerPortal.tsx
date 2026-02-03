import React, { useState, useMemo } from 'react';
import { Property, CleaningTask, Shift, User, AttributedPhoto, SupplyItem } from '../types';

interface CleanerPortalProps {
  user: User;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties: Property[];
  users: User[];
  // Added missing props to resolve TypeScript error in App.tsx
  inventoryItems: SupplyItem[];
  onAddSupplyRequest: (batch: Record<string, number>) => void;
  onUpdateUser: (updatedUser: User) => void;
}

const CleanerPortal: React.FC<CleanerPortalProps> = ({ 
  user, 
  shifts, 
  setShifts, 
  properties, 
  users, 
  inventoryItems, 
  onAddSupplyRequest, 
  onUpdateUser 
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const currentlyActiveShift = useMemo(() => shifts.find(s => s.status === 'active' && s.userIds.includes(user.id)), [shifts, user.id]);

  const handleForceReset = () => {
    if (!currentlyActiveShift) return;
    if (!window.confirm("RESET STUCK SESSION?\n\nThis will force-close your current clock. Use this only if the app is frozen or you forgot to check out.")) return;
    setShifts(prev => prev.map(s => s.id === currentlyActiveShift.id ? { ...s, status: 'completed', actualEndTime: Date.now(), approvalStatus: 'pending', approvalComment: 'USER EMERGENCY RESET' } : s));
    alert("Session Reset. You can now start new tasks.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto px-1 text-left">
       <header className="space-y-1 px-1">
          <p className="text-teal-600 font-black uppercase tracking-[0.4em] text-[8px]">Deployment Terminal</p>
          <h2 className="text-2xl font-bold uppercase text-slate-900 tracking-tighter">Welcome, {user.name.split(' ')[0]}</h2>
       </header>

       {currentlyActiveShift && (
          <div className="bg-rose-50 border border-rose-200 p-8 rounded-[40px] space-y-6 shadow-xl animate-in slide-in-from-bottom-4">
             <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-900 uppercase">Active Session: {currentlyActiveShift.propertyName}</h3>
                <p className="text-[10px] text-rose-600 font-medium">You must check out of this property before starting any other tasks.</p>
             </div>
             <div className="flex gap-3">
                <button className="flex-1 bg-rose-600 text-white py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl">Back to Property</button>
                <button onClick={handleForceReset} className="bg-white border border-rose-200 text-rose-600 px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">Reset Stuck App</button>
             </div>
          </div>
       )}

       <div className="space-y-3">
          {shifts.filter(s => s.isPublished && s.userIds.includes(user.id)).map(s => (
             <div key={s.id} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center group transition-all hover:border-teal-500">
                <div className="text-left">
                   <h4 className="text-sm font-bold uppercase text-slate-900">{s.propertyName}</h4>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.startTime} • {s.serviceType}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                   {s.status === 'completed' ? '✓' : '→'}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export default CleanerPortal;