
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType, EmploymentType } from '../types';

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
  initialHistoricalPayslip?: SavedPayslip | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView, initialHistoricalPayslip }) => {
  const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isCurrentUserAdmin = currentUserObj.role === 'admin';
  const canManageFinancials = isCurrentUserAdmin;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(isCurrentUserAdmin ? 'PENDING PAYOUTS' : 'PAYSLIP REGISTRY');
  
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('MAR 2026'); 
  const [payPeriodFrom, setPayPeriodFrom] = useState('2026-03-01');
  const [payPeriodUntil, setPayPeriodUntil] = useState('2026-03-31');
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);
  const [isPreviewingCurrent, setIsPreviewingCurrent] = useState(false);
  
  // Rule 1 Input: Spouse Work Status (Maltese Specific Variable)
  const [spouseWorks, setSpouseWorks] = useState(true);

  const printContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setManualGrossPay(null);
  }, [selectedDocMonth]);

  useEffect(() => {
    const d = new Date(Date.parse(`1 ${selectedDocMonth}`));
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setPayPeriodFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      setPayPeriodUntil(`${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`);
    }
  }, [selectedDocMonth]);

  /**
   * RULE 1: DETERMINE TAX BAND (2026 LOGIC)
   */
  const getTaxEngineOutput = (annualGross: number, status: string, isParent: boolean, kids: number, spouseWorks: boolean) => {
    let taxFreeThreshold = 0;
    let category = '';

    if (isParent && status === 'Single') {
        // CASE D: Single Parent
        category = kids >= 2 ? 'Parent (2+)' : 'Parent (1 Child)';
        taxFreeThreshold = kids >= 2 ? 18500 : 14500;
    } else if (status === 'Married') {
        if (kids > 0) {
            // CASE C: Married with children
            category = kids >= 2 ? 'Married (2+)' : 'Married (1 Child)';
            taxFreeThreshold = kids >= 2 ? 18500 : 17500;
        } else {
            // CASE B or A (Separate)
            if (spouseWorks) {
                category = 'Single (Separate Computation)';
                taxFreeThreshold = 12000;
            } else {
                category = 'Married (Joint Computation)';
                taxFreeThreshold = 15000;
            }
        }
    } else {
        // CASE A: Single (No Kids)
        category = 'Single';
        taxFreeThreshold = 12000;
    }

    if (annualGross <= taxFreeThreshold) return { tax: 0, category, threshold: taxFreeThreshold };

    // Progressive calculation for amount above threshold (Simplified 2026 model)
    const taxable = annualGross - taxFreeThreshold;
    let annualTax = 0;
    if (taxable <= 5000) annualTax = taxable * 0.15;
    else if (taxable <= 15000) annualTax = (5000 * 0.15) + (taxable - 5000) * 0.25;
    else annualTax = (5000 * 0.15) + (10000 * 0.25) + (taxable - 15000) * 0.35;

    return { tax: annualTax, category, threshold: taxFreeThreshold };
  };

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        grossBasic: activeHistoricalPayslip.grossPay - (activeHistoricalPayslip.govBonus || 0),
        govBonus: activeHistoricalPayslip.govBonus || 0,
        tax: activeHistoricalPayslip.tax,
        niEmployee: activeHistoricalPayslip.ni,
        niEmployer: activeHistoricalPayslip.ni, // Historical assumption
        maternityFund: activeHistoricalPayslip.grossPay * 0.003,
        totalNet: activeHistoricalPayslip.netPay,
        taxBandUsed: 'Archived',
        isHistorical: true
      };
    }

    const month = selectedDocMonth.split(' ')[0];
    const fromDate = new Date(payPeriodFrom);
    const untilDate = new Date(payPeriodUntil);
    const monthYear = fromDate.getFullYear();
    const monthIndex = fromDate.getMonth();
    const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate();

    // RULE 2: STATUTORY BONUS (Oct 1 - Mar 31 Window)
    let govBonus = 0;
    let bonusLabel = "N/A";
    if (month === 'MAR') {
        const bonusStart = new Date('2025-10-01');
        const bonusEnd = new Date('2026-03-31');
        const totalBonusDays = 182;
        const userStart = user.activationDate ? new Date(user.activationDate) : bonusStart;
        const effectiveStart = userStart > bonusStart ? userStart : bonusStart;
        const daysEmployed = Math.max(0, ((bonusEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        if (daysEmployed >= totalBonusDays) {
            govBonus = 121.16;
            bonusLabel = "Full";
        } else {
            govBonus = Number(((daysEmployed / totalBonusDays) * 121.16).toFixed(2));
            bonusLabel = `Pro-Rata (${Math.round(daysEmployed)} days)`;
        }
    }

    // BASE CALCULATIONS
    let totalBase = 0;
    if (user.paymentType === 'Fixed Wage') {
        totalBase = user.payRate || 0;
    } else {
        // Assume filtered shifts calculation logic
        (shifts || []).filter(s => s.userIds.includes(user.id) && s.status === 'completed' && s.date.includes(month)).forEach(s => {
            const prop = properties?.find(p => p.id === s.propertyId);
            const dur = (s.actualEndTime || 0) - (s.actualStartTime || 0);
            totalBase += (dur / 3600000) * (user.payRate || 5);
        });
    }

    const currentGross = manualGrossPay !== null ? manualGrossPay : totalBase;
    const taxableGross = currentGross + govBonus;
    
    // RULE 3: NI (10%)
    const niEmployee = taxableGross * 0.10;
    const niEmployer = taxableGross * 0.10;
    const maternityFund = currentGross * 0.003;

    // RULE 1: TAX
    const projectedAnnual = currentGross * 12;
    const taxRes = getTaxEngineOutput(projectedAnnual, user.maritalStatus || 'Single', !!user.isParent, user.childrenCount || 0, spouseWorks);
    const periodTax = taxRes.tax / 12;

    return {
      grossBasic: currentGross,
      govBonus,
      bonusLabel,
      taxableGross,
      niEmployee,
      niEmployer,
      maternityFund,
      tax: periodTax,
      totalNet: taxableGross - niEmployee - periodTax,
      taxBandUsed: taxRes.category,
      isHistorical: false
    };
  }, [shifts, user, properties, activeHistoricalPayslip, manualGrossPay, selectedDocMonth, payPeriodFrom, payPeriodUntil, spouseWorks]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: payPeriodFrom,
      periodUntil: payPeriodUntil,
      grossPay: payrollData.taxableGross,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.niEmployee,
      niWeeks: 4,
      govBonus: payrollData.govBonus,
      daysWorked: 22,
      generatedAt: new Date().toISOString(),
      generatedBy: 'Payroll Engine'
    };
    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setIsPreviewingCurrent(false);
    alert("Financial Record stored in Studio Registry.");
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full text-left pb-24 font-brand animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6 space-y-8">
        <section className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="w-16 h-16 rounded-[1.2rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-2xl shadow-inner overflow-hidden border border-teal-100">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left">
                 <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">{user.role}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Start: {user.activationDate || 'N/A'}</p>
              </div>
           </div>
           {canManageFinancials && (
             <div className="flex flex-col gap-2 items-end">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Spouse Works?</label>
               <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button onClick={() => setSpouseWorks(true)} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${spouseWorks ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`}>YES</button>
                 <button onClick={() => setSpouseWorks(false)} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${!spouseWorks ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>NO</button>
               </div>
             </div>
           )}
        </section>

        <div className="space-y-6">
           <div className="flex gap-8 border-b border-slate-200 w-full md:w-auto px-2 overflow-x-auto no-scrollbar">
              {['PENDING PAYOUTS', 'PAYSLIP REGISTRY', 'LEAVE REQUESTS'].map(tab => (
                 (tab === 'PENDING PAYOUTS' && !canManageFinancials) ? null :
                 <button 
                   key={tab}
                   onClick={() => setActiveSubTab(tab as any)}
                   className={`pb-3 text-[10px] font-black tracking-widest transition-all relative whitespace-nowrap ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}
                 >
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left duration-300"></div>}
                 </button>
              ))}
           </div>

           {activeSubTab === 'PENDING PAYOUTS' && (
             <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-8 text-left">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Payroll Parameters</h3>
                        <span className="text-[8px] font-black text-teal-600 uppercase bg-teal-50 px-2 py-0.5 rounded">2026 Multi-Stakeholder Engine</span>
                      </div>
                      <div className="space-y-4">
                         <div>
                            <label className={subLabelStyle}>Month</label>
                            <select className={inputStyle} value={selectedDocMonth} onChange={e => setSelectedDocMonth(e.target.value)}>
                               {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => <option key={m} value={`${m} 2026`}>{m} 2026</option>)}
                            </select>
                         </div>
                         <div>
                            <label className={subLabelStyle}>Manual Base Gross Override (€)</label>
                            <input type="number" step="0.01" className={inputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || null)} placeholder="Enter base gross" />
                         </div>
                      </div>
                   </div>
                   <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] flex flex-col justify-center text-center">
                      <p className={subLabelStyle}>Est. Net Payable</p>
                      <p className="text-5xl font-black text-emerald-700 tracking-tighter leading-none mb-1">€{payrollData.totalNet.toFixed(2)}</p>
                      <p className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest mt-2">{payrollData.taxBandUsed}</p>
                      <button onClick={() => setIsPreviewingCurrent(true)} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">GENERATE STAKEHOLDER REPORTS</button>
                   </div>
                </div>
             </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
             <section className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                     <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="px-8 py-5">Month</th>
                       <th className="px-8 py-5">Net (€)</th>
                       <th className="px-8 py-5 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {(user.payslips || []).map(ps => (
                         <tr key={ps.id}>
                            <td className="px-8 py-5 text-[10px] font-black uppercase">{ps.month}</td>
                            <td className="px-8 py-5 text-xs font-black text-[#0D9488]">€{ps.netPay.toFixed(2)}</td>
                            <td className="px-8 py-5 text-right">
                              <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-teal-50 text-teal-700 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase border border-teal-100">View Dossier</button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </section>
           )}
        </div>
      </div>

      {(viewingDoc || isPreviewingCurrent) && (
        <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto">
           <div className="bg-white rounded-[1.5rem] w-full max-w-4xl p-8 md:p-12 space-y-12 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setViewingDoc(null); setIsPreviewingCurrent(false); setActiveHistoricalPayslip(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 font-black text-2xl transition-colors no-print">&times;</button>
              
              <div ref={printContentRef} className="space-y-12 text-slate-900">
                 {/* STAKEHOLDER 1: EMPLOYEE VIEW */}
                 <div className="space-y-8">
                    <header className="flex justify-between items-end border-b-2 border-slate-900 pb-6">
                       <div>
                          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                          <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.4em] mt-2">1. Employee View (Payslip)</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{payrollData.isHistorical ? 'Registry Archived' : 'Pre-Issue Voucher'}</p>
                          <p className="text-base font-black uppercase">{selectedDocMonth}</p>
                       </div>
                    </header>
                    <div className="grid grid-cols-2 gap-10">
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <p className="flex justify-between text-xs font-bold uppercase"><span>Gross Basic:</span> <span className="font-mono">€{payrollData.grossBasic.toFixed(2)}</span></p>
                             <p className="flex justify-between text-xs font-bold uppercase text-teal-600"><span>Statutory Bonus ({payrollData.bonusLabel}):</span> <span className="font-mono">€{payrollData.govBonus.toFixed(2)}</span></p>
                             <div className="h-px bg-slate-100 my-2"></div>
                             <p className="flex justify-between text-xs font-black uppercase"><span>Taxable Gross:</span> <span className="font-mono">€{payrollData.taxableGross.toFixed(2)}</span></p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Band: {payrollData.taxBandUsed}</p>
                             <p className="flex justify-between text-xs font-bold uppercase text-rose-600"><span>FSS Tax Deduction:</span> <span className="font-mono">-€{payrollData.tax.toFixed(2)}</span></p>
                             <p className="flex justify-between text-xs font-bold uppercase text-rose-600"><span>NI Deduction (10%):</span> <span className="font-mono">-€{payrollData.niEmployee.toFixed(2)}</span></p>
                             <div className="h-px bg-slate-100 my-2"></div>
                             <p className="flex justify-between text-base font-black uppercase text-emerald-700"><span>Net Payable:</span> <span className="font-mono">€{payrollData.totalNet.toFixed(2)}</span></p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* STAKEHOLDER 2: EMPLOYER VIEW */}
                 <div className="bg-slate-900 p-8 rounded-3xl text-white space-y-6 shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">2. Employer View (Cost Ledger)</p>
                       <p className="text-[8px] font-bold uppercase text-white/40">Internal Reference Only</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Net to Employee</p>
                          <p className="text-xl font-black">€{payrollData.totalNet.toFixed(2)}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">FSS Tax (Due)</p>
                          <p className="text-xl font-black">€{payrollData.tax.toFixed(2)}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Total NI (Emp + Emplr)</p>
                          <p className="text-xl font-black">€{(payrollData.niEmployee + payrollData.niEmployer).toFixed(2)}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Maternity Cost (0.3%)</p>
                          <p className="text-xl font-black">€{payrollData.maternityFund.toFixed(2)}</p>
                       </div>
                       <div className="col-span-2 space-y-1 bg-white/5 p-4 rounded-xl">
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Total Disbursement Required</p>
                          <p className="text-3xl font-black text-white">€{(payrollData.totalNet + payrollData.tax + payrollData.niEmployee + payrollData.niEmployer + payrollData.maternityFund).toFixed(2)}</p>
                       </div>
                    </div>
                 </div>

                 {/* STAKEHOLDER 3: REVENUE COMMISSIONER VIEW */}
                 <div className="border border-slate-100 p-8 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">3. Commissioner View (FS5 Summary)</p>
                       <span className="text-[8px] font-black bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">Form ID: FS5-2026-GEN</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       <div className="space-y-1"><p className="text-[8px] font-bold text-slate-400 uppercase">Total Tax</p><p className="text-lg font-black">€{payrollData.tax.toFixed(2)}</p></div>
                       <div className="space-y-1"><p className="text-[8px] font-bold text-slate-400 uppercase">Total SSC (Class 1)</p><p className="text-lg font-black">€{(payrollData.niEmployee + payrollData.niEmployer).toFixed(2)}</p></div>
                       <div className="space-y-1"><p className="text-[8px] font-bold text-slate-400 uppercase">Mat. Fund</p><p className="text-lg font-black">€{payrollData.maternityFund.toFixed(2)}</p></div>
                       <div className="space-y-1 text-right"><p className="text-[8px] font-bold text-teal-600 uppercase">Total Remittance</p><p className="text-xl font-black text-teal-700">€{(payrollData.tax + payrollData.niEmployee + payrollData.niEmployer + payrollData.maternityFund).toFixed(2)}</p></div>
                    </div>
                 </div>
              </div>

              {!payrollData.isHistorical && (
                <div className="flex gap-4 pt-10 no-print">
                   <button onClick={handleCommitPayslip} className="flex-[2] bg-emerald-600 text-white font-black py-6 rounded-2xl uppercase tracking-[0.25em] text-[11px] shadow-2xl hover:bg-emerald-700 transition-all">CONFIRM & REGISTER FINANCIAL RECORD</button>
                   <button onClick={() => setIsPreviewingCurrent(false)} className="flex-1 bg-slate-100 text-slate-400 font-black py-6 rounded-2xl uppercase tracking-widest text-[11px]">Discard</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block";
const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

export default PersonnelProfile;
