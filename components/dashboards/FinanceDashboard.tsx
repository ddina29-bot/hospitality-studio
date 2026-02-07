
import React, { useState, useMemo } from 'react';
import { TabType, Shift, User, Property, Invoice, Client, OrganizationSettings, ManualTask, SavedPayslip } from '../../types';
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
    let totalPayrollNI_Payee = 0;
    let totalPayees = 0;

    users.forEach(u => {
        if ((u.payslips || []).length > 0) totalPayees++;
        u.payslips?.forEach(ps => {
            totalPayrollGross += ps.grossPay;
            totalPayrollTax += ps.tax;
            totalPayrollNI_Payee += ps.ni;
        });
    });

    const totalNI_Due = totalPayrollNI_Payee * 2; // Payee + Payer share
    const maternityFund = totalPayrollGross * 0.003; 

    return { 
        totalPayrollGross, 
        totalPayrollTax, 
        totalPayrollNI_Payee,
        totalNI_Due,
        totalPayees,
        maternityFund,
        totalDue: totalPayrollTax + totalNI_Due + maternityFund 
    };
  }, [users]);

  // Helper to render box-digits for FS5
  const DigitBox = ({ value, length, color = "slate-400" }: { value: string | number, length: number, color?: string }) => {
    const s = String(value).replace(/[.,]/g, '').padStart(length, ' ');
    return (
      <div className="flex gap-0.5">
        {s.split('').map((char, i) => (
          <div key={i} className={`w-5 h-7 border border-${color} bg-white flex items-center justify-center text-[11px] font-bold text-slate-800`}>
            {char === ' ' ? '' : char}
          </div>
        ))}
      </div>
    );
  };

  const renderFS5Report = () => {
    if (!activeStatReport || activeStatReport !== 'FS5') return null;
    const now = new Date();
    const monthIndex = String(now.getMonth() + 1).padStart(2, '0');
    const yearStr = String(now.getFullYear());
    const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-sm w-full max-w-5xl p-10 space-y-6 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border-2 border-slate-300 font-sans text-slate-900">
              <button onClick={() => setActiveStatReport(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              
              {/* Official Header */}
              <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4">
                 <div className="flex items-center gap-5">
                    <img src="https://logodix.com/logo/2012053.png" className="h-12 grayscale brightness-0" alt="Malta Tax" />
                    <div>
                       <h1 className="text-[12px] font-black uppercase leading-tight">Tax & Customs Administration</h1>
                       <p className="text-[10px] font-bold uppercase text-slate-500">Malta</p>
                    </div>
                 </div>
                 <div className="text-center">
                    <h2 className="text-6xl font-black text-[#3B82F6] italic tracking-tighter">FS5</h2>
                 </div>
                 <div className="text-right">
                    <h2 className="text-[14px] font-black uppercase tracking-tight">Final Settlement System (FSS)</h2>
                    <p className="text-[11px] uppercase font-medium">Payer's Monthly Payment Advice</p>
                 </div>
              </div>

              <div className="grid grid-cols-12 gap-8">
                 {/* A. PAYER INFORMATION */}
                 <div className="col-span-7 space-y-3">
                    <div className="bg-[#3B82F6] text-white px-3 py-1 text-[11px] font-black uppercase">A PAYER INFORMATION</div>
                    <div className="border border-slate-200 p-5 space-y-4">
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Business Name</label>
                          <p className="text-xs font-black uppercase border-b border-slate-100 pb-1">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                       </div>
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Business Address</label>
                          <p className="text-[10px] font-bold uppercase leading-relaxed">{organization?.address || 'N/A'}</p>
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Telephone Number</label>
                             <p className="text-xs font-black border-b border-slate-100 pb-1">{organization?.phone || 'N/A'}</p>
                          </div>
                          <div>
                             <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Email Address</label>
                             <p className="text-xs font-black border-b border-slate-100 pb-1 lowercase">{organization?.email || 'N/A'}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Top Right Controls */}
                 <div className="col-span-5 flex flex-col justify-between py-6">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black uppercase text-slate-700">Payer P.E. No.</label>
                       <div className="flex gap-2 items-center">
                          <span className="text-[9px] font-bold">A1</span>
                          <DigitBox value={organization?.peNumber || '12522'} length={6} />
                       </div>
                    </div>
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black uppercase text-slate-700">Payment for Month of</label>
                       <div className="flex gap-2 items-center">
                          <span className="text-[9px] font-bold">A2</span>
                          <DigitBox value={`${monthIndex}${yearStr}`} length={6} />
                       </div>
                    </div>
                 </div>

                 {/* B. NUMBER OF PAYEES */}
                 <div className="col-span-12 space-y-3">
                    <div className="bg-[#3B82F6] text-white px-3 py-1 text-[11px] font-black uppercase">B NUMBER OF PAYEES</div>
                    <div className="border border-slate-200 p-4 flex justify-between items-center">
                       <label className="text-[10px] font-bold text-slate-700">Number of Payees (FSS Main Method applies)</label>
                       <div className="flex gap-2 items-center">
                          <span className="text-[9px] font-bold">B1</span>
                          <DigitBox value={stats.totalPayees} length={8} />
                       </div>
                    </div>
                 </div>

                 {/* C. GROSS EMOLUMENTS */}
                 <div className="col-span-12 space-y-3">
                    <div className="bg-[#3B82F6] text-white px-3 py-1 text-[11px] font-black uppercase">C GROSS EMOLUMENTS</div>
                    <div className="border border-slate-200 p-5 space-y-4">
                       <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-700">Gross Emoluments (FSS Main or FSS Other applies)</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-lg font-bold text-slate-300">€</span>
                             <span className="text-[9px] font-bold">C1</span>
                             <DigitBox value={stats.totalPayrollGross.toFixed(2)} length={10} />
                          </div>
                       </div>
                       <div className="flex justify-between items-center bg-slate-50 p-2">
                          <label className="text-[10px] font-black uppercase text-slate-900 italic">Total Gross Emoluments and Fringe Benefits</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-lg font-bold text-slate-300">€</span>
                             <span className="text-[9px] font-bold">C4</span>
                             <DigitBox value={stats.totalPayrollGross.toFixed(2)} length={10} />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* D. TAX DEDUCTIONS AND SSC */}
                 <div className="col-span-12 space-y-3">
                    <div className="bg-[#3B82F6] text-white px-3 py-1 text-[11px] font-black uppercase">D TAX DEDUCTIONS AND SSC DUE TO THE COMMISSIONER</div>
                    <div className="border border-slate-200 p-5 grid grid-cols-2 gap-12">
                       <div className="space-y-4">
                          <div className="flex justify-between items-center">
                             <label className="text-[10px] font-bold text-slate-700">Tax Deductions (Main/Other)</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">D1</span>
                                <DigitBox value={stats.totalPayrollTax.toFixed(2)} length={8} />
                             </div>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                             <label className="text-[10px] font-black uppercase text-slate-900">Total Tax Deductions</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">D4</span>
                                <DigitBox value={stats.totalPayrollTax.toFixed(2)} length={8} />
                             </div>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center">
                             <label className="text-[10px] font-bold text-slate-700">Social Security Contributions</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">D5</span>
                                <DigitBox value={stats.totalNI_Due.toFixed(2)} length={8} />
                             </div>
                          </div>
                          <div className="flex justify-between items-center">
                             <label className="text-[10px] font-bold text-slate-700">Maternity Fund Contributions</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">D5a</span>
                                <DigitBox value={stats.maternityFund.toFixed(2)} length={8} />
                             </div>
                          </div>
                          <div className="flex justify-between items-center bg-indigo-50 p-3 border-2 border-[#3B82F6]">
                             <label className="text-[11px] font-black uppercase text-[#3B82F6]">Total Due to Commissioner</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">D6</span>
                                <DigitBox value={stats.totalDue.toFixed(2)} length={10} color="blue-500" />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* E. PAYMENT DETAILS */}
                 <div className="col-span-12 space-y-3">
                    <div className="bg-[#3B82F6] text-white px-3 py-1 text-[11px] font-black uppercase">E PAYMENT DETAILS</div>
                    <div className="border border-slate-200 p-6 grid grid-cols-2 gap-12">
                       <div className="space-y-6">
                          <div className="flex justify-between items-center">
                             <label className="text-[10px] font-black uppercase text-slate-600">Date of Payment</label>
                             <DigitBox value={new Date().toLocaleDateString('en-GB').replace(/\//g, '')} length={8} />
                          </div>
                          <div>
                             <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
                             <p className="text-xs font-black uppercase border-b border-slate-200 pb-1">{currentUserObj.name || organization?.name}</p>
                          </div>
                          <div>
                             <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Signature</label>
                             <div className="h-10 italic font-serif text-2xl border-b border-slate-200 opacity-60">
                                {currentUserObj.name?.split(' ')[0] || 'Dina'}
                             </div>
                          </div>
                       </div>
                       <div className="space-y-6 flex flex-col justify-between">
                          <div className="flex justify-between items-center">
                             <label className="text-[11px] font-black uppercase text-slate-900">Total Payment</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-bold">E1</span>
                                <DigitBox value={stats.totalDue.toFixed(2)} length={10} />
                             </div>
                          </div>
                          <div className="pt-10">
                             <p className="text-[8px] text-slate-400 italic leading-tight text-center uppercase">
                                This form is to be sent to the Malta Tax and Customs Administration with the Monthly remittance.
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-4 flex justify-between items-center no-print">
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">SYSTEM_GENERATED_OFFICIAL_FS5_REPLICA</p>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-10 py-3 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-xl">Print Advice</button>
                    <button onClick={() => setActiveStatReport(null)} className="bg-slate-100 text-slate-500 px-10 py-3 rounded-sm font-black uppercase text-[10px] tracking-widest border border-slate-200">Close</button>
                 </div>
              </div>
           </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-24">
      {renderFS5Report()}
      <header className="flex flex-col space-y-0.5 px-2">
        <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[7px]">Finance Control</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase leading-tight font-brand">Finance Studio</h1>
      </header>

      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl w-fit shadow-inner">
          <button onClick={() => setActiveModule('payroll')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'payroll' ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Payroll</button>
          <button onClick={() => setActiveModule('invoicing')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'invoicing' ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Invoicing</button>
          <button onClick={() => setActiveModule('records')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'records' ? 'bg-white text-[#0D9488] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Statutory</button>
      </div>

      {activeModule === 'records' && (
         <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div onClick={() => setActiveStatReport('FS5')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:border-blue-200 transition-all cursor-pointer group">
                   <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📄</div>
                   <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">FS5 Monthly Payment</h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">Payer's Monthly Payment Advice for Tax & NI.</p>
                   </div>
                </div>
            </div>
         </div>
      )}

      {activeModule === 'payroll' && (
        <div className="space-y-4">
           <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-left-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Active Payroll Pipeline</h3>
              <div className="space-y-2">
                  {users.filter(u => u.status === 'active' && ['housekeeping', 'driver', 'cleaner', 'supervisor', 'admin', 'laundry'].includes(u.role)).map(staff => (
                    <div key={staff.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-3 md:p-4 flex items-center justify-between gap-4 hover:border-teal-200 transition-all">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden shrink-0">
                              {staff.photoUrl ? <img src={staff.photoUrl} className="w-full h-full object-cover" /> : staff.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 uppercase truncate">{staff.name}</h4>
                              <p className="text-[8px] text-slate-400 uppercase font-bold truncate">
                                {staff.role} • {staff.maritalStatus || 'Single'} {staff.isParent ? `(Parent)` : ''}
                              </p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPayslipUserId(staff.id)} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-sm hover:bg-black transition-all shrink-0">PROCESS</button>
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {selectedPayslipUserId && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#F0FDFA] rounded-2xl w-full max-w-5xl h-[85vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
              <button onClick={() => setSelectedPayslipUserId(null)} className="absolute top-6 right-6 text-slate-400 hover:text-black text-xl">&times;</button>
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
