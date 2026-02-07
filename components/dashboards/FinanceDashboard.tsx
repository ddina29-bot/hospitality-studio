
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
  setActiveTab, onLogout, shifts = [], setShifts, users = [], properties = [], invoices = [], setInvoices, clients = [], organization, manualTasks = [], onUpdateUser
}) => {
  const [activeModule, setActiveModule] = useState<'payroll' | 'invoicing' | 'records'>('payroll');
  const [payrollSubView, setPayrollSubView] = useState<'pending' | 'registry'>('pending');
  const [recordsSubView, setRecordsSubView] = useState<'payouts' | 'invoices' | 'statutory'>('payouts');
  const [selectedPayslipUserId, setSelectedPayslipUserId] = useState<string | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    dueDate: '',
    discountRate: 0 
  });
  
  const [generatedPreview, setGeneratedPreview] = useState<Invoice | null>(null);

  const parseFinanceDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('-')) return new Date(dateStr);
    const currentYear = new Date().getFullYear();
    const d = new Date(`${dateStr} ${currentYear}`);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    const q = invoiceSearch.toLowerCase();
    return invoices.filter(i => 
      i.invoiceNumber.toLowerCase().includes(q) || 
      i.clientName.toLowerCase().includes(q)
    );
  }, [invoices, invoiceSearch]);

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

  const calculateTotalNet = (staffShifts: Shift[], staff: User) => {
    let totalPieceRateEarned = 0;
    let totalHourlyEarned = 0;
    let totalHours = 0;

    staffShifts.forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (!prop && s.serviceType !== 'TO FIX') return;
      
      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = Math.max(0, durationMs / (1000 * 60 * 60));
      totalHours += hours;
      const hourlyRate = staff.payRate || 5.00;
      const basePayForShift = hours * hourlyRate;

      if (s.approvalStatus === 'approved') {
        const teamCount = s.userIds?.length || 1;
        let flatRate = 0;
        if (s.serviceType === 'TO FIX') flatRate = s.fixWorkPayment || 0;
        else if (prop) flatRate = getCleanerRateForShift(s.serviceType, prop) / teamCount;

        if (staff.paymentType === 'Per Clean' || staff.paymentType === 'Fixed Wage') {
            totalPieceRateEarned += Math.max(flatRate, staff.paymentType === 'Fixed Wage' ? 0 : basePayForShift);
        } else {
            totalHourlyEarned += basePayForShift;
        }
      }
    });

    const gross = totalPieceRateEarned + totalHourlyEarned;
    const ni = gross * 0.1;
    const tax = gross * 0.15;
    return { totalHours, totalNet: Math.max(0, gross - ni - tax) };
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
      const d = parseFinanceDate(s.date);
      return s.propertyId && 
             properties.find(p => p.id === s.propertyId)?.clientId === clientId &&
             s.status === 'completed' &&
             s.approvalStatus !== 'pending' &&
             d >= start && d <= end;
    });

    const targetTasks = manualTasks?.filter(t => {
      const d = new Date(t.date);
      return t.propertyId && 
             properties.find(p => p.id === t.propertyId)?.clientId === clientId &&
             t.status === 'completed' &&
             t.isBillable &&
             d >= start && d <= end;
    }) || [];

    const invoiceItems: InvoiceItem[] = [];
    targetShifts.forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (!prop) return;
      let amount = prop.clientPrice;
      const type = s.serviceType.toUpperCase();
      if (type === 'REFRESH') amount = prop.clientRefreshPrice || amount;
      else if (type === 'MID STAY CLEANING') amount = prop.clientMidStayPrice || amount;
      invoiceItems.push({ description: `${s.serviceType.toUpperCase()} - ${s.propertyName}`, date: s.date, amount });
    });

    targetTasks.forEach(t => {
      invoiceItems.push({ description: `TASK: ${t.taskName.toUpperCase()} - ${t.propertyName}`, date: t.date, amount: t.billablePrice || 0 });
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

  const handleUpdateInvoiceStatus = (id: string, newStatus: 'paid' | 'overdue') => {
    if (!setInvoices) return;
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1.5 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#0D9488] transition-all shadow-inner";

  if (selectedPayslipUserId) {
    const targetUser = users.find(u => u.id === selectedPayslipUserId);
    if (!targetUser) {
        setSelectedPayslipUserId(null);
        return null;
    }
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <button 
                onClick={() => setSelectedPayslipUserId(null)}
                className="flex items-center gap-2 text-teal-600 font-black text-[10px] uppercase tracking-widest mb-4 hover:text-teal-700"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Finance Dashboard
            </button>
            <PersonnelProfile 
                user={targetUser} 
                shifts={shifts} 
                properties={properties} 
                organization={organization} 
                onUpdateUser={onUpdateUser}
                initialDocView="payslip"
            />
        </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col space-y-0.5 px-2">
        <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Financial Controller</p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-tight font-brand">Finance Studio</h1>
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
                          const totals = calculateTotalNet(entry.shifts, entry.user);
                          return (
                          <div key={entry.user.id} className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-teal-200 transition-all">
                              <div className="flex items-center gap-6 flex-1 w-full">
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center font-bold text-2xl shadow-sm">
                                    {entry.user.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{entry.user.name}</h4>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                                      {entry.user.paymentType} • {entry.shifts.length} Deployments • {totals.totalHours.toFixed(1)} Hrs
                                    </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">EST. NET PAYABLE</p>
                                    <p className="text-2xl font-bold text-emerald-600">€{totals.totalNet.toFixed(2)}</p>
                                </div>
                                <button onClick={() => setSelectedPayslipUserId(entry.user.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">GENERATE PAYSLIP</button>
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
                             <tr key={ps.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedPayslipUserId(ps.userId)}>
                                <td className="px-8 py-5">
                                   <p className="text-[11px] font-bold text-slate-900 uppercase">{ps.userName}</p>
                                   <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mt-0.5">{ps.userObj.role}</p>
                                </td>
                                <td className="px-8 py-5 text-[10px] font-black text-slate-900">{ps.month}</td>
                                <td className="px-8 py-5 text-[9px] font-bold text-slate-400">{ps.periodFrom} - {ps.periodUntil}</td>
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
                <button onClick={() => { setGeneratedPreview(null); setShowInvoiceModal(true); }} className="h-12 px-10 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-1"><path d="M12 5v14M5 12h14"/></svg>GENERATE INVOICE</button>
            </div>

            <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Invoice Registry</h3>
                    <div className="relative w-64">
                       <input 
                         type="text" 
                         placeholder="SEARCH INVOICES..." 
                         className="w-full bg-slate-50 border border-slate-100 rounded-full px-10 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-400 transition-all"
                         value={invoiceSearch}
                         onChange={e => setInvoiceSearch(e.target.value)}
                       />
                       <div className="absolute left-4 top-2 text-slate-300">🔍</div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4">Reference #</th>
                             <th className="px-8 py-4">Client</th>
                             <th className="px-8 py-4 text-center">Due Date</th>
                             <th className="px-8 py-4 text-center">Status</th>
                             <th className="px-8 py-4 text-right">Total (€)</th>
                             <th className="px-8 py-4 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredInvoices.length === 0 ? (
                             <tr><td colSpan={6} className="px-8 py-20 text-center opacity-20 text-[10px] uppercase font-black">No invoices match your search</td></tr>
                          ) : filteredInvoices.map(inv => (
                             <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 text-[11px] font-black text-slate-900">{inv.invoiceNumber}</td>
                                <td className="px-8 py-5">
                                   <p className="text-[11px] font-bold text-slate-900 uppercase">{inv.clientName}</p>
                                   <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mt-0.5">{inv.issueDate}</p>
                                </td>
                                <td className="px-8 py-5 text-center text-[10px] font-bold text-slate-500">{inv.dueDate}</td>
                                <td className="px-8 py-5 text-center">
                                   <span className={`px-4 py-1.5 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : inv.status === 'overdue' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                      {inv.status}
                                   </span>
                                </td>
                                <td className="px-8 py-5 text-right text-sm font-black text-slate-900">€{inv.totalAmount.toFixed(2)}</td>
                                <td className="px-8 py-5 text-right">
                                   <div className="flex justify-end gap-2">
                                      {inv.status !== 'paid' && (
                                         <button 
                                            onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')}
                                            className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"
                                         >
                                            MARK PAID
                                         </button>
                                      )}
                                      <button className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-lg">PDF</button>
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

      {activeModule === 'records' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           <div className="flex gap-4 px-2 border-b border-slate-100">
              <button onClick={() => setRecordsSubView('payouts')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${recordsSubView === 'payouts' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Payout Archive</button>
              <button onClick={() => setRecordsSubView('invoices')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${recordsSubView === 'invoices' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Invoice Archive</button>
              <button onClick={() => setRecordsSubView('statutory')} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${recordsSubView === 'statutory' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>Statutory Docs</button>
           </div>

           {recordsSubView === 'payouts' && (
             <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4">Recipient</th>
                             <th className="px-8 py-4">Reference Date</th>
                             <th className="px-8 py-4 text-right">Net Value (€)</th>
                             <th className="px-8 py-4 text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {allSavedPayslips.length === 0 ? (
                             <tr><td colSpan={4} className="px-8 py-20 text-center opacity-20 text-[10px] uppercase font-black">Archive is empty</td></tr>
                          ) : allSavedPayslips.map(ps => (
                             <tr key={ps.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-8 py-5">
                                   <p className="text-[11px] font-bold text-slate-900 uppercase">{ps.userName}</p>
                                   <p className="text-[7px] text-teal-600 font-black uppercase mt-0.5">{ps.month}</p>
                                </td>
                                <td className="px-8 py-5 text-[9px] font-bold text-slate-400 uppercase">{new Date(ps.generatedAt).toLocaleDateString()}</td>
                                <td className="px-8 py-5 text-right text-sm font-black text-slate-900">€{ps.netPay.toFixed(2)}</td>
                                <td className="px-8 py-5 text-right">
                                   <button onClick={() => setSelectedPayslipUserId(ps.userId)} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[8px] font-black uppercase">RETRIEVE</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
             </div>
           )}

           {recordsSubView === 'invoices' && (
             <div className="bg-white border border-slate-100 rounded-[40px] shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                             <th className="px-8 py-4">Client Partner</th>
                             <th className="px-8 py-4">Invoice #</th>
                             <th className="px-8 py-4 text-center">Status</th>
                             <th className="px-8 py-4 text-right">Value (€)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {invoices.length === 0 ? (
                             <tr><td colSpan={4} className="px-8 py-20 text-center opacity-20 text-[10px] uppercase font-black">Archive is empty</td></tr>
                          ) : invoices.map(inv => (
                             <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 text-[11px] font-bold text-slate-900 uppercase">{inv.clientName}</td>
                                <td className="px-8 py-5 text-[10px] font-black text-slate-400">{inv.invoiceNumber}</td>
                                <td className="px-8 py-5 text-center">
                                   <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{inv.status}</span>
                                </td>
                                <td className="px-8 py-5 text-right text-sm font-black text-slate-900">€{inv.totalAmount.toFixed(2)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
             </div>
           )}

           {recordsSubView === 'statutory' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: 'FS3 ANNUAL SUMMARIES', icon: '📝', desc: 'Year-end tax statements for personnel.' },
                  { name: 'VAT QUARTERLY LOGS', icon: '📊', desc: 'Consolidated VAT data exports.' },
                  { name: 'SSC COMPLIANCE', icon: '🛡️', desc: 'Social Security payment verification files.' }
                ].map((doc, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4 hover:border-teal-200 transition-all cursor-pointer">
                     <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl">{doc.icon}</div>
                     <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{doc.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{doc.desc}</p>
                     </div>
                     <button className="text-[8px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-600 pb-0.5">GENERATE REPORT</button>
                  </div>
                ))}
             </div>
           )}
        </div>
      )}

      {/* INVOICE GENERATION MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-[48px] w-full max-w-2xl p-10 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setShowInvoiceModal(false); setGeneratedPreview(null); }} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 text-2xl">&times;</button>
              <div className="space-y-1">
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Invoice Generator</h2>
                 <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.4em]">Service Consolidation Suite</p>
              </div>
              {!generatedPreview ? (
                 <div className="space-y-6">
                    <div>
                       <label className={labelStyle}>Select Client Partner</label>
                       <select className={inputStyle} value={invoiceForm.clientId} onChange={e => setInvoiceForm({...invoiceForm, clientId: e.target.value})}>
                          <option value="">CHOOSE RECIPIENT...</option>
                          {clients?.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className={labelStyle}>Deployment From</label><input type="date" className={inputStyle} value={invoiceForm.startDate} onChange={e => setInvoiceForm({...invoiceForm, startDate: e.target.value})} /></div>
                       <div><label className={labelStyle}>Deployment Until</label><input type="date" className={inputStyle} value={invoiceForm.endDate} onChange={e => setInvoiceForm({...invoiceForm, endDate: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className={labelStyle}>Official Due Date</label><input type="date" className={inputStyle} value={invoiceForm.dueDate} onChange={e => setInvoiceForm({...invoiceForm, dueDate: e.target.value})} /></div>
                       <div>
                          <label className={labelStyle}>Discount Rate (%)</label>
                          <input type="number" className={inputStyle} value={invoiceForm.discountRate} onChange={e => setInvoiceForm({...invoiceForm, discountRate: parseFloat(e.target.value) || 0})} placeholder="0" />
                       </div>
                    </div>
                    <button onClick={handlePreviewInvoice} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 hover:bg-black transition-all">CONSULT BILLABLE DATABASE</button>
                 </div>
              ) : (
                 <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-inner space-y-6">
                       <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                          <div>
                             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{generatedPreview.clientName}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Period: {invoiceForm.startDate} to {invoiceForm.endDate}</p>
                          </div>
                          <div className="text-right"><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">DRAFT {generatedPreview.invoiceNumber}</p></div>
                       </div>
                       <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
                          {generatedPreview.items.map((item, idx) => (
                             <div key={idx} className="flex justify-between items-center text-[9px] font-bold uppercase text-slate-600"><span className="truncate pr-4">{item.description}</span><span className="shrink-0 text-slate-900">€{item.amount.toFixed(2)}</span></div>
                          ))}
                       </div>
                       <div className="pt-6 border-t border-slate-200 space-y-2">
                          <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400"><span>Subtotal</span><span>€{generatedPreview.subtotal?.toFixed(2)}</span></div>
                          {generatedPreview.discount! > 0 && <div className="flex justify-between text-[9px] font-bold uppercase text-rose-500"><span>Discount</span><span>-€{generatedPreview.discount?.toFixed(2)}</span></div>}
                          <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400"><span>VAT (18%)</span><span>€{generatedPreview.vat?.toFixed(2)}</span></div>
                          <div className="flex justify-between text-xl font-black text-slate-900 uppercase pt-2"><span>Total Due</span><span>€{generatedPreview.totalAmount.toFixed(2)}</span></div>
                       </div>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={handleSaveInvoice} className="flex-1 bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95">FINALIZE & POST</button>
                       <button onClick={() => setGeneratedPreview(null)} className="px-8 border border-slate-200 text-slate-400 font-black rounded-2xl uppercase text-[10px] tracking-widest">EDIT</button>
                    </div>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;
