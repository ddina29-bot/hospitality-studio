
import React, { useState, useMemo } from 'react';
import { AuditReport, User, UserRole, SupplyRequest, Shift, LeaveRequest, AnomalyReport } from '../types';

interface ReportsPortalProps {
  auditReports?: AuditReport[];
  users?: User[];
  supplyRequests?: SupplyRequest[];
  shifts?: Shift[];
  leaveRequests?: LeaveRequest[];
  userRole: UserRole;
  anomalyReports?: AnomalyReport[];
}

type ReportTab = 'audit' | 'employees' | 'incidents' | 'anomalies';
type SortOrder = 'newest' | 'oldest' | 'type';

const ReportsPortal: React.FC<ReportsPortalProps> = ({ 
  auditReports = [], 
  users = [], 
  supplyRequests = [], 
  shifts = [],
  leaveRequests = [],
  userRole,
  anomalyReports = []
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('audit');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleGeneratePDF = (shift: Shift, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const assignedStaffNames = shift.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(', ');
    const startTimeStr = shift.actualStartTime ? new Date(shift.actualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const endTimeStr = shift.actualEndTime ? new Date(shift.actualEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    const allPhotos = [
        ...(shift.tasks?.flatMap(t => t.photos) || []),
        ...(shift.checkoutPhotos?.keyInBox || []),
        ...(shift.checkoutPhotos?.boxClosed || [])
    ];

    const isApproved = shift.approvalStatus === 'approved';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to generate the PDF.");
        return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Deployment Report - ${shift.propertyName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; padding: 40px; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body class="bg-white text-black max-w-4xl mx-auto">
        <div class="border-b-4 ${isApproved ? 'border-[#0D9488]' : 'border-rose-600'} pb-6 mb-8 flex justify-between items-start">
           <div>
              <p class="text-[10px] font-black ${isApproved ? 'text-[#0D9488]' : 'text-rose-600'} uppercase tracking-[0.4em] mb-2">OFFICIAL DEPLOYMENT RECORD</p>
              <h1 class="text-4xl font-bold uppercase tracking-tighter mb-4">${shift.propertyName}</h1>
              <div class="space-y-2">
                 <div class="flex items-center gap-4">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">PERSONNEL</span>
                    <span class="text-sm font-bold text-black uppercase">${assignedStaffNames}</span>
                 </div>
                 <div class="flex items-center gap-4">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">DATE</span>
                    <span class="text-sm font-bold text-black uppercase tracking-widest bg-slate-100 px-2 rounded">${shift.date}</span>
                 </div>
                 <div class="flex items-center gap-4">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">TIMELINE</span>
                    <span class="text-sm font-bold text-black uppercase">${startTimeStr} — ${endTimeStr}</span>
                 </div>
              </div>
           </div>
           <div class="text-right">
              <div class="px-6 py-2 rounded-xl ${isApproved ? 'bg-teal-600' : 'bg-rose-600'} text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg">
                ${isApproved ? 'VERIFIED CLEAN' : 'ISSUES REPORTED'}
              </div>
           </div>
        </div>
        
        <div class="mb-10">
           <h3 class="text-xs font-black uppercase tracking-widest border-b-2 border-slate-100 pb-2 mb-6">Execution Visuals</h3>
           <div class="grid grid-cols-3 gap-6">
              ${allPhotos.map(p => `<div class="aspect-square rounded-[2rem] overflow-hidden border border-slate-200 bg-slate-50 shadow-sm"><img src="${p.url}" class="w-full h-full object-cover" /></div>`).join('')}
           </div>
        </div>

        <div class="${isApproved ? 'bg-slate-50' : 'bg-rose-50'} p-8 rounded-[2rem] border ${isApproved ? 'border-slate-100' : 'border-rose-100'}">
           <p class="text-[9px] font-black ${isApproved ? 'text-slate-400' : 'text-rose-400'} uppercase tracking-widest mb-3">ADMINISTRATIVE FEEDBACK</p>
           <p class="text-sm italic font-medium ${isApproved ? 'text-slate-600' : 'text-rose-700'}">"${shift.approvalComment || 'Standard deployment protocol completed.'}"</p>
        </div>

        <div class="mt-12 text-center">
           <p class="text-[8px] font-black uppercase text-slate-300 tracking-[0.5em]">DIGITALLY VERIFIED BY RESET STUDIO OPS CORE</p>
        </div>

        <script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const currentYear = new Date().getFullYear();
    if (dateStr.includes('-')) return new Date(dateStr);
    return new Date(`${dateStr} ${currentYear}`);
  };

  const groupShiftsByMonthDay = (shiftList: Shift[]) => {
    const groups: { monthLabel: string; year: number; monthIndex: number; days: { date: string; shifts: Shift[] }[] }[] = [];
    shiftList.forEach(shift => {
        let d = parseDate(shift.date) || new Date(0);
        const monthLabel = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        let mGroup = groups.find(g => g.monthLabel === monthLabel);
        if (!mGroup) {
            mGroup = { monthLabel, year, monthIndex, days: [] };
            groups.push(mGroup);
        }
        let dGroup = mGroup.days.find(day => day.date === shift.date);
        if (!dGroup) {
            dGroup = { date: shift.date, shifts: [] };
            mGroup.days.push(dGroup);
        }
        dGroup.shifts.push(shift);
    });
    return groups.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.monthIndex - a.monthIndex));
  };

  const auditHistory = useMemo(() => {
    const lowerSearch = auditSearch.toLowerCase();
    return shifts.filter(s => {
        // INCLUDE ALL COMPLETED SHIFTS (Approved or Rejected)
        if (s.status !== 'completed' || s.approvalStatus === 'pending') return false;
        if (!lowerSearch) return true;
        const propName = s.propertyName?.toLowerCase() || '';
        return propName.includes(lowerSearch);
    }).sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }, [shifts, auditSearch]);

  const auditMonthGroups = useMemo(() => groupShiftsByMonthDay(auditHistory), [auditHistory]);

  const filteredIncidents = useMemo(() => {
      let list: any[] = [];
      shifts.forEach(s => {
         s.maintenanceReports?.forEach(r => list.push({ ...r, type: 'Maintenance', date: s.date, propertyName: s.propertyName, status: r.status }));
         s.damageReports?.forEach(r => list.push({ ...r, type: 'Damage', date: s.date, propertyName: s.propertyName, status: r.status }));
         s.missingReports?.forEach(r => list.push({ ...r, type: 'Missing', date: s.date, propertyName: s.propertyName, status: r.status }));
      });
      if (incidentSearch) {
        const q = incidentSearch.toLowerCase();
        list = list.filter(i => i.propertyName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
      }
      return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [shifts, incidentSearch]);

  const employeeLeaveStats = useMemo(() => {
    const stats: Record<string, { name: string, sick: number, vacation: number, off: number, total: number }> = {};
    
    users.filter(u => ['cleaner', 'supervisor', 'driver'].includes(u.role)).forEach(u => {
        stats[u.id] = { name: u.name, sick: 0, vacation: 0, off: 0, total: 0 };
    });

    leaveRequests.filter(l => l.status === 'approved').forEach(l => {
        if (stats[l.userId]) {
            if (l.type === 'Sick Leave') stats[l.userId].sick++;
            else if (l.type === 'Vacation Leave') stats[l.userId].vacation++;
            else stats[l.userId].off++;
            stats[l.userId].total++;
        }
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [users, leaveRequests]);

  const inputStyle = "bg-white border border-slate-200 rounded-full px-5 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#0D9488] transition-all placeholder:text-slate-300 shadow-sm";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">Studio Records</h2>
           <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-[0.4em] mt-2">Operations Intelligence Center</p>
        </div>
        <nav className="p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            {['audit', 'incidents', 'anomalies', 'employees'].map((t) => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === t ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {activeTab === 'audit' && (
        <div className="space-y-10 animate-in slide-in-from-right-4">
           <div className="relative w-full">
              <input type="text" placeholder="SEARCH APARTMENT OR DATE..." className={`${inputStyle} w-full pl-12`} value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
              <div className="absolute left-4 top-3 text-slate-300"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-8">
              {auditMonthGroups.map((monthGroup, mIdx) => (
                 <div key={mIdx} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-8 py-5 border-b border-slate-100">
                       <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{monthGroup.monthLabel}</h2>
                    </div>
                    <div className="p-6 space-y-3">
                       {monthGroup.days.flatMap(d => d.shifts).map(shift => {
                          const isRejected = shift.approvalStatus === 'rejected';
                          return (
                            <div key={shift.id} className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl border transition-all gap-4 ${isRejected ? 'bg-rose-50/50 border-rose-100 hover:border-rose-300' : 'bg-teal-50/20 border-teal-50 hover:border-[#0D9488]'}`}>
                              <div className="flex items-center gap-4 text-left">
                                <span className="text-xl">{isRejected ? '❌' : '📄'}</span>
                                <div className="min-w-0">
                                   <h4 className={`text-sm font-bold uppercase truncate ${isRejected ? 'text-rose-900' : 'text-slate-900'}`}>{shift.propertyName}</h4>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase">{shift.date} • {shift.serviceType}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                      <p className={`text-[8px] font-black uppercase ${isRejected ? 'text-rose-400' : 'text-teal-600'}`}>Staff: {shift.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).join(' & ')}</p>
                                      {isRejected && <span className="text-[7px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase">Reported</span>}
                                   </div>
                                </div>
                              </div>
                              <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={(e) => handleGeneratePDF(shift, e)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all ${isRejected ? 'bg-rose-900 text-white hover:bg-rose-950' : 'bg-slate-900 text-white hover:bg-black'}`}>GENERATE REPORT</button>
                              </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'incidents' && (
         <div className="space-y-4 animate-in slide-in-from-right-4">
            {filteredIncidents.length === 0 ? (
               <div className="py-20 text-center opacity-20 font-black uppercase italic tracking-widest text-[10px]">No shift incidents logged</div>
            ) : filteredIncidents.map((inc, i) => (
               <div key={i} className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">!</div>
                     <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-900 uppercase">{inc.propertyName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{inc.date} • {inc.type}</p>
                        <p className="text-xs text-slate-600 italic mt-1">"{inc.description}"</p>
                     </div>
                  </div>
                  <span className="px-4 py-1.5 rounded-full text-[8px] font-black bg-slate-100 text-slate-400 uppercase">{inc.status}</span>
               </div>
            ))}
         </div>
      )}

      {activeTab === 'anomalies' && (
         <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="text-left">
                  <h3 className="text-xl font-bold uppercase tracking-tight">Anomaly Monitoring Log</h3>
                  <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.4em] mt-2">Active Risk Tracking</p>
               </div>
               <span className="bg-teal-400/10 text-teal-400 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-teal-400/20">LIVE DATA STREAM</span>
            </div>

            <div className="space-y-3">
               {anomalyReports.length === 0 ? (
                  <div className="py-24 text-center border-2 border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em]">Historical Queue Clear</div>
               ) : (
                  anomalyReports.map((anom) => (
                     <div key={anom.id} className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 hover:border-rose-100 transition-all group">
                        <div className="flex items-center gap-6 text-left flex-1">
                           <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xl shrink-0">!</div>
                           <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                 <h4 className="text-sm font-black text-slate-900 uppercase">{anom.userName}</h4>
                                 <span className="bg-rose-600 text-white text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">AUDIT FILED</span>
                              </div>
                              <p className="text-[10px] text-slate-600 font-bold italic leading-relaxed">"{anom.message}"</p>
                           </div>
                        </div>
                        <div className="text-right shrink-0">
                           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(anom.timestamp).toLocaleDateString()} • {new Date(anom.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      )}

      {activeTab === 'employees' && (
         <div className="space-y-10 animate-in slide-in-from-right-4">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest">Personnel Leave Intelligence</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase">Approved Absence Tracking</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                           <tr>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Day Off</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Sick</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vacation</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Frequency Score</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {employeeLeaveStats.map((stat, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                 <td className="px-6 py-4 font-bold text-xs text-slate-900 uppercase">{stat.name}</td>
                                 <td className="px-6 py-4 text-center font-bold text-xs">{stat.off}</td>
                                 <td className="px-6 py-4 text-center font-bold text-xs text-rose-600">{stat.sick}</td>
                                 <td className="px-6 py-4 text-center font-bold text-xs text-teal-600">{stat.vacation}</td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className={`h-full ${stat.total > 5 ? 'bg-rose-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, stat.total * 10)}%` }}></div>
                                       </div>
                                       <span className="text-[10px] font-black text-slate-400">{stat.total}</span>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
      )}
      
      {zoomedImage && <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
    </div>
  );
};

export default ReportsPortal;
