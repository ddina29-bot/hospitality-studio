
import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Shift, User, Property, Invoice, Client, InvoiceItem, OrganizationSettings, ManualTask } from '../../types';
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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const [recordsSearch, setRecordsSearch] = useState('');
  const [viewingRecordsUser, setViewingRecordsUser] = useState<User | null>(null);
  const [initialDocMode, setInitialDocMode] = useState<'fs3' | 'payslip' | 'worksheet' | null>(null);
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    dueDate: '',
    discountRate: 0 
  });
  
  const [currentDiscountRate, setCurrentDiscountRate] = useState(0);
  const [generatedPreview, setGeneratedPreview] = useState<Invoice | null>(null);

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
    
    // Process shifts awaiting payment
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
    let totalBase = 0;
    let totalBonus = 0;
    let totalHours = 0;

    staffShifts.forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (!prop) return;

      const durationMs = (s.actualEndTime || 0) - (s.actualStartTime || 0);
      const hours = durationMs / (1000 * 60 * 60);
      totalHours += hours;

      const hourlyRate = staff.payRate || 5.00;
      const basePay = hours * hourlyRate;
      
      const teamCount = s.userIds?.length || 1;
      const isApproved = s.approvalStatus === 'approved';

      // Special handling for remediation/common areas
      if (s.serviceType === 'TO FIX' || s.serviceType === 'Common Area') {
          if (s.fixWorkPayment && s.fixWorkPayment > 0) {
              totalBonus += s.fixWorkPayment;
          } else {
              totalBase += basePay;
          }
          return;
      }

      totalBase += basePay;

      if (isApproved) {
        const targetFee = prop.serviceRates?.[s.serviceType] !== undefined 
            ? prop.serviceRates[s.serviceType] 
            : prop.cleanerPrice;

        if (staff.role === 'cleaner' && staff.paymentType === 'Per Clean') {
          const shareOfTargetFee = targetFee / teamCount;
          const potentialBonus = Math.max(0, shareOfTargetFee - basePay);
          totalBonus += potentialBonus;
        }
      }
    });

    return { 
      totalBase, 
      totalBonus, 
      totalHours, 
      totalNet: totalBase + totalBonus 
    };
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
    
    setShifts(prev => prev.map(s => 
        shiftIds.includes(s.id) ? { ...s, paid: true, payoutDate: now } : s
    ));
    
    setSelectedPayslipId(null);
    alert(`Payment confirmed for ${activePayslip.user.name}.`);
  };

  const calculateItemsFromShifts = (clientId: string, startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999);

    const clientPropertyIds = properties.filter(p => p.clientId === clientId).map(p => p.id);
    
    const getShiftDateObj = (dateStr: string) => {
        if (dateStr.includes('-')) return new Date(dateStr);
        const currentYear = new Date().getFullYear();
        return new Date(`${dateStr} ${currentYear}`);
    };

    const eligibleShifts = shifts.filter(s => {
        if (!clientPropertyIds.includes(s.propertyId)) return false;
        if (s.status !== 'completed') return false; 
        const sDate = getShiftDateObj(s.date);
        return sDate >= start && sDate <= end;
    });

    return eligibleShifts.map(s => {
        const prop = properties.find(p => p.id === s.propertyId);
        let amount = prop?.clientPrice || 0;
        if (s.serviceType !== 'Check out/check in') {
          amount = prop?.clientServiceRates?.[s.serviceType] || amount;
        }
        return {
            description: `${s.serviceType}: ${s.propertyName}`,
            date: s.date,
            amount: amount
        };
    });
  };

  const handleGeneratePreview = () => {
    if (!invoiceForm.clientId || !invoiceForm.startDate || !invoiceForm.endDate || !invoiceForm.dueDate) return;
    const client = clients?.find(c => c.id === invoiceForm.clientId);
    if (!client) return;
    const items = calculateItemsFromShifts(client.id, invoiceForm.startDate, invoiceForm.endDate);
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const vat = subtotal * 0.18;
    
    const draftInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${(invoices?.length || 0) + 1}`,
        clientId: client.id,
        clientName: client.name,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: invoiceForm.dueDate,
        periodStart: invoiceForm.startDate,
        periodEnd: invoiceForm.endDate,
        items,
        subtotal,
        vat,
        totalAmount: subtotal + vat,
        status: 'draft'
    };
    setGeneratedPreview(draftInvoice);
  };

  const handleSaveInvoice = (status: 'draft' | 'sent') => {
    if (!generatedPreview || !setInvoices) return;
    const finalInvoice: Invoice = { ...generatedPreview, status };
    setInvoices(prev => [finalInvoice, ...prev]);
    setShowInvoiceModal(false);
    setGeneratedPreview(null);
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
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl space-y-8">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Pending Payout Queue</h3>
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
                              <p className="text-2xl font-bold text-green-600">€{totals.totalNet.toFixed(2)}</p>
                          </div>
                          <button onClick={() => setSelectedPayslipId(entry.user.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">DETAILS</button>
                        </div>
                    </div>
                    );
                })}
                {cleanerPayroll.length === 0 && <p className="text-center py-20 text-[10px] opacity-20 font-black uppercase">No pending payroll processing needed</p>}
            </div>
        </div>
      )}

      {activeModule === 'invoicing' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">TOTAL BILLED</p>
                    <p className="text-4xl font-bold text-slate-900 mt-2">€{invoices?.reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">PENDING PAY</p>
                    <p className="text-4xl font-bold text-teal-600 mt-2">€{invoices?.filter(i => i.status === 'sent').reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="flex items-center justify-center">
                    <button onClick={() => { setGeneratedPreview(null); setShowInvoiceModal(true); }} className="w-full h-full bg-[#0D9488] text-white font-black rounded-[40px] uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 hover:bg-teal-700 transition-all flex items-center justify-center gap-3">
                        GENERATE INVOICE
                    </button>
                </div>
            </div>
            {/* Invoice list rendering... */}
        </div>
      )}

      {activeModule === 'records' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Employee Archive</h3>
                 <div className="relative w-full md:w-80">
                    <input 
                      type="text" 
                      placeholder="SEARCH STAFF..." 
                      className="w-full bg-slate-50 border border-slate-100 rounded-full px-6 py-3 text-[11px] text-slate-900 font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-teal-400"
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
                          <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode('payslip'); }} className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">PAYSLIPS</button>
                          <button onClick={() => { setViewingRecordsUser(u); setInitialDocMode(null); }} className="px-4 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100">DOSSIER</button>
                       </div>
                    </div>
                 ))}
              </div>
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
              <div className="bg-teal-600 p-10 rounded-[32px] flex flex-col sm:flex-row justify-between items-center gap-6 shadow-xl shadow-teal-900/20">
                <div className="text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">NET PAYOUT</p>
                    <p className="text-5xl font-bold tracking-tighter">€{activePayslip.breakdown.totalNet.toFixed(2)}</p>
                </div>
                <button onClick={handleMarkPayrollPaid} className="w-full sm:w-auto bg-white text-teal-700 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:bg-teal-50 transition-all active:scale-95">Confirm Payout</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;
