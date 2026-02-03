import React, { useState, useMemo } from 'react';
import { TabType, Shift, User, Property, Invoice, Client, OrganizationSettings, ManualTask } from '../../types';
import PersonnelProfile from '../PersonnelProfile';

interface FinanceDashboardProps {
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  users: User[];
  properties: Property[];
  invoices?: Invoice[];
  setInvoices?: React.Dispatch<React.SetStateAction<Invoice[]>>;
  clients?: Client[];
  organization?: OrganizationSettings;
  manualTasks?: ManualTask[];
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
  setActiveTab, onLogout, shifts = [], setShifts, users = [], properties = [], invoices = [], setInvoices, clients = [], organization, manualTasks = [] 
}) => {
  const [activeModule, setActiveModule] = useState<'payroll' | 'invoicing' | 'records'>('payroll');
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [viewingRecordsUser, setViewingRecordsUser] = useState<User | null>(null);
  const [initialDocMode, setInitialDocMode] = useState<'fs3' | 'payslip' | 'worksheet' | null>(null);

  const filteredRecordsUsers = useMemo(() => {
    return users.filter(u => {
      const isEmployee = ['cleaner', 'supervisor', 'driver', 'housekeeping', 'maintenance', 'laundry'].includes(u.role);
      const matchesSearch = u.name.toLowerCase().includes(recordsSearch.toLowerCase());
      return matchesSearch && isEmployee;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, recordsSearch]);

  const cleanerPayroll = useMemo(() => {
    const data: Record<string, { user: User, shifts: Shift[] }> = {};
    shifts.filter(s => s.status === 'completed' && !s.paid).forEach(s => {
      s.userIds?.forEach(sid => {
        if (!data[sid]) {
          const u = users.find(user => user.id === sid);
          if (u) data[sid] = { user: u, shifts: [] };
        }
        if (data[sid]) data[sid].shifts.push(s);
      });
    });
    return Object.values(data);
  }, [shifts, users]);

  const calculatePayslipBreakdown = (staffShifts: Shift[], staff: User) => {
    let totalNet = 0;
    staffShifts.forEach(s => {
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = durationMs / (1000 * 60 * 60);
      totalNet += hours * (staff.payRate || 5.0);
    });
    return { totalNet };
  };

  const activePayslip = useMemo(() => {
    if (!selectedPayslipId) return null;
    const entry = cleanerPayroll.find(p => p.user.id === selectedPayslipId);
    if (!entry) return null;
    return { ...entry, breakdown: calculatePayslipBreakdown(entry.shifts, entry.user) };
  }, [selectedPayslipId, cleanerPayroll]);

  if (viewingRecordsUser) {
    return (
      <div className="animate-in slide-in-from-right-4 duration-500">
        <button onClick={() => setViewingRecordsUser(null)} className="mb-6 text-[10px] font-black uppercase text-indigo-600 hover:underline">← Back to Records</button>
        <PersonnelProfile 
          user={viewingRecordsUser} 
          shifts={shifts} 
          properties={properties} 
          organization={organization}
          initialDocView={initialDocMode}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="px-2">
        <p className="text-teal-600 font-black uppercase tracking-[0.4em] text-[8px]">Finance Terminal</p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-tight font-brand">CFO Dashboard</h1>
      </header>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button onClick={() => setActiveModule('payroll')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${activeModule === 'payroll' ? 'bg-[#0D9488] text-white' : 'text-slate-400'}`}>Payroll</button>
          <button onClick={() => setActiveModule('records')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${activeModule === 'records' ? 'bg-[#0D9488] text-white' : 'text-slate-400'}`}>Records</button>
      </div>

      {activeModule === 'records' && (
        <div className="space-y-6 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest">Employee Archive</h3>
              <input type="text" placeholder="Search staff..." className="bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-[10px] outline-none" value={recordsSearch} onChange={e => setRecordsSearch(e.target.value)} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecordsUsers.map(u => (
                <div key={u.id} className="p-6 rounded-3xl border border-slate-100 flex flex-col gap-4 bg-white hover:border-teal-200 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xl">{u.name.charAt(0)}</div>
                      <div>
                        <h4 className="text-base font-bold uppercase leading-none">{u.name}</h4>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{u.role}</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode('payslip'); }} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase">PAYSLIPS</button>
                      <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode(null); }} className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase">DOSSIER</button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeModule === 'payroll' && (
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
            {cleanerPayroll.map(entry => (
              <div key={entry.user.id} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center">
                 <div>
                    <h4 className="font-bold uppercase">{entry.user.name}</h4>
                    <p className="text-[9px] text-slate-400 uppercase">{entry.shifts.length} Shifts pending</p>
                 </div>
                 <button onClick={() => setSelectedPayslipId(entry.user.id)} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase">DETAILS</button>
              </div>
            ))}
        </div>
      )}

      {selectedPayslipId && activePayslip && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 space-y-8 text-left shadow-2xl relative">
              <button onClick={() => setSelectedPayslipId(null)} className="absolute top-8 right-8 text-slate-300">&times;</button>
              <h2 className="text-2xl font-bold uppercase">Confirm Payout</h2>
              <div className="bg-emerald-600 p-8 rounded-3xl text-white">
                 <p className="text-[10px] font-black uppercase opacity-60">Net Payout</p>
                 <p className="text-4xl font-bold">€{activePayslip.breakdown.totalNet.toFixed(2)}</p>
              </div>
              <button onClick={() => { setShifts?.(prev => prev.map(s => activePayslip.shifts.map(sh => sh.id).includes(s.id) ? { ...s, paid: true } : s)); setSelectedPayslipId(null); alert("Payment logged."); }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">CONFIRM PAYOUT</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;