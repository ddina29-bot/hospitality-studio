
import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Shift, User, Property, Invoice, Client, InvoiceItem, OrganizationSettings, ManualTask, SavedPayslip } from '../../types';
import PersonnelProfile, { getCleanerRateForShift } from '../PersonnelProfile';

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
  const [recordsSubView, setRecordsSubView] = useState<'payouts' | 'invoices' | 'statutory'>('payouts');
  const [selectedPayslipUserId, setSelectedPayslipUserId] = useState<string | null>(null);
  const [activeStatReport, setActiveStatReport] = useState<'FS3' | 'VAT' | 'SSC' | null>(null);
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ clientId: '', startDate: '', endDate: '', dueDate: '', discountRate: 0 });
  const [generatedPreview, setGeneratedPreview] = useState<Invoice | null>(null);

  const stats = useMemo(() => {
    const totalBilled = (invoices || []).reduce((acc, i) => acc + (i.totalAmount || 0), 0);
    const pendingPay = (invoices || []).filter(i => i.status === 'sent').reduce((acc, i) => acc + (i.totalAmount || 0), 0);
    const totalVat = (invoices || []).reduce((acc, i) => acc + (i.vat || 0), 0);
    
    let totalPayrollGross = 0;
    let totalPayrollTax = 0;
    let totalPayrollNI = 0;

    users.forEach(u => u.payslips?.forEach(ps => {
      totalPayrollGross += ps.grossPay;
      totalPayrollTax += ps.tax;
      totalPayrollNI += ps.ni;
    }));

    return { totalBilled, pendingPay, totalVat, totalPayrollGross, totalPayrollTax, totalPayrollNI };
  }, [invoices, users]);

  const handleStatReport = (type: 'FS3' | 'VAT' | 'SSC') => setActiveStatReport(type);

  const renderStatReport = () => {
    if (!activeStatReport) return null;
    const year = new Date().getFullYear();
    const titleMap = { FS3: 'Annual Employee Summary', VAT: 'Quarterly VAT Liability', SSC: 'Social Security Compliance' };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[600] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-3xl p-14 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => setActiveStatReport(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              <header className="border-b-2 border-slate-900 pb-8 flex justify-between items-end">
                 <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{organization?.name || 'RESET STUDIO'}</h1>
                    <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">STATUTORY REPORT • {activeStatReport}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">FISCAL PERIOD</p>
                    <p className="text-lg font-black text-slate-900 uppercase">JAN - DEC {year}</p>
                 </div>
              </header>

              <div className="space-y-8">
                 <h2 className="text-xl font-bold text-slate-900 uppercase border-l-4 border-[#0D9488] pl-4">{titleMap[activeStatReport]}</h2>
                 
                 {activeStatReport === 'FS3' && (
                    <div className="grid grid-cols-2 gap-8">
                        <div className="p-6 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Aggregate Gross Payouts</p>
                            <p className="text-2xl font-black text-slate-900">€{stats.totalPayrollGross.toFixed(2)}</p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Withheld PAYE Tax</p>
                            <p className="text-2xl font-black text-rose-600">€{stats.totalPayrollTax.toFixed(2)}</p>
                        </div>
                    </div>
                 )}

                 {activeStatReport === 'VAT' && (
                    <div className="grid grid-cols-2 gap-8">
                        <div className="p-6 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Taxable Sales</p>
                            <p className="text-2xl font-black text-slate-900">€{stats.totalBilled.toFixed(2)}</p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Output VAT Due (18%)</p>
                            <p className="text-2xl font-black text-emerald-600">€{stats.totalVat.toFixed(2)}</p>
                        </div>
                    </div>
                 )}

                 {activeStatReport === 'SSC' && (
                    <div className="p-8 bg-slate-900 rounded-[2rem] text-white">
                        <p className="text-[8px] font-black text-teal-400 uppercase tracking-[0.4em] mb-4">NI Social Security Ledger</p>
                        <div className="flex justify-between items-center border-b border-white/10 pb-6 mb-6">
                            <span className="text-xs uppercase font-bold text-slate-400 tracking-widest">Total NI Payout Requirement</span>
                            <span className="text-3xl font-black text-white">€{stats.totalPayrollNI.toFixed(2)}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 italic">This figure reflects the total Class 1 NI contributions calculated across all employee payslips for the current fiscal cycle.</p>
                    </div>
                 )}
              </div>

              <div className="pt-10 border-t border-slate-100 flex justify-between items-center no-print">
                 <button onClick={() => window.print()} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">EXPORT OFFICIAL PDF</button>
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">DIGITALLY_VERIFIED_BY_RESET_SYSTEM</p>
              </div>
           </div>
        </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      {renderStatReport()}
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
                {[
                  { id: 'FS3', name: 'FS3 ANNUAL SUMMARIES', icon: '📝', desc: 'Year-end tax statements for personnel.' },
                  { id: 'VAT', name: 'VAT QUARTERLY LOGS', icon: '📊', desc: 'Consolidated VAT data exports.' },
                  { id: 'SSC', name: 'SSC COMPLIANCE', icon: '🛡️', desc: 'Social Security payment verification files.' }
                ].map((doc) => (
                  <div key={doc.id} onClick={() => handleStatReport(doc.id as any)} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4 hover:border-teal-200 transition-all cursor-pointer group">
                     <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{doc.icon}</div>
                     <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{doc.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{doc.desc}</p>
                     </div>
                     <button className="text-[8px] font-black text-teal-600 uppercase tracking-widest border-b-2 border-teal-600 pb-0.5 group-hover:text-teal-800 group-hover:border-teal-800 transition-all">GENERATE REPORT</button>
                  </div>
                ))}
            </div>
            
            <div className="bg-indigo-900/5 p-10 rounded-[3rem] border border-indigo-100 space-y-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Archived Financial Objects</h3>
               <div className="flex gap-4 border-b border-indigo-100">
                  <button onClick={() => setRecordsSubView('payouts')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${recordsSubView === 'payouts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>Payouts History</button>
                  <button onClick={() => setRecordsSubView('invoices')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${recordsSubView === 'invoices' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>Invoice History</button>
               </div>
               
               {recordsSubView === 'payouts' && (
                  <div className="overflow-x-auto bg-white rounded-3xl shadow-sm border border-slate-100">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                           <tr><th className="px-8 py-4">Operator</th><th className="px-8 py-4">Reference</th><th className="px-8 py-4 text-right">Net (€)</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {users.flatMap(u => (u.payslips || []).map(ps => (
                              <tr key={ps.id} className="hover:bg-slate-50">
                                 <td className="px-8 py-5 text-[11px] font-bold text-slate-900 uppercase">{u.name}</td>
                                 <td className="px-8 py-5 text-[10px] font-black text-slate-400">{ps.month}</td>
                                 <td className="px-8 py-5 text-right text-sm font-black text-slate-900">€{ps.netPay.toFixed(2)}</td>
                              </tr>
                           )))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
      )}

      {activeModule === 'payroll' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-left-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Awaiting Processing</h3>
              <div className="space-y-4">
                  {users.filter(u => u.status === 'active' && ['cleaner', 'supervisor', 'driver'].includes(u.role)).map(staff => (
                    <div key={staff.id} className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-teal-200 transition-all">
                        <div className="flex items-center gap-6 flex-1 w-full text-left">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                              {staff.name.charAt(0)}
                          </div>
                          <div>
                              <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{staff.name}</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                                {staff.role} • {staff.paymentType} • Rate: €{staff.payRate}
                              </p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPayslipUserId(staff.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">OPEN LEDGER</button>
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
