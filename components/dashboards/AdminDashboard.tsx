
import React, { useState, useMemo } from 'react';
import { TabType, Shift, User, SupplyRequest, SpecialReport } from '../../types';

interface AdminDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  users?: User[];
  supplyRequests?: SupplyRequest[];
  setSupplyRequests?: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  onAuditDeepLink?: (shiftId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  setActiveTab, shifts = [], setShifts, users = [], supplyRequests = [], setSupplyRequests, onAuditDeepLink
}) => {
  const [viewingIncidentShift, setViewingIncidentShift] = useState<Shift | null>(null);

  const reviewQueue = useMemo(() => (shifts ?? []).filter(s => s?.status === 'completed' && s?.approvalStatus === 'pending'), [shifts]);
  const messQueue = useMemo(() => (shifts ?? []).filter(s => s?.messReport && s?.messReport?.status === 'pending'), [shifts]);
  const activeOps = useMemo(() => (shifts ?? []).filter(s => s?.status === 'active'), [shifts]);
  
  const pendingSupplies = useMemo(() => (supplyRequests ?? []).filter(r => r?.status === 'pending'), [supplyRequests]);
  const groupedSupplies = useMemo(() => {
    return pendingSupplies.reduce((acc, r) => {
      if (!acc[r.userId]) acc[r.userId] = [];
      acc[r.userId].push(r);
      return acc;
    }, {} as Record<string, SupplyRequest[]>);
  }, [pendingSupplies]);

  const handleApproveSupplies = (batch: SupplyRequest[]) => {
    if (!setSupplyRequests || !setShifts || !batch.length) return;
    
    const ids = batch.map(r => r.id);
    setSupplyRequests(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'approved' } : r));
    
    const deliveryDate = new Date();
    if (new Date().getHours() >= 11) deliveryDate.setDate(deliveryDate.getDate() + 1);
    const dateStr = deliveryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    
    const cleanerName = batch[0].userName ?? 'Operator';
    const itemsList = batch.map(b => `${b.quantity}x ${b.itemName}`).join(', ');
    
    const newShift: Shift = {
        id: `sd-${Date.now()}-${batch[0].userId}`,
        propertyId: 'supply-drop',
        propertyName: `SUPPLY DROP: ${cleanerName.toUpperCase()}`,
        userIds: [], 
        date: dateStr,
        startTime: '08:00 AM',
        endTime: '06:00 PM',
        serviceType: 'SUPPLY DELIVERY',
        status: 'pending',
        approvalStatus: 'pending',
        isPublished: true,
        notes: `DELIVERY FOR ${cleanerName}: ${itemsList}`
    };
    
    setShifts(prev => [newShift, ...prev]);
  };

  const shiftsWithIncidents = useMemo(() => {
    return (shifts ?? []).filter(s => {
      const hasMaintenance = s?.maintenanceReports?.some(r => r.status !== 'resolved');
      const hasDamage = s?.damageReports?.some(r => r.status !== 'resolved');
      const hasMissing = s?.missingReports?.some(r => r.status !== 'resolved');
      return hasMaintenance || hasDamage || hasMissing;
    });
  }, [shifts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24 w-full overflow-x-hidden">
      <header className="px-2 mb-2">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Studio Hub</h2>
        <p className="text-[11px] text-teal-600 font-black uppercase tracking-[0.4em] mt-3">OPERATIONAL INTELLIGENCE & REAL-TIME OVERSIGHT</p>
      </header>

      {pendingSupplies.length > 0 && (
        <section className="bg-white border-2 border-indigo-200 p-8 rounded-[40px] shadow-2xl space-y-6">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em]">Supply Requisitions</h3>
              <span className="text-[10px] font-black bg-indigo-600 text-white px-5 py-2 rounded-full uppercase">{Object.keys(groupedSupplies).length} PERSONNEL QUEUED</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(Object.entries(groupedSupplies) as [string, SupplyRequest[]][]).map(([uid, batch]) => (
                 <div key={uid} className="bg-slate-50 p-6 rounded-[2.5rem] border border-indigo-100 space-y-5">
                    <p className="text-xs font-black uppercase text-slate-900">{batch[0]?.userName ?? 'Unknown'}</p>
                    <div className="space-y-2">
                       {batch.map(b => (
                          <p key={b.id} className="text-[11px] text-indigo-900 font-bold uppercase flex justify-between">
                             <span className="opacity-70">{b.itemName}</span>
                             <span>x{b.quantity}</span>
                          </p>
                       ))}
                    </div>
                    <button onClick={() => handleApproveSupplies(batch)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">APPROVE & ROUTE</button>
                 </div>
              ))}
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
          <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] border-b pb-4 mb-4">Awaiting Audit</h2>
          <div className="space-y-4 flex-1">
            {reviewQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 italic text-[10px] uppercase">Registry Complete</div>
            ) : (
              reviewQueue.map(shift => (
                <div key={shift.id} className="bg-teal-50/50 p-6 rounded-3xl border border-teal-100 flex flex-col gap-4">
                   <h4 className="text-sm font-black text-slate-900 uppercase truncate">{shift.propertyName}</h4>
                   <button onClick={() => onAuditDeepLink?.(shift.id)} className="w-full bg-teal-600 text-white py-3 rounded-xl font-black uppercase text-[9px] shadow-lg">Open Verification</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
           <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] border-b pb-4 mb-4">Live Field Staff</h2>
           <div className="space-y-3 flex-1">
              {activeOps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 italic text-[10px] uppercase">Ops Standby</div>
              ) : (
                activeOps.map(s => (
                   <div key={s.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center">
                      <p className="text-xs font-black uppercase truncate text-slate-900">{s.propertyName}</p>
                      <span className="text-[10px] font-mono text-green-700 font-black bg-green-100 px-3 py-1 rounded-xl">LIVE</span>
                   </div>
                ))
              )}
           </div>
        </section>

        <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl flex flex-col min-h-[300px]">
           <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] border-b pb-4 mb-4">Extra Hour Logs</h3>
           <div className="space-y-4 flex-1">
              {messQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 italic text-[10px] uppercase">Budget Clear</div>
              ) : (
                messQueue.map(s => (
                   <div key={s.id} className="bg-rose-50/50 p-6 rounded-3xl border-2 border-rose-100">
                      <p className="text-xs font-black uppercase text-slate-900 mb-2">{s.propertyName}</p>
                      <p className="text-[10px] text-rose-700 italic">"{s.messReport?.description ?? 'No details'}"</p>
                   </div>
                ))
              )}
           </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 p-10 rounded-[60px] shadow-2xl">
         <h2 className="text-xl font-black text-slate-900 uppercase tracking-[0.4em] mb-8">Field Incident Center</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shiftsWithIncidents.length === 0 ? (
               <div className="col-span-full py-20 text-center opacity-10 uppercase italic font-black text-[11px]">No unresolved field reports</div>
            ) : shiftsWithIncidents.map((shift) => (
               <div key={shift.id} className="p-8 rounded-[3rem] border border-slate-100 shadow-xl bg-white space-y-4">
                  <h4 className="text-lg font-black text-slate-900 uppercase truncate">{shift.propertyName}</h4>
                  <button onClick={() => setViewingIncidentShift(shift)} className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl uppercase text-[10px] tracking-[0.3em] shadow-2xl">Review Logs</button>
               </div>
            ))}
         </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
