
import React, { useState, useMemo, useRef } from 'react';
import { MaintenanceTicket, User, UserRole, Shift, SpecialReport } from '../types';
import { uploadFile } from '../services/storageService';

interface MaintenancePortalProps {
  users?: User[];
  userRole: UserRole;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  setActiveTab?: (tab: 'dashboard') => void;
  onLogout?: () => void;
}

const MaintenancePortal: React.FC<MaintenancePortalProps> = ({ users = [], userRole, shifts = [], setShifts, setActiveTab, onLogout }) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const [activeTab, setActiveTabLocal] = useState<'internal' | 'outsourced'>('internal');
  
  // For Vendors: Completing a job
  const [finishingReport, setFinishingReport] = useState<{ shiftId: string, report: SpecialReport } | null>(null);
  const [vendorCost, setVendorCost] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  
  const completionFileRef = useRef<HTMLInputElement>(null);

  // Extract all active reports across all shifts
  const allIncidents = useMemo(() => {
    const list: { 
      shiftId: string, 
      propertyName: string, 
      report: SpecialReport, 
      type: 'maintenance' | 'damage' | 'missing' 
    }[] = [];

    shifts.forEach(s => {
      s.maintenanceReports?.forEach(r => list.push({ shiftId: s.id, propertyName: s.propertyName || '', report: r, type: 'maintenance' }));
      s.damageReports?.forEach(r => list.push({ shiftId: s.id, propertyName: s.propertyName || '', report: r, type: 'damage' }));
      s.missingReports?.forEach(r => list.push({ shiftId: s.id, propertyName: s.propertyName || '', report: r, type: 'missing' }));
    });
    return list;
  }, [shifts]);

  // VENDOR VIEW: Only show reports assigned to me
  const myVendorJobs = useMemo(() => {
    if (userRole !== 'outsourced_maintenance') return [];
    return allIncidents.filter(i => i.report.assignedTo === currentUser.id && i.report.status !== 'resolved');
  }, [allIncidents, userRole, currentUser.id]);

  // ADMIN VIEW: Split by assignment type
  const adminInternalJobs = useMemo(() => {
    return allIncidents.filter(i => {
        if (i.report.status === 'resolved') return false;
        const assignee = users.find(u => u.id === i.report.assignedTo);
        return assignee?.role !== 'outsourced_maintenance'; // Internal if assigned to anyone else or unassigned (logic can vary)
    });
  }, [allIncidents, users]);

  const adminOutsourcedJobs = useMemo(() => {
    return allIncidents.filter(i => {
        if (i.report.status === 'resolved') return false;
        const assignee = users.find(u => u.id === i.report.assignedTo);
        return assignee?.role === 'outsourced_maintenance';
    });
  }, [allIncidents, users]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const url = await uploadFile(file);
        setCompletionPhotos(prev => [...prev, url]);
    } catch (err) {
        console.error("Upload failed", err);
        alert("Failed to upload photo.");
    }
  };

  const handleVendorComplete = () => {
    if (!finishingReport || !setShifts) return;
    
    setShifts(prev => prev.map(s => {
        if (s.id === finishingReport.shiftId) {
            const updateReports = (reports: SpecialReport[] | undefined) => {
                return (reports || []).map(r => r.id === finishingReport.report.id ? { 
                    ...r, 
                    status: 'resolved' as const, 
                    cost: parseFloat(vendorCost) || 0,
                    invoiceRef: invoiceRef,
                    vendorNotes: vendorNotes,
                    photos: [...(r.photos || []), ...completionPhotos] // Append completion photos
                } : r);
            };

            return {
                ...s,
                maintenanceReports: updateReports(s.maintenanceReports),
                damageReports: updateReports(s.damageReports),
                missingReports: updateReports(s.missingReports)
            };
        }
        return s;
    }));

    setFinishingReport(null);
    setVendorCost('');
    setInvoiceRef('');
    setVendorNotes('');
    setCompletionPhotos([]);
    alert("Job Completed & Invoice Submitted");
  };

  const badgeStyle = (type: string) => {
    switch (type) {
      case 'damage': return 'bg-orange-500/10 text-orange-500 border-orange-500/40';
      case 'missing': return 'bg-purple-500/10 text-purple-500 border-purple-500/40';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/40';
    }
  };

  // --- RENDER FOR OUTSOURCED VENDOR ---
  if (userRole === 'outsourced_maintenance') {
    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-24 text-left">
            <header className="flex justify-between items-center bg-[#1A1A1A] p-6 rounded-[32px] text-white shadow-2xl">
                <div>
                    <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em]">VENDOR PORTAL</p>
                    <h1 className="text-xl font-serif-brand font-bold uppercase tracking-tight">{currentUser.name}</h1>
                </div>
                <button onClick={onLogout} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Log Out</button>
            </header>

            <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <h3 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">ASSIGNED JOBS</h3>
                </div>

                {myVendorJobs.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-20 italic text-[10px] font-black uppercase tracking-[0.4em]">No active assignments</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myVendorJobs.map((job, i) => (
                            <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-200 shadow-lg flex flex-col gap-6 hover:border-blue-200 transition-all">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-black uppercase leading-tight">{job.propertyName}</h3>
                                            <div className={`w-fit px-3 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${badgeStyle(job.type)}`}>{job.type}</div>
                                        </div>
                                        <span className="text-[8px] text-black/30 font-black uppercase">{new Date(job.report.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[11px] font-medium text-black/70 italic">"{job.report.description}"</p>
                                    </div>
                                    {job.report.photos.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {job.report.photos.map((url, idx) => (
                                                <img key={idx} src={url} className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm" alt="Evidence" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setFinishingReport({ shiftId: job.shiftId, report: job.report })}
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-all hover:bg-blue-700"
                                >
                                    COMPLETE JOB
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Completion Modal */}
            {finishingReport && (
                <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 overflow-y-auto">
                    <div className="bg-white rounded-[40px] w-full max-w-md p-8 space-y-6 shadow-2xl relative text-left my-auto">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-black uppercase">Finalize Job</h3>
                            <p className="text-[8px] text-black/40 font-black uppercase tracking-widest">Billing Information</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em] mb-1.5 block">Total Cost (€)</label>
                                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black font-bold outline-none focus:border-blue-500" placeholder="0.00" value={vendorCost} onChange={e => setVendorCost(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em] mb-1.5 block">Invoice Reference #</label>
                                <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black font-bold outline-none focus:border-blue-500" placeholder="INV-2024-..." value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em] mb-1.5 block">Vendor Notes</label>
                                <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black font-medium outline-none focus:border-blue-500 h-24 italic text-xs" placeholder="Work performed details..." value={vendorNotes} onChange={e => setVendorNotes(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-black/40 uppercase tracking-[0.2em] mb-1.5 block">Attach Proof (Photos)</label>
                                <div className="flex gap-2 items-center">
                                    <button onClick={() => completionFileRef.current?.click()} className="h-12 w-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-all text-black/40">
                                        +
                                    </button>
                                    <div className="flex gap-2 overflow-x-auto">
                                        {completionPhotos.map((url, i) => (
                                            <img key={i} src={url} className="h-12 w-12 rounded-xl object-cover border border-gray-200" />
                                        ))}
                                    </div>
                                    <input type="file" ref={completionFileRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleVendorComplete} className="flex-1 bg-black text-white font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest shadow-xl">SUBMIT INVOICE</button>
                            <button onClick={() => setFinishingReport(null)} className="px-6 border border-gray-200 text-black/40 font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest">CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // --- RENDER FOR ADMIN (Overview) ---
  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">TECHNICAL OPERATIONS</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{currentUser.name.toUpperCase()}</span>
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-2 p-1 bg-black/5 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTabLocal('internal')} 
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'internal' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/40 hover:bg-white/50'}`}
          >
            Employed Staff
          </button>
          <button 
            onClick={() => setActiveTabLocal('outsourced')} 
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'outsourced' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/40 hover:bg-white/50'}`}
          >
            Vendor Network
          </button>
        </div>

        <div className="bg-[#1A1A1A] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-8 space-y-6">
             <h3 className="text-xs font-serif-brand text-white uppercase font-bold tracking-widest">
               {activeTab === 'internal' ? 'INTERNAL MAINTENANCE QUEUE' : 'EXTERNAL CONTRACTOR LOGS'}
             </h3>
             
             <div className="space-y-4">
                 {(activeTab === 'internal' ? adminInternalJobs : adminOutsourcedJobs).length === 0 ? (
                     <div className="py-12 text-center text-white/20 italic text-[10px] uppercase font-black">No active jobs in this queue.</div>
                 ) : (
                     (activeTab === 'internal' ? adminInternalJobs : adminOutsourcedJobs).map((job, i) => {
                         const assignee = users.find(u => u.id === job.report.assignedTo);
                         return (
                           <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-black/40 rounded-3xl border border-white/5 gap-4 hover:border-[#C5A059]/20 transition-all">
                             <div className="space-y-2">
                               <div className="flex items-center gap-3">
                                   <p className="text-xs font-bold text-white uppercase">{job.propertyName}</p>
                                   <div className={`px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest ${badgeStyle(job.type)}`}>{job.type}</div>
                               </div>
                               <p className="text-[10px] text-white/60 italic">"{job.report.description}"</p>
                               <div className="flex items-center gap-2">
                                   <div className="w-5 h-5 rounded-full bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center font-bold text-[9px] border border-[#C5A059]/20">{assignee?.name.charAt(0)}</div>
                                   <p className="text-[8px] text-[#C5A059] uppercase tracking-widest font-black">{assignee?.name || 'Unassigned'}</p>
                               </div>
                             </div>
                             
                             <div className="flex items-center gap-4">
                                {job.report.status === 'assigned' && <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">IN PROGRESS</span>}
                                {job.report.status === 'resolved' && <span className="text-[8px] font-black text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-widest">RESOLVED</span>}
                             </div>
                           </div>
                         );
                     })
                 )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePortal;
