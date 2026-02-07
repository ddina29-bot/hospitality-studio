
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
  onUpdateUser?: (user: User) => void;
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
  setActiveTab, onLogout, shifts = [], users = [], properties = [], invoices = [], setInvoices, clients = [], organization, manualTasks = [], onUpdateUser
}) => {
  const [activeModule, setActiveModule] = useState<'payroll' | 'invoicing' | 'records'>('payroll');
  const [selectedPayslipUserId, setSelectedPayslipUserId] = useState<string | null>(null);
  const [activeStatReport, setActiveStatReport] = useState<'FS5' | 'VAT' | 'SSC' | null>(null);
  
  const stats = useMemo(() => {
    let totalPayrollGross = 0;
    let totalPayrollTax = 0;
    let totalPayrollNI = 0;
    let totalPayees = 0;

    users.forEach(u => {
        if ((u.payslips || []).length > 0) totalPayees++;
        u.payslips?.forEach(ps => {
            totalPayrollGross += ps.grossPay;
            totalPayrollTax += ps.tax;
            totalPayrollNI += ps.ni;
        });
    });

    return { 
        totalPayrollGross, 
        totalPayrollTax, 
        totalPayrollNI, 
        totalPayees,
        totalDue: totalPayrollTax + totalPayrollNI 
    };
  }, [users]);

  const renderFS5Report = () => {
    if (!activeStatReport || activeStatReport !== 'FS5') return null;
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' }).toUpperCase();
    const year = now.getFullYear();

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[600] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[0.5rem] w-full max-w-4xl p-10 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border border-slate-300 font-sans">
              <button onClick={() => setActiveStatReport(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              
              <header className="flex justify-between items-center border-b-4 border-blue-600 pb-6">
                 <div>
                    <h1 className="text-4xl font-black text-blue-600 flex items-center gap-4">
                       FS5
                       <div className="text-left">
                          <p className="text-xs uppercase font-bold leading-none tracking-tighter text-slate-800">Final Settlement System (FSS)</p>
                          <p className="text-[10px] uppercase font-medium leading-none mt-1 text-slate-500">Payer's Monthly Payment Advice</p>
                       </div>
                    </h1>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">MT Tax & Customs Administration</p>
                 </div>
              </header>

              <div className="grid grid-cols-12 gap-8">
                 {/* Section A */}
                 <div className="col-span-7 bg-blue-50/30 p-6 border border-blue-100 rounded">
                    <p className="text-[10px] font-black text-blue-800 uppercase mb-4 border-b border-blue-100 pb-1">A. PAYER INFORMATION</p>
                    <div className="space-y-4">
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block uppercase">Business Name</label>
                          <p className="text-sm font-black uppercase text-slate-900">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                       </div>
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block uppercase">Business Address</label>
                          <p className="text-xs font-bold uppercase text-slate-600">{organization?.address || 'N/A'}</p>
                       </div>
                    </div>
                 </div>

                 {/* Section Stats (Right) */}
                 <div className="col-span-5 space-y-4">
                    <div className="p-4 border-2 border-slate-800 rounded flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase">Payer P.E. No.</span>
                       <span className="text-xl font-black">{organization?.peNumber || 'N/A'}</span>
                    </div>
                    <div className="p-4 border-2 border-slate-800 rounded flex justify-between items-center bg-slate-900 text-white">
                       <span className="text-[10px] font-black uppercase">Payment For Month Of</span>
                       <span className="text-xl font-black uppercase">{month} {year}</span>
                    </div>
                 </div>

                 {/* Section B & C */}
                 <div className="col-span-12 grid grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-6 border border-slate-200 rounded">
                       <p className="text-[10px] font-black uppercase mb-4 border-b border-slate-200 pb-1 text-slate-500">B. NUMBER OF PAYEES</p>
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600">Total FSS Main Method Payees</span>
                          <span className="text-xl font-black text-slate-900">{stats.totalPayees}</span>
                       </div>
                    </div>
                    <div className="bg-slate-50 p-6 border border-slate-200 rounded">
                       <p className="text-[10px] font-black uppercase mb-4 border-b border-slate-200 pb-1 text-slate-500">C. GROSS EMOLUMENTS</p>
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600 uppercase">Total Gross Emoluments</span>
                          <span className="text-xl font-black text-slate-900">€{stats.totalPayrollGross.toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 {/* Section D - The Calculation */}
                 <div className="col-span-12 border-2 border-blue-600 p-8 rounded bg-blue-50/10">
                    <p className="text-[11px] font-black uppercase mb-6 text-blue-800">D. TAX DEDUCTIONS AND SSC DUE TO THE COMMISSIONER</p>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-xs font-bold">
                          <span>Tax Deductions (FSS Main)</span>
                          <span className="font-black text-lg">€{stats.totalPayrollTax.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold">
                          <span>Social Security Contributions (NI)</span>
                          <span className="font-black text-lg">€{stats.totalPayrollNI.toFixed(2)}</span>
                       </div>
                       <div className="pt-6 border-t-2 border-blue-600 flex justify-between items-center mt-4">
                          <span className="text-sm font-black uppercase text-blue-900">Total Due to the Commissioner</span>
                          <div className="text-right">
                             <p className="text-3xl font-black text-blue-600">€{stats.totalDue.toFixed(2)}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Authorized Digital Submission</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-10 flex justify-between items-end no-print">
                 <div className="flex gap-4">
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-10 py-3 rounded font-black uppercase text-[10px] tracking-widest shadow-xl">Print Document</button>
                    <button onClick={() => setActiveStatReport(null)} className="bg-slate-100 text-slate-400 px-10 py-3 rounded font-black uppercase text-[10px] tracking-widest">Dismiss</button>
                 </div>
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">MT_REVENUE_CORE_V2</p>
              </div>
           </div>
        </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      {renderFS5Report()}
      <header className="flex flex-col space-y-0.5 px-2">
        <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Financial Controller</p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-tight font-brand">Finance Studio</h1>
      </header>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button onClick={() => setActiveModule('payroll')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'payroll' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Payroll</button>
          <button onClick={() => setActiveModule('invoicing')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'invoicing' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Invoicing</button>
          <button onClick={() => setActiveModule('records')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'records' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Statutory</button>
      </div>

      {activeModule === 'records' && (
         <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => setActiveStatReport('FS5')} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4 hover:border-teal-200 transition-all cursor-pointer group">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📝</div>
                   <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">FS5 MONTHLY ADVICE</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Consolidated Monthly Tax & NI payment summary for MTCA.</p>
                   </div>
                   <button className="text-[8px] font-black text-blue-600 uppercase tracking-widest border-b-2 border-blue-600 pb-0.5">GENERATE REPORT</button>
                </div>
            </div>
         </div>
      )}

      {activeModule === 'payroll' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-left-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Personnel Payout Pipeline</h3>
              <div className="space-y-4">
                  {users.filter(u => u.status === 'active' && ['cleaner', 'supervisor', 'driver', 'housekeeping', 'admin', 'laundry'].includes(u.role)).map(staff => (
                    <div key={staff.id} className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-teal-200 transition-all">
                        <div className="flex items-center gap-6 flex-1 w-full text-left">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center font-bold text-2xl shadow-sm overflow-hidden">
                              {staff.photoUrl ? <img src={staff.photoUrl} className="w-full h-full object-cover" /> : staff.name.charAt(0)}
                          </div>
                          <div>
                              <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{staff.name}</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                                {staff.role} • {staff.maritalStatus || 'Single'} {staff.isParent ? '(Parent)' : ''}
                              </p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPayslipUserId(staff.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">PROCESS PAYROLL / FS3</button>
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {selectedPayslipUserId && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#F0FDFA] rounded-[3rem] w-full max-w-5xl h-[90vh] overflow-y-auto p-10 shadow-2xl relative">
              <button onClick={() => setSelectedPayslipUserId(null)} className="absolute top-10 right-10 text-slate-400 hover:text-black text-2xl">&times;</button>
              <PersonnelProfile 
                user={users.find(u => u.id === selectedPayslipUserId)!} 
                shifts={shifts} 
                properties={properties} 
                organization={organization} 
                onUpdateUser={onUpdateUser}
              />
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;
