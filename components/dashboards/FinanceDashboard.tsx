
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
  
  // Records / Archive State
  const [recordsSearch, setRecordsSearch] = useState('');
  const [viewingRecordsUser, setViewingRecordsUser] = useState<User | null>(null);
  const [initialDocMode, setInitialDocMode] = useState<'fs3' | 'payslip' | 'worksheet' | null>(null);
  
  // Invoice Generator State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    dueDate: '',
    discountRate: 0 // Changed to Rate %
  });
  
  // Local state to track the percentage while editing an invoice
  const [currentDiscountRate, setCurrentDiscountRate] = useState(0);

  // New state for appending shifts in edit mode
  const [appendForm, setAppendForm] = useState({
    startDate: '',
    endDate: ''
  });
  const [showAppendTools, setShowAppendTools] = useState(false);

  const [generatedPreview, setGeneratedPreview] = useState<Invoice | null>(null);

  // --- RECORDS LOGIC ---
  const filteredRecordsUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(recordsSearch.toLowerCase()) || 
                            u.role.toLowerCase().includes(recordsSearch.toLowerCase());
      // Filter out non-employee roles for cleaner list if desired, or keep all
      const isEmployee = ['cleaner', 'supervisor', 'driver', 'housekeeping', 'maintenance', 'laundry'].includes(u.role);
      return matchesSearch && isEmployee;
    }).sort((a, b) => {
        // Inactive users at the bottom
        if (a.status === 'inactive' && b.status !== 'inactive') return 1;
        if (a.status !== 'inactive' && b.status === 'inactive') return -1;
        return a.name.localeCompare(b.name);
    });
  }, [users, recordsSearch]);

  // --- PAYROLL LOGIC ---
  const cleanerPayroll = useMemo(() => {
    const data: Record<string, { user: User, shifts: Shift[] }> = {};
    
    // Process only completed/verified shifts that are NOT paid
    shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'approved' && !s.paid).forEach(s => {
      s.userIds?.forEach(sid => {
        if (!data[sid]) {
          const u = users.find(user => user.id === sid);
          if (u) data[sid] = { user: u, shifts: [] };
        }
        if (data[sid]) data[sid].shifts.push(s);
      });
    });

    // Also include rejected shifts for hourly calculation only (if unpaid)
    shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'rejected' && !s.paid).forEach(s => {
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
      totalBase += basePay;

      const teamCount = s.userIds?.length || 1;
      const isApproved = s.approvalStatus === 'approved';

      if (isApproved) {
        const targetFee = prop.serviceRates?.[s.serviceType] !== undefined 
            ? prop.serviceRates[s.serviceType] 
            : prop.cleanerPrice;

        if (staff.role === 'cleaner' && s.serviceType !== 'TO FIX' && staff.paymentType === 'Per Clean') {
          const shareOfTargetFee = targetFee / teamCount;
          const potentialBonus = Math.max(0, shareOfTargetFee - basePay);
          totalBonus += potentialBonus;
        }

        if (s.serviceType === 'TO FIX' && (s.fixWorkPayment || 0) > 0) {
          totalBonus += s.fixWorkPayment!;
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
    alert(`Payment confirmed for ${activePayslip.user.name}. ${shiftIds.length} shifts marked as paid.`);
  };

  // --- INVOICING LOGIC ---

  const calculateItemsFromShifts = (clientId: string, startStr: string, endStr: string) => {
    // Create Date objects relative to start of day
    const start = new Date(startStr);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999);

    const clientPropertyIds = properties.filter(p => p.clientId === clientId).map(p => p.id);
    
    const getShiftDateObj = (dateStr: string) => {
        if (dateStr.includes('-')) return new Date(dateStr);
        // For "20 OCT" format
        const currentYear = new Date().getFullYear();
        const d = new Date(`${dateStr} ${currentYear}`);
        return d;
    };

    const eligibleShifts = shifts.filter(s => {
        if (!clientPropertyIds.includes(s.propertyId)) return false;
        if (s.status !== 'completed') return false; 
        
        // Only include Billable types: CHECK OUT / CHECK IN, REFRESH, MID STAY
        const isBillable = ['CHECK OUT / CHECK IN CLEANING', 'REFRESH', 'MID STAY CLEANING'].includes(s.serviceType);
        if (!isBillable) return false;

        const sDate = getShiftDateObj(s.date);
        // Ensure date check is robust
        if (isNaN(sDate.getTime())) return false;
        return sDate >= start && sDate <= end;
    });

    const shiftItems = eligibleShifts.map(s => {
        const prop = properties.find(p => p.id === s.propertyId);
        let amount = 0;
        
        if (s.serviceType === 'CHECK OUT / CHECK IN CLEANING') {
            if (prop?.clientPriceType === 'Per Hour' && s.actualStartTime && s.actualEndTime) {
                const hours = (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60);
                amount = hours * (prop.clientPrice || 0);
            } else {
                amount = prop?.clientPrice || 0;
            }
        } else if (s.serviceType === 'REFRESH') {
            amount = prop?.clientServiceRates?.['REFRESH'] || 0;
        } else if (s.serviceType === 'MID STAY CLEANING') {
            amount = prop?.clientServiceRates?.['MID STAY CLEANING'] || 0;
        }

        // Description Logic: Only Property Name for Check Out/In, else Service Type - Property Name
        const description = s.serviceType === 'CHECK OUT / CHECK IN CLEANING' 
            ? s.propertyName || 'Unknown Property'
            : `${s.serviceType} - ${s.propertyName}`;

        return {
            description,
            date: s.date,
            amount: parseFloat(amount.toFixed(2))
        };
    });

    // --- INCLUDE BILLABLE MANUAL TASKS ---
    const eligibleManualTasks = manualTasks.filter(t => {
      // Must be billable
      if (!t.isBillable) return false;
      // Must belong to client property
      if (!clientPropertyIds.includes(t.propertyId)) return false;
      
      // Date Check
      const tDate = new Date(t.date);
      // Ensure time component doesn't affect day comparison logic if using YYYY-MM-DD strings
      // But here we use full date objects with time set to 00:00 and 23:59
      if (isNaN(tDate.getTime())) return false;
      
      return tDate >= start && tDate <= end;
    });

    const manualTaskItems = eligibleManualTasks.map(t => ({
      description: `${t.taskName} - ${t.propertyName}`,
      date: new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
      amount: t.billablePrice || 0
    }));

    return [...shiftItems, ...manualTaskItems];
  };

  const recalculateInvoiceTotals = (items: InvoiceItem[], rate: number) => {
    // Safety: ensure sum is always a number, even if item.amount comes in as string from inputs
    const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const discountAmount = subtotal * (Number(rate) / 100);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const vat = taxableAmount * 0.18; // 18% VAT
    const totalAmount = taxableAmount + vat;
    return { subtotal, discount: discountAmount, vat, totalAmount };
  };

  const handleGeneratePreview = () => {
    if (!invoiceForm.clientId || !invoiceForm.startDate || !invoiceForm.endDate || !invoiceForm.dueDate) return;

    const client = clients.find(c => c.id === invoiceForm.clientId);
    if (!client) return;

    const items = calculateItemsFromShifts(client.id, invoiceForm.startDate, invoiceForm.endDate);
    
    // Initial Calculation with the rate from form
    setCurrentDiscountRate(invoiceForm.discountRate);
    const { subtotal, discount, vat, totalAmount } = recalculateInvoiceTotals(items, invoiceForm.discountRate);

    const draftInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${invoices.length + 101}`,
        clientId: client.id,
        clientName: client.name,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: invoiceForm.dueDate,
        periodStart: invoiceForm.startDate,
        periodEnd: invoiceForm.endDate,
        items,
        subtotal,
        discount, // Storing amount
        vat,
        totalAmount,
        status: 'draft'
    };

    setGeneratedPreview(draftInvoice);
  };

  // Used for editing existing invoices
  const handleEditInvoice = (inv: Invoice) => {
    // Ensure older invoices have fields populated if missing
    const subtotal = inv.subtotal || inv.items.reduce((a, b) => a + b.amount, 0);
    const discountAmount = inv.discount || 0;
    
    // Reverse calculate the rate
    const calculatedRate = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    setCurrentDiscountRate(parseFloat(calculatedRate.toFixed(2)));

    const taxable = Math.max(0, subtotal - discountAmount);
    const vat = inv.vat || (taxable * 0.18);
    const totalAmount = inv.totalAmount || (taxable + vat);

    const fullInv: Invoice = { ...inv, subtotal, discount: discountAmount, vat, totalAmount };

    setGeneratedPreview(fullInv);
    setShowInvoiceModal(true);
    setInvoiceForm({
        clientId: inv.clientId,
        startDate: inv.periodStart || '',
        endDate: inv.periodEnd || '',
        dueDate: inv.dueDate,
        discountRate: 0 // Not used in edit mode directly, we use currentDiscountRate
    });
  };

  // --- EDITING LOGIC ---

  const updatePreview = (updatedItems: InvoiceItem[], rate: number) => {
    if (!generatedPreview) return;
    const { subtotal, discount, vat, totalAmount } = recalculateInvoiceTotals(updatedItems, rate);
    setGeneratedPreview({ 
        ...generatedPreview, 
        items: updatedItems, 
        subtotal,
        discount,
        vat,
        totalAmount 
    });
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    if (!generatedPreview) return;
    const newItems = [...generatedPreview.items];
    
    // Safety check for amount field to prevent NaN/String pollution in calculations
    let finalValue = value;
    if (field === 'amount') {
        finalValue = parseFloat(value.toString()) || 0;
    }

    newItems[index] = { ...newItems[index], [field]: finalValue };
    updatePreview(newItems, currentDiscountRate);
  };

  const handleDeleteItem = (index: number) => {
    if (!generatedPreview) return;
    const newItems = generatedPreview.items.filter((_, i) => i !== index);
    updatePreview(newItems, currentDiscountRate);
  };

  const handleAddManualItem = () => {
    if (!generatedPreview) return;
    const newItem: InvoiceItem = {
        description: 'Manual Adjustment',
        date: new Date().toISOString().split('T')[0],
        amount: 0
    };
    updatePreview([...generatedPreview.items, newItem], currentDiscountRate);
  };

  const handleUpdateDiscountRate = (newRate: number) => {
    if (!generatedPreview) return;
    setCurrentDiscountRate(newRate);
    updatePreview(generatedPreview.items, newRate);
  };

  const handleUpdateDueDate = (val: string) => {
    if (!generatedPreview) return;
    setGeneratedPreview({ ...generatedPreview, dueDate: val });
  };

  const handleAppendShifts = () => {
    if (!generatedPreview || !appendForm.startDate || !appendForm.endDate) return;
    
    const newItems = calculateItemsFromShifts(generatedPreview.clientId, appendForm.startDate, appendForm.endDate);
    
    if (newItems.length === 0) {
        alert("No additional billable items (Shifts or Tasks) found in this range.");
        return;
    }

    const combinedItems = [...generatedPreview.items, ...newItems];
    updatePreview(combinedItems, currentDiscountRate);
    
    setShowAppendTools(false);
    setAppendForm({ startDate: '', endDate: '' });
  };

  const handleSaveInvoice = (status: 'draft' | 'sent') => {
    if (!generatedPreview || !setInvoices) return;

    if (status === 'sent') {
        const invalidItems = generatedPreview.items.filter(item => item.amount === 0);
        if (invalidItems.length > 0) {
            alert(`Cannot send invoice: ${invalidItems.length} item(s) have a price of €0.00. Please insert price manually.`);
            return;
        }
    }

    const finalInvoice: Invoice = { ...generatedPreview, status };

    setInvoices(prev => {
        const exists = prev.find(i => i.id === finalInvoice.id);
        if (exists) {
            return prev.map(i => i.id === finalInvoice.id ? finalInvoice : i);
        }
        return [finalInvoice, ...prev];
    });
    
    setShowInvoiceModal(false);
    setGeneratedPreview(null);
    setInvoiceForm({ clientId: '', startDate: '', endDate: '', dueDate: '', discountRate: 0 });
    setAppendForm({ startDate: '', endDate: '' });
    setShowAppendTools(false);
  };

  const handleMarkAsPaid = (id: string) => {
    if (!setInvoices) return;
    setInvoices(prev => prev.map(inv => 
      inv.id === id ? { ...inv, status: 'paid' } : inv
    ));
  };

  const getClientDetails = () => {
    if (!generatedPreview) return null;
    return clients.find(c => c.id === generatedPreview.clientId);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">FINANCIAL LEDGER</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">CFO</span>
          </h1>
        </div>
        <button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
          EXIT STUDIO
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-black/5 rounded-xl w-fit">
          <button 
            onClick={() => setActiveModule('payroll')} 
            className={`px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'payroll' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/40 hover:bg-white/50'}`}
          >
            Staff Payroll
          </button>
          <button 
            onClick={() => setActiveModule('invoicing')} 
            className={`px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'invoicing' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/40 hover:bg-white/50'}`}
          >
            Client Invoicing
          </button>
          <button 
            onClick={() => setActiveModule('records')} 
            className={`px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeModule === 'records' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/40 hover:bg-white/50'}`}
          >
            Personnel Records
          </button>
      </div>

      {activeModule === 'payroll' && (
        <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 shadow-2xl space-y-8 animate-in slide-in-from-right-4">
            <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest">PAYROLL QUEUE (PENDING PAYMENT)</h3>
            {cleanerPayroll.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-[#D4B476]/20 rounded-3xl">
                    <p className="text-[#A68342] font-black uppercase text-[10px] tracking-widest">All payroll processed.</p>
                </div>
            ) : (
                <div className="space-y-4">
                {cleanerPayroll.map(entry => {
                    const totals = calculatePayslipBreakdown(entry.shifts, entry.user);
                    return (
                    <div key={entry.user.id} className="bg-white rounded-3xl border border-[#D4B476]/10 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-[#C5A059]/40 transition-all shadow-sm">
                        <div className="flex items-center gap-6 flex-1 w-full">
                        <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/20 text-[#C5A059] flex items-center justify-center font-serif-brand text-xl">
                            {entry.user.name.charAt(0)}
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-black uppercase tracking-wider">{entry.user.name}</h4>
                            <p className="text-[8px] text-black/40 uppercase tracking-widest mt-1">
                            {entry.shifts.length} Unpaid Deployments • {totals.totalHours.toFixed(1)} hrs • Role: {entry.user.role}
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">NET PAYOUT</p>
                            <p className="text-xl font-serif-brand font-bold text-green-600">€{totals.totalNet.toFixed(2)}</p>
                        </div>
                        <button onClick={() => setSelectedPayslipId(entry.user.id)} className="bg-[#C5A059] text-black px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">VIEW</button>
                        </div>
                    </div>
                    );
                })}
                </div>
            )}
        </div>
      )}

      {activeModule === 'invoicing' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
            {/* INVOICING HEADER STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#FDF8EE] p-6 rounded-[32px] border border-[#D4B476]/30 shadow-sm">
                    <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em] opacity-60">TOTAL BILLED</p>
                    <p className="text-3xl font-serif-brand font-bold text-black mt-2">€{invoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-gray-200 shadow-sm">
                    <p className="text-[8px] font-black text-black/40 uppercase tracking-[0.4em]">PENDING PAYMENT</p>
                    <p className="text-3xl font-serif-brand font-bold text-black mt-2">€{invoices.filter(i => i.status === 'sent').reduce((acc, i) => acc + (i.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="bg-[#1A1A1A] p-6 rounded-[32px] border border-white/10 shadow-xl flex items-center justify-center">
                    <button 
                        onClick={() => { setGeneratedPreview(null); setInvoiceForm({ clientId: '', startDate: '', endDate: '', dueDate: '', discountRate: 0 }); setShowInvoiceModal(true); }}
                        className="bg-[#C5A059] text-black font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 hover:bg-[#E2C994] transition-all flex items-center gap-3"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        GENERATE NEW INVOICE
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-gray-200 shadow-xl overflow-hidden p-8">
                <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest mb-6">INVOICE HISTORY</h3>
                {invoices.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                        <p className="text-black/20 font-black uppercase text-[10px] tracking-widest">No invoices generated yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {invoices.map(inv => (
                            <div key={inv.id} className="flex flex-col md:flex-row items-center justify-between p-5 rounded-2xl border border-gray-100 hover:border-[#C5A059]/30 transition-all hover:shadow-md bg-gray-50/50 group">
                                <div className="flex items-center gap-6 w-full md:w-auto">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : inv.status === 'sent' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                        €
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-black uppercase tracking-tight">{inv.clientName}</h4>
                                        <p className="text-[9px] text-black/40 font-black uppercase tracking-widest mt-0.5">{inv.invoiceNumber} • {inv.issueDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-black/20 uppercase tracking-widest">AMOUNT</p>
                                        <p className="text-lg font-serif-brand font-bold text-black">€{inv.totalAmount?.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'overdue' ? 'bg-red-100 text-red-700' : inv.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {inv.status}
                                        </span>
                                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                                            <button 
                                                onClick={() => handleMarkAsPaid(inv.id)}
                                                className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 active:scale-95 text-[8px] font-black uppercase tracking-widest px-3 shadow-md"
                                                title="Mark as Paid"
                                            >
                                                Mark Paid
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleEditInvoice(inv)}
                                            className="bg-white border border-gray-200 text-black/40 p-2 rounded-lg hover:text-black hover:border-black/20 active:scale-95"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Records Module Omitted for brevity as it is unchanged structurally but included in the full component rendering if needed */}
      
      {activeModule === 'records' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest">PERSONNEL ARCHIVE & RECORDS</h3>
                 <div className="relative w-full md:w-64">
                    <input 
                      type="text" 
                      placeholder="SEARCH STAFF..." 
                      className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-[10px] text-black font-bold uppercase tracking-widest outline-none focus:border-[#C5A059]"
                      value={recordsSearch}
                      onChange={(e) => setRecordsSearch(e.target.value)}
                    />
                    <div className="absolute right-3 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {filteredRecordsUsers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-black/20 font-black uppercase text-[10px] italic">No matching records found.</div>
                 ) : filteredRecordsUsers.map(u => (
                    <div key={u.id} className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all ${u.status === 'inactive' ? 'bg-gray-100 border-gray-200 opacity-70' : 'bg-white border-[#D4B476]/20 hover:border-[#C5A059]'}`}>
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${u.status === 'inactive' ? 'bg-gray-300 text-white' : 'bg-[#C5A059] text-black'}`}>
                             {u.name.charAt(0)}
                          </div>
                          <div>
                             <h4 className="text-[11px] font-bold text-black uppercase">{u.name}</h4>
                             <p className="text-[8px] font-black uppercase tracking-widest text-black/40">{u.role} • {u.status}</p>
                          </div>
                       </div>
                       
                       <div className="flex gap-2">
                          <button 
                            onClick={() => { setViewingRecordsUser(u); setInitialDocMode('fs3'); }}
                            className="flex-1 px-3 py-2 bg-black text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md hover:bg-zinc-800 transition-all"
                          >
                            GENERATE FS3
                          </button>
                          <button 
                            onClick={() => { setViewingRecordsUser(u); setInitialDocMode('worksheet'); }}
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:border-[#C5A059] transition-all"
                          >
                            MONTHLY DOCS
                          </button>
                          <button 
                            onClick={() => { setViewingRecordsUser(u); setInitialDocMode(null); }}
                            className="px-3 py-2 bg-gray-100 text-black/40 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                          >
                            PROFILE
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* VIEWING RECORDS USER MODAL (Reuses PersonnelProfile) */}
      {viewingRecordsUser && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95 duration-300">
           <div className="bg-[#FDF8EE] w-full max-w-5xl h-[90vh] rounded-[48px] relative overflow-y-auto custom-scrollbar border border-[#D4B476]/30 shadow-2xl">
              <button 
                onClick={() => { setViewingRecordsUser(null); setInitialDocMode(null); }} 
                className="absolute top-8 right-8 z-50 bg-black/5 hover:bg-black/10 text-black p-3 rounded-full transition-all"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div className="p-8 md:p-12">
                 <PersonnelProfile 
                   user={viewingRecordsUser} 
                   shifts={shifts} 
                   properties={properties} 
                   organization={organization}
                   initialDocView={initialDocMode}
                 />
              </div>
           </div>
        </div>
      )}

      {/* PAYROLL MODAL */}
      {activePayslip && (
        <div className="fixed inset-0 bg-black/98 z-[300] flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95 duration-500">
           <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-2xl p-10 space-y-12 shadow-2xl relative text-left overflow-y-auto max-h-[90vh] custom-scrollbar">
              <button onClick={() => setSelectedPayslipId(null)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <header className="space-y-4">
                 <div>
                    <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.5em] mb-1">OFFICIAL STUDIO PAYSLIP</p>
                    <h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">Statement of Earnings</h2>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8 border-t border-black/10 pt-4">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-black/40 uppercase tracking-widest">EMPLOYER</p>
                        <p className="text-[10px] font-bold text-black uppercase">{organization?.legalEntity || organization?.name || 'STUDIO'}</p>
                        <p className="text-[9px] font-mono text-black/60">PE: {organization?.peNumber || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-black/40 uppercase tracking-widest">EMPLOYEE</p>
                        <p className="text-[10px] font-bold text-black uppercase">{activePayslip.user.name}</p>
                        <p className="text-[9px] font-mono text-black/60">ID: {activePayslip.user.idPassportNumber || 'N/A'} | NI: {activePayslip.user.niNumber || 'N/A'}</p>
                    </div>
                 </div>
              </header>

              <div className="space-y-6">
                 <div className="bg-white border border-[#D4B476]/10 rounded-3xl overflow-hidden">
                    <div className="grid grid-cols-2 bg-gray-50/50 p-4 text-[8px] font-black text-[#C5A059] uppercase tracking-widest border-b border-[#D4B476]/10">
                       <span>Description</span>
                       <span className="text-right">Amount</span>
                    </div>
                    <div className="p-4 space-y-4">
                       <div className="flex justify-between text-[11px]">
                          <span className="text-black/60">Remuneration ({activePayslip.breakdown.totalHours.toFixed(1)}h @ Base Rate)</span>
                          <span className="text-black font-bold">€{activePayslip.breakdown.totalBase.toFixed(2)}</span>
                       </div>
                       {activePayslip.breakdown.totalBonus > 0 && (
                         <div className="flex justify-between text-[11px]">
                            <span className="text-green-600/80">Performance Bonus (Split / Fix Work)</span>
                            <span className="text-green-600 font-bold">€{activePayslip.breakdown.totalBonus.toFixed(2)}</span>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="bg-[#C5A059] border border-[#C5A059] p-8 rounded-3xl flex justify-between items-center shadow-lg">
                    <div>
                       <p className="text-[9px] font-black text-black/40 uppercase tracking-[0.4em]">NET REMUNERATION</p>
                    </div>
                    <p className="text-4xl font-serif-brand font-bold text-black">€{activePayslip.breakdown.totalNet.toFixed(2)}</p>
                 </div>

                 <button onClick={handleMarkPayrollPaid} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl hover:bg-zinc-900 transition-all active:scale-95 border border-[#C5A059]/20">CONFIRM PAYMENT & CLEAR</button>
              </div>
           </div>
        </div>
      )}

      {/* INVOICE GENERATOR / EDITOR MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
            <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-3xl p-10 space-y-8 shadow-2xl relative text-left overflow-y-auto max-h-[90vh] custom-scrollbar">
                <button onClick={() => { setShowInvoiceModal(false); setGeneratedPreview(null); }} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                
                <div className="space-y-1">
                    <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">{generatedPreview ? 'Edit Invoice' : 'Invoice Generator'}</h2>
                    <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em]">Automated Billing Engine</p>
                </div>

                {!generatedPreview ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] px-1">Select Client</label>
                            <select 
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059]"
                                value={invoiceForm.clientId}
                                onChange={(e) => setInvoiceForm({...invoiceForm, clientId: e.target.value})}
                            >
                                <option value="">SELECT CLIENT...</option>
                                {clients?.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] px-1">Period Start</label>
                                <input type="date" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={invoiceForm.startDate} onChange={(e) => setInvoiceForm({...invoiceForm, startDate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] px-1">Period End</label>
                                <input type="date" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={invoiceForm.endDate} onChange={(e) => setInvoiceForm({...invoiceForm, endDate: e.target.value})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] px-1">Invoice Due Date</label>
                                <input type="date" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({...invoiceForm, dueDate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.2em] px-1">Discount Rate (%)</label>
                                <input type="number" step="0.5" max="100" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={invoiceForm.discountRate || ''} onChange={(e) => setInvoiceForm({...invoiceForm, discountRate: parseFloat(e.target.value) || 0})} placeholder="0%" />
                            </div>
                        </div>
                        <button 
                            onClick={handleGeneratePreview}
                            className="w-full bg-black text-[#C5A059] font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-zinc-900 transition-all active:scale-95"
                        >
                            CALCULATE & PREVIEW
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4">
                        <div className="bg-white border border-gray-200 p-8 rounded-3xl space-y-6 shadow-sm">
                            {/* INVOICE HEADER: FROM & BILL TO */}
                            <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                                <div className="space-y-4">
                                    {/* ADMIN / FROM SECTION */}
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em]">FROM</p>
                                        <h3 className="text-lg font-serif-brand font-bold text-black uppercase">{organization?.legalEntity || organization?.name || 'My Studio'}</h3>
                                        <div className="text-[9px] text-black/60 font-medium space-y-0.5">
                                            <p>{organization?.address || 'Studio HQ Address'}</p>
                                            <p>VAT: {organization?.taxId || 'N/A'}</p>
                                            <p>{organization?.email || 'admin@reset.studio'}</p>
                                        </div>
                                    </div>

                                    {/* CLIENT / BILL TO SECTION */}
                                    <div className="space-y-1 pt-4">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.4em]">BILL TO</p>
                                        <h3 className="text-xl font-bold text-black uppercase">{generatedPreview.clientName}</h3>
                                        <div className="text-[9px] text-black/60 font-medium space-y-0.5">
                                            <p>{getClientDetails()?.billingAddress || 'Address Not Recorded'}</p>
                                            <p>VAT: {getClientDetails()?.vatNumber || 'N/A'}</p>
                                            <p>{getClientDetails()?.contactEmail || ''}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right space-y-2">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">INVOICE #</p>
                                        <p className="text-sm font-bold text-black">{generatedPreview.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">ISSUED</p>
                                        <p className="text-sm font-bold text-black">{generatedPreview.issueDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest block text-right">DUE DATE</label>
                                        <input 
                                            type="date" 
                                            className="text-right font-bold text-sm bg-transparent border-b border-gray-200 outline-none focus:border-[#C5A059] w-28"
                                            value={generatedPreview.dueDate}
                                            onChange={(e) => handleUpdateDueDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="pt-4">
                                        <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">TOTAL DUE</p>
                                        <h3 className="text-3xl font-serif-brand font-bold text-[#C5A059]">€{Number(generatedPreview.totalAmount || 0).toFixed(2)}</h3>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Editable Items List */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Line Items ({generatedPreview.items.length})</p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowAppendTools(!showAppendTools)}
                                            className="text-[8px] font-black text-[#A68342] uppercase tracking-widest bg-[#FDF8EE] px-2 py-1 rounded hover:bg-[#C5A059]/20 transition-all"
                                        >
                                            {showAppendTools ? 'Cancel Import' : '+ Import Shifts'}
                                        </button>
                                        <button 
                                            onClick={handleAddManualItem}
                                            className="text-[8px] font-black text-black/40 uppercase tracking-widest hover:text-black"
                                        >
                                            + Custom Item
                                        </button>
                                    </div>
                                </div>

                                {showAppendTools && (
                                    <div className="bg-[#FDF8EE] p-4 rounded-xl border border-[#D4B476]/30 space-y-3 animate-in fade-in">
                                        <p className="text-[9px] font-black text-black/60 uppercase tracking-widest">Append Shifts (Add Rest of Days)</p>
                                        <div className="flex gap-2">
                                            <input type="date" className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[9px]" value={appendForm.startDate} onChange={e => setAppendForm({...appendForm, startDate: e.target.value})} />
                                            <input type="date" className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[9px]" value={appendForm.endDate} onChange={e => setAppendForm({...appendForm, endDate: e.target.value})} />
                                            <button onClick={handleAppendShifts} className="bg-[#C5A059] text-black px-4 rounded-lg font-black text-[9px] uppercase hover:bg-[#D4B476]">ADD</button>
                                        </div>
                                    </div>
                                )}

                                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                                    {generatedPreview.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] border-b border-dashed border-gray-100 pb-2 last:border-0 gap-4 group">
                                            {/* Date Column First */}
                                            <span className="text-gray-400 font-mono w-24">{item.date}</span>
                                            
                                            {/* Description Column */}
                                            <div className="flex-1">
                                                <input 
                                                    className="w-full bg-transparent font-bold text-black uppercase outline-none focus:border-b focus:border-[#C5A059]"
                                                    value={item.description}
                                                    onChange={(e) => handleUpdateItem(i, 'description', e.target.value)}
                                                />
                                            </div>

                                            {/* Amount Column */}
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-gray-600">€</span>
                                                <input 
                                                    type="number"
                                                    className={`w-16 bg-transparent font-mono text-right outline-none focus:border-b focus:border-[#C5A059] ${item.amount === 0 ? 'text-red-500 font-bold border-b border-red-500' : 'text-gray-600'}`}
                                                    value={item.amount}
                                                    onChange={(e) => handleUpdateItem(i, 'amount', e.target.value)}
                                                />
                                                <button onClick={() => handleDeleteItem(i)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-1">×</button>
                                            </div>
                                        </div>
                                    ))}
                                    {generatedPreview.items.length === 0 && <p className="text-center italic text-gray-300 text-[9px] uppercase">No billable shifts found in period.</p>}
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="border-t border-gray-100 pt-4 space-y-2 text-right">
                                <div className="flex justify-end gap-12 text-[10px]">
                                    <span className="font-bold text-black/40 uppercase tracking-widest">Subtotal</span>
                                    <span className="font-mono text-black font-bold min-w-[80px]">€{Number(generatedPreview.subtotal || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-end gap-12 text-[10px] items-center">
                                    <span className="font-bold text-black/40 uppercase tracking-widest">Discount (%)</span>
                                    <div className="flex items-center gap-1 min-w-[80px] justify-end">
                                        <input 
                                            type="number"
                                            className="w-12 text-right font-mono font-bold bg-gray-50 border-b border-gray-200 outline-none focus:border-[#C5A059]"
                                            value={currentDiscountRate}
                                            onChange={(e) => handleUpdateDiscountRate(parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="text-black text-[9px]">%</span>
                                    </div>
                                    <span className="font-mono text-red-500 font-bold min-w-[60px]">-€{Number(generatedPreview.discount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-end gap-12 text-[10px]">
                                    <span className="font-bold text-black/40 uppercase tracking-widest">VAT (18%)</span>
                                    <span className="font-mono text-black font-bold min-w-[80px]">€{Number(generatedPreview.vat || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-end gap-12 text-sm pt-2 border-t border-dashed border-gray-100">
                                    <span className="font-black text-[#C5A059] uppercase tracking-widest">Total</span>
                                    <span className="font-mono text-black font-bold min-w-[80px]">€{Number(generatedPreview.totalAmount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setGeneratedPreview(null)} className="flex-1 bg-white border border-gray-200 text-gray-400 font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[9px] hover:text-black hover:border-black/20">Back to Config</button>
                            <button onClick={() => handleSaveInvoice('draft')} className="flex-1 bg-gray-100 text-black/60 font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[9px] hover:bg-gray-200">SAVE DRAFT</button>
                            <button onClick={() => handleSaveInvoice('sent')} disabled={generatedPreview.items.length === 0} className="flex-1 bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[9px] shadow-xl hover:bg-[#E2C994] disabled:opacity-50 disabled:cursor-not-allowed">CONFIRM & SEND</button>
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
