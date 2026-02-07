
import React, { useState } from 'react';
import { User, TabType, Shift, Property, Invoice, Client, OrganizationSettings, ManualTask, TimeEntry } from '../../types';
import PersonnelProfile from '../PersonnelProfile';

// Fix: Providing missing imports and types to resolve "Cannot find name" errors for Client, OrganizationSettings, etc.
interface FinanceDashboardProps {
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  users: User[];
  properties: Property[];
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  clients?: Client[];
  organization?: OrganizationSettings;
  manualTasks?: ManualTask[];
  onUpdateUser?: (user: User) => void;
  timeEntries?: TimeEntry[];
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
  setActiveTab, onLogout, shifts = [], users = [], properties = [], invoices = [], setInvoices, clients = [], organization, manualTasks = [], onUpdateUser, timeEntries = []
}) => {
  // Fix: Initializing selectedPayslipUserId to resolve "Cannot find name" error.
  const [selectedPayslipUserId, setSelectedPayslipUserId] = useState<string | null>(null);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="flex justify-between items-start px-2">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">FINANCIAL TERMINAL</p>
          <h1 className="text-2xl font-brand text-[#1E293B] tracking-tight uppercase leading-none font-extrabold">Finance Hub</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Personnel Payroll Registry</h3>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:border-teal-500 border border-transparent transition-all">
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900 uppercase">{u.name}</p>
                  <p className="text-[8px] font-black text-teal-600 uppercase mt-0.5">{u.role}</p>
                </div>
                <button 
                  onClick={() => setSelectedPayslipUserId(u.id)}
                  className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                >
                  Generate Slips
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedPayslipUserId && (
          <section className="animate-in slide-in-from-right-4">
            {/* Fix: Rendering PersonnelProfile with passed down props. */}
            <PersonnelProfile 
              user={users.find(u => u.id === selectedPayslipUserId)!} 
              shifts={shifts} 
              properties={properties} 
              organization={organization} 
              onUpdateUser={onUpdateUser}
              timeEntries={timeEntries}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default FinanceDashboard;
