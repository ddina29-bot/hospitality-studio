
import React, { useState, useMemo } from 'react';
import { AuditReport, User, UserRole, SupplyRequest, Shift, LeaveRequest } from '../types';

interface ReportsPortalProps {
  auditReports?: AuditReport[];
  users?: User[];
  supplyRequests?: SupplyRequest[];
  shifts?: Shift[];
  leaveRequests?: LeaveRequest[];
  userRole: UserRole;
}

type ReportTab = 'audit' | 'employees' | 'incidents';
type SortOrder = 'newest' | 'oldest' | 'type';
type GroupMode = 'none' | 'property';

const ReportsPortal: React.FC<ReportsPortalProps> = ({ 
  auditReports = [], 
  users = [], 
  supplyRequests = [], 
  shifts = [],
  leaveRequests = [],
  userRole 
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('audit');
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const handleGeneratePDF = (shift: Shift, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cleanerNames = shift.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(', ');
    const inspectorName = shift.decidedBy || 'Management';
    const date = shift.date;
    const formatTime = (ts?: number, str?: string) => {
       if (ts) return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
       return str || 'N/A';
    };
    const timeRange = `${formatTime(shift.actualStartTime, shift.startTime)} - ${formatTime(shift.actualEndTime, shift.endTime)}`;

    const allPhotos = [
        ...(shift.tasks?.flatMap(t => t.photos) || []),
        ...(shift.checkoutPhotos?.keyInBox || []),
        ...(shift.checkoutPhotos?.boxClosed || [])
    ];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to generate the PDF.");
        return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report - ${shift.propertyName}</title>
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
        <div class="border-b-4 border-[#0D9488] pb-6 mb-8 flex justify-between items-start">
           <div>
              <p class="text-[10px] font-black text-[#0D9488] uppercase tracking-[0.4em] mb-2">RESET HOSPITALITY STUDIO</p>
              <h1 class="text-3xl font-bold uppercase tracking-tight mb-4">${shift.propertyName}</h1>
              <div class="flex flex-col gap-1">
                 <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black uppercase tracking-widest text-slate-400 w-16">DATE</span>
                    <span class="text-sm font-bold text-black uppercase tracking-widest bg-slate-50 px-2 rounded">${date}</span>
                 </div>
                 <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black uppercase tracking-widest text-slate-400 w-16">TIME</span>
                    <span class="text-xs font-bold text-black uppercase tracking-widest">${timeRange}</span>
                 </div>
              </div>
           </div>
           <div class="text-right">
              <span class="bg-[#0D9488] text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest">VERIFIED</span>
           </div>
        </div>
        <div class="mb-10">
           <h3 class="text-xs font-black uppercase tracking-widest border-b border-slate-100 pb-2 mb-6">Visual Evidence</h3>
           <div class="grid grid-cols-3 gap-4">
              ${allPhotos.map(p => `<div class="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50"><img src="${p.url}" class="w-full h-full object-cover" /></div>`).join('')}
           </div>
        </div>
        <div class="text-center pt-10 border-t border-slate-100">
           <p class="text-[7px] font-black text-slate-300 uppercase tracking-[0.5em]">Official Studio Operational Record</p>
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
        if (s.status !== 'completed' || s.approvalStatus !== 'approved') return false;
        if (!lowerSearch) return true;
        const propName = s.propertyName?.toLowerCase() || '';
        return propName.includes(lowerSearch);
    }).sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }, [shifts, auditSearch]);

  const auditMonthGroups = useMemo(() => groupShiftsByMonthDay(auditHistory), [auditHistory]);

  const filteredIncidents = useMemo(() => {
      let list = [];
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

  const inputStyle = "bg-white border border-slate-200 rounded-full px-5 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#0D9488] transition-all placeholder:text-slate-300 shadow-sm";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight">STUDIO RECORDS</h2>
           <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-[0.4em]">Operations Data Center</p>
        </div>
        <nav className="p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            {['audit', 'incidents', 'employees'].map((t) => (
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
              <div className="absolute left-4 top-3 text-slate-300"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>

           <div className="space-y-8">
              {auditMonthGroups.map((monthGroup, mIdx) => (
                 <div key={mIdx} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                       <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{monthGroup.monthLabel}</h2>
                    </div>
                    <div className="p-6 space-y-3">
                       {monthGroup.days.flatMap(d => d.shifts).map(shift => (
                          <div key={shift.id} className="flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl bg-teal-50/20 border border-teal-50 hover:border-[#0D9488] transition-all gap-4">
                             <div className="flex items-center gap-4">
                                <span className="text-xl">📄</span>
                                <div>
                                   <h4 className="text-sm font-bold text-slate-900 uppercase">{shift.propertyName}</h4>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase">{shift.date} • {shift.serviceType}</p>
                                </div>
                             </div>
                             <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={(e) => handleGeneratePDF(shift, e)} className="flex-1 md:flex-none px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">PDF</button>
                                <button onClick={() => setSelectedAuditShift(shift)} className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest">View</button>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'incidents' && (
         <div className="space-y-4 animate-in slide-in-from-right-4">
            {filteredIncidents.map((inc, i) => (
               <div key={i} className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">!</div>
                     <div>
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
      
      {zoomedImage && <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
    </div>
  );
};

export default ReportsPortal;
