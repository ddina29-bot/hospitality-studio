
import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Shift, User, Property, Invoice, Client, InvoiceItem, OrganizationSettings, ManualTask, SavedPayslip } from '../../types';
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
  setActiveTab, onLogout, shifts = [], setShifts, users = [], properties = [], invoices = [], setInvoices, clients = [], organization, manualTasks = [], onUpdateUser
}) => {
  const [activeModule, setActiveModule] = useState<'payroll' | 'invoicing' | 'records'>('payroll');
  const [payrollSubView, setPayrollSubView] = useState<'pending' | 'registry'>('pending');
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  
  const [recordsSearch, setRecordsSearch] = useState('');
  const [viewingRecordsUser, setViewingRecordsUser] = useState<User | null>(null);
  const [initialDocMode, setInitialDocMode] = useState<'fs3' | 'payslip' | 'worksheet' | null>(null);
  const [selectedHistoricalPayslip, setSelectedHistoricalPayslip] = useState<SavedPayslip | null>(null);
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    dueDate: '',
    discountRate: 0 
  });
  
  const [generatedPreview, setGeneratedPreview] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    const q = invoiceSearch.toLowerCase();
    return invoices.filter(i => 
      i.invoiceNumber.toLowerCase().includes(q) || 
      i.clientName.toLowerCase().includes(q)
    );
  }, [invoices, invoiceSearch]);

  const filteredRecordsUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                            u.role.toLowerCase().includes(recordsSearch.toLowerCase());
      const isEmployee = ['cleaner', 'supervisor', 'driver', 'housekeeping', 'maintenance', 'laundry'].includes(u.role);
      return matchesSearch && isEmployee;
    }).sort((a, b) => {
        if (a.status === 'inactive' && b.status !== 'inactive') return 1;
        if (a.status !== 'inactive' && b.status === 'inactive') return -1;
        return a.name.localeCompare(b.name);
    });
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

  const allSavedPayslips = useMemo(() => {
    const list: (SavedPayslip & { userName: string, userId: string, userObj: User })[] = [];
    users.forEach(u => {
      if (u.payslips) {
        u.payslips.forEach(ps => {
          list.push({ ...ps, userName: u.name, userId: u.id, userObj: u });
        });
      }
    });
    return list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [users]);

  const calculatePayslipBreakdown = (staffShifts: Shift[], staff: User) => {
    let totalBase = 0;
    let totalBonus = 0;
    let totalHours = 0;

    staffShifts.forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (!prop && s.serviceType !== 'TO FIX') return;
      
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = durationMs / (1000 * 60 * 60);
      totalHours += hours;
      const hourlyRate = staff.payRate || 5.00;
      const basePay = hours * hourlyRate;
      const isApproved = s.approvalStatus === 'approved';

      if (s.serviceType === 'TO FIX') {
          if (s.fixWorkPayment && s.fixWorkPayment > 0) totalBonus += s.fixWorkPayment;
          else totalBase += basePay;
          return;
      }

      if (s.serviceType === 'Common Area') {
          if (s.fixWorkPayment && s.fixWorkPayment > 0) totalBonus += s.fixWorkPayment;
          else totalBase += basePay;
          return;
      }

      totalBase += basePay;
      
      if (isApproved && prop && staff.role === 'cleaner' && staff.paymentType === 'Per Clean') {
        const teamCount = s.userIds?.length || 1;
        const targetFee = prop.serviceRates?.[s.serviceType] !== undefined ? prop.serviceRates[s.serviceType] : prop.cleanerPrice;
        totalBonus += Math.max(0, (targetFee / teamCount) - basePay);
      }
    });

    return { totalBase, totalBonus, totalHours, totalNet: totalBase + totalBonus };
  };

  const activePayslip = useMemo(() => {
    if (!selectedPayslipId) return null;
    const entry = cleanerPayroll.find(p => p.user.id === selectedPayslipId);
    if (!entry) return null;
    return { ...entry, breakdown: calculatePayslipBreakdown(entry.shifts, entry.user) };
  }, [selectedPayslipId, cleanerPayroll, properties]);

  const handleMarkPayrollPaid = () => {
    if (!activePayslip || !setShifts) return;
    const shiftIds = activePayslip.shifts.map(s => s.id);
    const now = new Date().toISOString();
    setShifts(prev => prev.map(s => shiftIds.includes(s.id) ? { ...s, paid: true, payoutDate: now } : s));
    setSelectedPayslipId(null);
    alert(`Payment confirmed for ${activePayslip.user.name}.`);
  };

  const handlePreviewInvoice = () => {
    const { clientId, startDate, endDate, dueDate, discountRate } = invoiceForm;
    if (!clientId || !startDate || !endDate || !dueDate) {
      alert("Please define the client and period parameters.");
      return;
    }

    const client = clients?.find(c => c.id === clientId);
    if (!client) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const targetShifts = shifts.filter(s => {
      const dStr = s.date.includes('-') ? s.date : `${s.date} ${new Date().getFullYear()}`;
      const d = new Date(dStr);
      return s.propertyId && 
             properties.find(p => p.id === s.propertyId)?.clientId === clientId &&
             s.status === 'completed' &&
             s.approvalStatus !== 'pending' &&
             d >= start && d <= end;
    });

    const targetTasks = manualTasks.filter(t => {
      const d = new Date(t.date);
      return t.propertyId && 
             properties.find(p => p.id === t.propertyId)?.clientId === clientId &&
             t.status === 'completed' &&
             t.isBillable &&
             d >= start && d <= end;
    });

    const invoiceItems: InvoiceItem[] = [];

    targetShifts.forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (!prop) return;
      
      let amount = prop.clientPrice;
      if (s.serviceType === 'REFRESH') amount = prop.clientRefreshPrice || amount;
      else if (s.serviceType === 'MID STAY CLEANING') amount = prop.clientMidStayPrice || amount;
      
      invoiceItems.push({
        description: `${s.serviceType.toUpperCase()} - ${s.propertyName}`,
        date: s.date,
        amount
      });
    });

    targetTasks.forEach(t => {
      invoiceItems.push({
        description: `TASK: ${t.taskName.toUpperCase()} - ${t.propertyName}`,
        date: t.date,
        amount: t.billablePrice || 0
      });
    });

    if (invoiceItems.length === 0) {
      alert("No billable activity found for this client in the selected period.");
      return;
    }

    const subtotal = invoiceItems.reduce((acc, i) => acc + i.amount, 0);
    const discountAmount = subtotal * (discountRate / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vat = subtotalAfterDiscount * 0.18; 
    const totalAmount = subtotalAfterDiscount + vat;

    const preview: Invoice = {
      id: `inv-preview-${Date.now()}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      clientId: client.id,
      clientName: client.name,
      issueDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      dueDate: new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      periodStart: startDate,
      periodEnd: endDate,
      items: invoiceItems,
      subtotal,
      discount: discountAmount,
      vat,
      totalAmount,
      status: 'draft'
    };

    setGeneratedPreview(preview);
  };

  const handleSaveInvoice = () => {
    if (!generatedPreview || !setInvoices) return;
    setInvoices(prev => [{ ...generatedPreview, status: 'sent' }, ...prev]);
    setShowInvoiceModal(false);
    setGeneratedPreview(null);
    alert("Invoice finalized and added to registry.");
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1.5 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-emerald-500 transition-all shadow-inner";

  const activePreviewClient = useMemo(() => {
    if (!generatedPreview) return null;
    return clients?.find(c => c.id === generatedPreview.clientId);
  }, [generatedPreview, clients]);

  const handleOpenHistoricalDoc = (ps: SavedPayslip & { userObj: User }) => {
    setViewingRecordsUser(ps.userObj);
    setInitialDocMode('payslip');
    setSelectedHistoricalPayslip(ps);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col space-y-0.5 px-2">
        <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Financial Controller</p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-tight font-brand">CFO Dashboard</h1>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2">Manage payroll payouts, client billing, and statutory personnel documentation.</p>
      </header>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button onClick={() => setActiveModule('payroll')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'payroll' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Payroll</button>
          <button onClick={() => setActiveModule('invoicing')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'invoicing' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Invoicing</button>
          <button onClick={() => setActiveModule('records')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeModule === 'records' ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Records</button>
      </div>

      {activeModule === 'payroll' && (
        <div className="space-y-6">
           <div className="flex gap-4 px-2 border-b border-slate-100">
              <button onClick={() => setPayrollSubView('pending')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${payrollSubView === 'pending' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Pending Payouts</button>
              <button onClick={() => setPayrollSubView('registry')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${payrollSubView === 'registry' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Payslip Registry</button>
           </div>

           {payrollSubView === 'pending' ? (
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-left-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Awaiting Processing</h3>
                  <div className="space-y-4">
                      {cleanerPayroll.map(entry => {
                          const totals = calculatePayslipBreakdown(entry.shifts, entry.user);
                          return (
                          <div key={entry.user.id} className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-teal-200 transition-all">
                              <div className="flex items-center gap-6 flex-1 w-full">
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                                    {entry.user.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{entry.user.name}</h4>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                                      {entry.shifts.length} Deployments • {totals.totalHours.toFixed(1)} Hours Logged
                                    </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">NET PAYABLE</p>
                                    <p className="text-2xl font-bold text-emerald-600">€{totals.totalNet.toFixed(2)}</p>
                                </div>
                                <button onClick={() => setSelectedPayslipId(entry.user.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">DETAILS</button>
                              </div>
                          </div>
                          );
                      })}
                      {cleanerPayroll.length === 0 && <p className="text-center py-20 text-[10px] opacity-20 font-black uppercase">No pending payroll processing needed</p>}
                  </div>
              </div>
           ) : (
              <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden animate-in slide-in-from-right-4">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4">Employee</th>
                             <th className="px-8 py-4">Month</th>
                             <th className="px-8 py-4">Period</th>
                             <th className="px-8 py-4">Gross (€)</th>
                             <th className="px-8 py-4">Net (€)</th>
                             <th className="px-8 py-4 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {allSavedPayslips.length === 0 ? (
                            <tr><td colSpan={6} className="px-8 py-20 text-center opacity-20 text-[10px] uppercase font-black">No historical payslips in registry</td></tr>
                          ) : allSavedPayslips.map(ps => (
                             <tr key={ps.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleOpenHistoricalDoc(ps)}>
                                <td className="px-8 py-5">
                                   <p className="text-[11px] font-bold text-slate-900 uppercase">{ps.userName}</p>
                                   <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mt-0.5">{ps.userObj.role}</p>
                                </td>
                                <td className="px-8 py-5 text-[10px] font-black text-slate-900">{ps.month}</td>
                                <td className="px-8 py-5 text-[9px] font-bold text-slate-400">{ps.periodFrom.split('-').reverse().join('/')} - {ps.periodUntil.split('-').reverse().join('/')}</td>
                                <td className="px-8 py-5 text-[11px] font-bold text-slate-900">€{ps.grossPay.toFixed(2)}</td>
                                <td className="px-8 py-5 text-[11px] font-black text-emerald-600">€{ps.netPay.toFixed(2)}</td>
                                <td className="px-8 py-5 text-right">
                                   <button className="text-[8px] font-black bg-white border border-slate-200 text-slate-400 px-4 py-1.5 rounded-lg uppercase tracking-widest group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all">VIEW DOC</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}
        </div>
      )}

      {activeModule === 'invoicing' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="bg-white px-8 py-6 rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-12 w-full md:w-auto">
                    <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">TOTAL BILLED</p>
                        <p className="text-2xl font-bold text-slate-900 leading-none">€{invoices?.reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">PENDING PAY</p>
                        <p className="text-2xl font-bold text-emerald-600 leading-none">€{invoices?.filter(i => i.status === 'sent').reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setGeneratedPreview(null); setShowInvoiceModal(true); }} 
                    className="h-12 px-10 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-1">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    GENERATE INVOICE
                </button>
            </div>

            <section className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                   <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Invoice Registry</h3>
                   <div className="relative w-full md:w-64">
                      <input 
                        type="text" 
                        placeholder="Search invoices..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-full px-5 py-2.5 text-[10px] font-bold uppercase outline-none focus:bg-white focus:border-emerald-400 transition-all"
                        value={invoiceSearch}
                        onChange={e => setInvoiceSearch(e.target.value)}
                      />
                   </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                           <tr>
                              <th className="px-8 py-4">Invoice #</th>
                              <th className="px-8 py-4">Client</th>
                              <th className="px-8 py-4">Issue Date</th>
                              <th className="px-8 py-4">Amount</th>
                              <th className="px-8 py-4 Status">Status</th>
                              <th className="px-8 py-4 text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {filteredInvoices.length === 0 ? (
                             <tr><td colSpan={6} className="px-8 py-20 text-center text-[10px] font-black uppercase text-slate-300 italic">No invoices found in registry</td></tr>
                           ) : filteredInvoices.map(inv => (
                             <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 text-[11px] font-bold text-slate-900">{inv.invoiceNumber}</td>
                                <td className="px-8 py-5 text-[11px] font-bold text-slate-600 uppercase">{inv.clientName}</td>
                                <td className="px-8 py-5 text-[10px] text-slate-400 font-bold">{inv.issueDate}</td>
                                <td className="px-8 py-5 text-[11px] font-black text-slate-900">€{inv.totalAmount.toFixed(2)}</td>
                                <td className="px-8 py-5">
                                   <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                     inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                     inv.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                                     'bg-blue-100 text-blue-700'
                                   }`}>
                                      {inv.status}
                                   </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                   <button className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Download PDF</button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
      )}

      {activeModule === 'records' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Employee Archive</h3>
                 <div className="relative w-full md:w-80">
                    <input 
                      type="text" 
                      placeholder="SEARCH STAFF..." 
                      className="w-full bg-slate-50 border border-slate-200 rounded-full px-6 py-3 text-[11px] text-slate-900 font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-teal-400"
                      value={recordsSearch}
                      onChange={(e) => setRecordsSearch(e.target.value)}
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {filteredRecordsUsers.map(u => (
                    <div key={u.id} className="p-6 rounded-3xl border border-slate-100 flex flex-col gap-4 bg-white hover:border-teal-200 transition-all group">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                             {u.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900 uppercase leading-none">{u.name}</h4>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1.5">{u.role}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode('payslip'); setSelectedHistoricalPayslip(null); }} className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">PAYSLIPS</button>
                          <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode(null); setSelectedHistoricalPayslip(null); }} className="px-4 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100">DOSSIER</button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* GENERATE INVOICE MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white border border-slate-200 rounded-[50px] w-full max-w-4xl p-8 md:p-12 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setShowInvoiceModal(false); setGeneratedPreview(null); }} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900">&times;</button>
              
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tighter">Invoicing Terminal</h2>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.4em]">Client Billing Lifecycle</p>
              </div>

              {!generatedPreview ? (
                <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                         <label className={labelStyle}>Select Partner / Client</label>
                         <select 
                            className={inputStyle} 
                            value={invoiceForm.clientId} 
                            onChange={e => setInvoiceForm({...invoiceForm, clientId: e.target.value})}
                         >
                            <option value="">CHOOSE CLIENT...</option>
                            {clients?.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className={labelStyle}>Start Date</label>
                         <input type="date" className={inputStyle} value={invoiceForm.startDate} onChange={e => setInvoiceForm({...invoiceForm, startDate: e.target.value})} />
                      </div>
                      <div>
                         <label className={labelStyle}>End Date</label>
                         <input type="date" className={inputStyle} value={invoiceForm.endDate} onChange={e => setInvoiceForm({...invoiceForm, endDate: e.target.value})} />
                      </div>
                      <div>
                         <label className={labelStyle}>Payment Due Date</label>
                         <input type="date" className={inputStyle} value={invoiceForm.dueDate} onChange={e => setInvoiceForm({...invoiceForm, dueDate: e.target.value})} />
                      </div>
                      <div>
                         <label className={labelStyle}>Discount Rate (%)</label>
                         <input 
                            type="number" 
                            step="1"
                            min="0"
                            max="100"
                            className={inputStyle} 
                            value={invoiceForm.discountRate} 
                            onChange={e => setInvoiceForm({...invoiceForm, discountRate: parseFloat(e.target.value) || 0})}
                            placeholder="0" 
                         />
                      </div>
                   </div>
                   <button 
                      onClick={handlePreviewInvoice}
                      className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all hover:bg-emerald-700"
                   >
                      AGGREGATE BILLABLES
                   </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                   <div className="bg-slate-50 p-6 md:p-10 rounded-[2.5rem] border border-slate-200 space-y-10">
                      <div className="grid grid-cols-2 gap-10">
                         <div className="text-left space-y-4">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">BILL TO</p>
                            <div>
                               <p className="text-sm font-black text-slate-900 uppercase leading-none">{generatedPreview.clientName}</p>
                               {activePreviewClient && (
                                  <div className="mt-3 space-y-1.5">
                                     <p className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed">{activePreviewClient.billingAddress}</p>
                                     <div className="flex flex-col gap-0.5">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">VAT: {activePreviewClient.vatNumber || '---'}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">{activePreviewClient.contactEmail}</p>
                                     </div>
                                  </div>
                               )}
                            </div>
                         </div>

                         <div className="text-right space-y-4">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">FROM</p>
                            <div>
                               <p className="text-sm font-black text-slate-900 uppercase leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                               <div className="mt-3 space-y-1.5">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed">{organization?.address}</p>
                                  <div className="flex flex-col gap-0.5">
                                     <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">VAT: {organization?.taxId || '---'}</p>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="flex justify-between items-center border-y border-slate-200 py-6">
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">INVOICE NO.</p>
                            <p className="text-sm font-black text-slate-900">{generatedPreview.invoiceNumber}</p>
                         </div>
                         <div className="space-y-1 text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ISSUE DATE</p>
                            <p className="text-sm font-black text-slate-900">{generatedPreview.issueDate}</p>
                         </div>
                         <div className="space-y-1 text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PAYMENT DUE</p>
                            <p className="text-sm font-black text-emerald-600">{generatedPreview.dueDate}</p>
                         </div>
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                        {generatedPreview.items.map((item, idx) => (
                           <div key={idx} className="flex justify-between items-center text-[10px] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="text-left">
                                 <p className="font-bold text-slate-900 uppercase tracking-tight">{item.description}</p>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mt-1">{item.date}</p>
                              </div>
                              <span className="font-mono font-bold text-slate-600">€{item.amount.toFixed(2)}</span>
                           </div>
                        ))}
                      </div>

                      <div className="space-y-3 pt-6 text-right">
                         <div className="flex justify-end gap-12 text-[10px] font-bold text-slate-500 uppercase">
                            <span>Subtotal</span>
                            <span className="w-20">€{generatedPreview.subtotal?.toFixed(2)}</span>
                         </div>
                         {generatedPreview.discount && generatedPreview.discount > 0 && (
                            <div className="flex justify-end gap-12 text-[10px] font-black text-rose-600 uppercase">
                               <span>Discount ({invoiceForm.discountRate}%)</span>
                               <span className="w-20">-€{generatedPreview.discount.toFixed(2)}</span>
                            </div>
                         )}
                         <div className="flex justify-end gap-12 text-[10px] font-bold text-slate-500 uppercase">
                            <span>VAT (18%)</span>
                            <span className="w-20">€{generatedPreview.vat?.toFixed(2)}</span>
                         </div>
                         <div className="bg-emerald-600 inline-flex items-center gap-10 px-8 py-3 rounded-[1.2rem] mt-4 shadow-xl">
                            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">TOTAL AMOUNT DUE</span>
                            <p className="text-2xl font-black text-white">€{generatedPreview.totalAmount.toFixed(2)}</p>
                         </div>
                      </div>
                   </div>

                   <div className="flex gap-4">
                      <button 
                        onClick={handleSaveInvoice}
                        className="flex-[2] bg-slate-900 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all hover:bg-black"
                      >
                        FINALIZE & REGISTER
                      </button>
                      <button 
                        onClick={() => setGeneratedPreview(null)}
                        className="flex-1 bg-white border border-slate-200 text-slate-400 font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[11px] hover:bg-slate-50 transition-all"
                      >
                        EDIT PARAMETERS
                      </button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}

      {selectedPayslipId && activePayslip && (
        <div className="fixed inset-0 bg-slate-900/90 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white border border-slate-200 rounded-[50px] w-full max-w-2xl p-10 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => setSelectedPayslipId(null)} className="absolute top-10 right-10 text-slate-400 hover:text-slate-900 transition-colors">&times;</button>
              <header className="space-y-4">
                 <div>
                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.5em] mb-1">Pay Period Finalization</p>
                    <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tighter">Earnings Summary</h2>
                 </div>
              </header>
              <div className="bg-emerald-600 p-10 rounded-[32px] flex flex-col sm:flex-row justify-between items-center gap-6 shadow-xl shadow-emerald-900/20">
                <div className="text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">NET PAYOUT</p>
                    <p className="text-5xl font-bold tracking-tighter">€{activePayslip.breakdown.totalNet.toFixed(2)}</p>
                </div>
                <button onClick={handleMarkPayrollPaid} className="w-full sm:w-auto bg-white text-emerald-700 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:bg-emerald-50 transition-all active:scale-95">Confirm Payout</button>
              </div>
           </div>
        </div>
      )}

      {viewingRecordsUser && (
        <div className="fixed inset-0 bg-slate-900/60 z-[700] flex items-center justify-center p-0 md:p-6 backdrop-blur-md overflow-hidden">
           <div className="bg-white w-full h-full md:rounded-[3rem] overflow-hidden flex flex-col relative animate-in zoom-in-95">
              <div className="flex justify-between items-center px-8 py-4 bg-white border-b border-slate-100 shrink-0">
                 <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Personnel Review: {viewingRecordsUser.name}</h3>
                 </div>
                 <button 
                   onClick={() => { setViewingRecordsUser(null); setInitialDocMode(null); setSelectedHistoricalPayslip(null); }}
                   className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all"
                 >
                   &times;
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                 <PersonnelProfile 
                   user={viewingRecordsUser}
                   shifts={shifts}
                   properties={properties}
                   organization={organization}
                   initialDocView={initialDocMode}
                   initialHistoricalPayslip={selectedHistoricalPayslip}
                   onUpdateUser={onUpdateUser}
                 />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;
