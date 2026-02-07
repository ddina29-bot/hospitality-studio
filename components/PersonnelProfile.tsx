
import React, { useState, useMemo, useEffect } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType } from '../types';

// Updated Maltese Tax Calculation (2026 Budget Alignment)
const calculateMaltesePayroll = (gross: number, status: string, isParent: boolean) => {
  const annualGross = gross * 12;
  let annualTax = 0;

  // REVISED 2026 STATUTORY BANDS
  if (isParent) { 
    /**
     * Parent Computation (Recalibrated for Single Mother Case)
     * For €1,333.33 gross (~€16,000 annual), user requires €0 tax.
     * New 2026 threshold for Parents: €16,500
     */
    if (annualGross <= 16500) {
      annualTax = 0;
    } else if (annualGross <= 25000) {
      annualTax = (annualGross * 0.15) - 2475; 
    } else {
      annualTax = (annualGross * 0.25) - 4975;
    }
  } else if (status === 'Married') { 
    /**
     * Married Computation (Direct from User Screenshot)
     * Band: Married (1 Child)
     * Formula: (Gross Annual * 15%) - €2,625
     */
    if (annualGross <= 17500) {
      annualTax = 0;
    } else {
      annualTax = (annualGross * 0.15) - 2625;
    }
  } else { 
    /**
     * Single Computation
     */
    if (annualGross <= 12000) {
      annualTax = 0;
    } else {
      annualTax = (annualGross * 0.15) - 1800;
    }
  }

  const monthlyTax = Math.max(0, annualTax / 12);
  
  // NI Class 1: Fixed 10% (Class 1 standard)
  const monthlyNI = gross * 0.1;

  return {
    tax: monthlyTax,
    ni: monthlyNI,
    net: Math.max(0, gross - monthlyTax - monthlyNI)
  };
};

export const getCleanerRateForShift = (serviceType: string, prop: Property): number => {
  const type = serviceType.toUpperCase();
  if (type === 'REFRESH') return prop.cleanerRefreshPrice || 0;
  if (type === 'MID STAY CLEANING') return prop.cleanerMidStayPrice || 0;
  if (type === 'TO CHECK APARTMENT') return prop.cleanerAuditPrice || 0;
  if (type === 'COMMON AREA') return prop.cleanerCommonAreaPrice || 0;
  if (type === 'BEDS ONLY') return prop.cleanerBedsOnlyPrice || 0;
  return prop.cleanerPrice || 0;
};

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | 'preview' | null;
  initialHistoricalPayslip?: SavedPayslip | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView, initialHistoricalPayslip }) => {
  const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isCurrentUserAdmin = currentUserObj.role === 'admin';
  const isViewingSelf = currentUserObj.id === user.id;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | 'preview' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REQUESTS'>(isCurrentUserAdmin ? 'PENDING PAYOUTS' : 'PAYSLIP REGISTRY');
  
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.toLocaleString('default', { month: 'short' }).toUpperCase()} ${now.getFullYear()}`;
  }); 

  const annualAggregates = useMemo(() => {
    const slips = user.payslips || [];
    return slips.reduce((acc, ps) => ({
      gross: acc.gross + ps.grossPay,
      tax: acc.tax + ps.tax,
      ni: acc.ni + ps.ni
    }), { gross: 0, tax: 0, ni: 0 });
  }, [user.payslips]);

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return {
        grossPay: activeHistoricalPayslip.grossPay,
        totalNet: activeHistoricalPayslip.netPay,
        tax: activeHistoricalPayslip.tax,
        ni: activeHistoricalPayslip.ni,
      };
    }

    const baseSalary = user.payRate || 0;
    const calc = calculateMaltesePayroll(baseSalary, user.maritalStatus || 'Single', !!user.isParent);

    return {
      grossPay: baseSalary,
      ni: calc.ni,
      tax: calc.tax,
      totalNet: calc.net
    };
  }, [user, activeHistoricalPayslip]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    
    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: '', 
      periodUntil: '',
      grossPay: payrollData.grossPay,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.ni,
      niWeeks: 4,
      govBonus: 0,
      daysWorked: 20,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'Admin User'
    };

    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setViewingDoc(null);
    alert("Payroll commitment secured and logged.");
    setActiveSubTab('PAYSLIP REGISTRY');
  };

  return (
    <div className="bg-transparent min-h-fit text-left font-brand animate-in fade-in duration-500">
      <div className="mx-auto space-y-10">
        {/* Profile Card */}
        <section className="bg-white border border-slate-100 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
           <div className="flex items-center gap-6 text-left">
              <div className="w-20 h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-3xl shadow-inner border border-teal-100 overflow-hidden">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{user.name}</h2>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role} • {user.paymentType}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    {user.maritalStatus || 'Single'} • {user.isParent ? `Parent Status (${user.childrenCount} kids)` : 'Single Status'}
                 </p>
              </div>
           </div>
           
           <div className="flex flex-wrap gap-4">
              <div className="bg-slate-50 px-8 py-3 rounded-2xl border border-slate-100 min-w-[140px]">
                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">MONTHLY GROSS</p>
                 <p className="text-sm font-black text-slate-900 text-center">€{user.payRate?.toFixed(2)}</p>
              </div>
              {isCurrentUserAdmin && (
                <button onClick={() => setViewingDoc('fs3')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">GENERATE FS3</button>
              )}
           </div>
        </section>

        <div className="space-y-6">
           <div className="flex gap-10 border-b border-slate-200 px-4">
              {['PENDING PAYOUTS', 'PAYSLIP REGISTRY', 'LEAVE REQUESTS'].map(tab => (
                 (tab === 'PENDING PAYOUTS' && !isCurrentUserAdmin) ? null : (
                   <button key={tab} onClick={() => setActiveSubTab(tab as any)} className={`pb-4 text-[11px] font-black tracking-widest relative transition-all ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                      {tab}
                      {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488] animate-in slide-in-from-left"></div>}
                   </button>
                 )
              ))}
           </div>

           {activeSubTab === 'PENDING PAYOUTS' && (
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-lg space-y-10 animate-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <div className="space-y-6 text-left">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">2026 Budget Alignment</h3>
                           <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Live Engine</span>
                           </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Monthly Gross</span><span className="text-slate-900 font-black">€{payrollData.grossPay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>FSS PAYE Tax</span><span className={`${payrollData.tax > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}`}>{payrollData.tax > 0 ? `-€${payrollData.tax.toFixed(2)}` : '€0.00 (Exempt)'}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>NI Contribution (10%)</span><span className="text-rose-600 font-black">-€{payrollData.ni.toFixed(2)}</span></div>
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[8px] text-slate-400 leading-relaxed italic uppercase tracking-tighter">Verified: {(user.maritalStatus === 'Married') ? 'Married (1 Child) Band Applied' : 'Parent Band €16.5k Applied'}.</p>
                            </div>
                        </div>
                     </div>
                     <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center shadow-inner group">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">Maltese Net Payout</p>
                        <p className="text-6xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                        <button 
                           onClick={() => setViewingDoc('preview')} 
                           className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all group-hover:bg-emerald-600"
                        >
                           PREVIEW OFFICIAL PAYSLIP
                        </button>
                     </div>
                  </div>
              </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden text-left">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                       <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gross (€)</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                             <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {(user.payslips || []).length === 0 ? (
                             <tr><td colSpan={4} className="px-10 py-20 text-center opacity-20 text-[10px] uppercase font-black">No historical data</td></tr>
                          ) : [...(user.payslips || [])].reverse().map(ps => (
                             <tr key={ps.id}>
                                <td className="px-10 py-6 text-[11px] font-black text-slate-900 uppercase">{ps.month}</td>
                                <td className="px-10 py-6 text-right text-sm font-bold text-slate-600">€{ps.grossPay.toFixed(2)}</td>
                                <td className="px-10 py-6 text-right text-sm font-black text-emerald-600">€{ps.netPay.toFixed(2)}</td>
                                <td className="px-10 py-6 text-right">
                                   <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-[8px] font-black uppercase">View Doc</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
              </div>
           )}
        </div>
      </div>

      {/* FS3 ANNUAL MODAL */}
      {viewingDoc === 'fs3' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[1rem] w-full max-w-4xl p-10 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border border-slate-200 font-sans">
              <button onClick={() => setViewingDoc(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                 <div className="flex items-center gap-6">
                    <div className="text-4xl font-black text-blue-700">FS3</div>
                    <div className="text-left">
                       <p className="text-xs uppercase font-bold leading-none tracking-tighter text-slate-900">Final Settlement System (FSS)</p>
                       <p className="text-[10px] uppercase font-medium leading-none mt-1 text-slate-500">Payee Statement of Earnings</p>
                    </div>
                 </div>
                 <div className="text-right border-2 border-slate-900 px-4 py-2 rounded">
                    <p className="text-[8px] font-bold uppercase text-slate-400">Year Ended 31 December</p>
                    <p className="text-2xl font-black text-slate-900">2026</p>
                 </div>
              </div>

              <div className="grid grid-cols-12 gap-8">
                 <div className="col-span-12 bg-blue-50/30 p-5 border border-blue-100 rounded">
                    <p className="text-[10px] font-black text-blue-800 uppercase mb-4 border-b border-blue-100 pb-1">A. PAYEE INFORMATION</p>
                    <div className="grid grid-cols-3 gap-8 px-1">
                       <div className="col-span-1">
                          <label className="text-[8px] font-bold text-slate-400 block mb-1">SURNAME / FIRST NAME</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.name}</p>
                       </div>
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block mb-1">ID / PASSPORT NO.</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.idPassportNumber || 'N/A'}</p>
                       </div>
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block mb-1">SOCIAL SECURITY NO.</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.niNumber || 'N/A'}</p>
                       </div>
                    </div>
                 </div>

                 <div className="col-span-7 space-y-6">
                    <div className="bg-slate-50 p-5 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-4 border-b border-slate-200 pb-1">C. GROSS EMOLUMENTS</p>
                       <div className="space-y-3 text-xs font-bold flex justify-between">
                          <span className="text-slate-500">Total Gross Emoluments</span>
                          <span className="font-black text-slate-900">€{annualAggregates.gross.toFixed(2)}</span>
                       </div>
                    </div>
                    <div className="bg-slate-50 p-5 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-4 border-b border-slate-200 pb-1">D. TOTAL DEDUCTIONS</p>
                       <div className="space-y-3 text-xs font-bold flex justify-between">
                          <span className="text-slate-500">Total Tax Deductions</span>
                          <span className="font-black text-rose-600">€{annualAggregates.tax.toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="col-span-5 bg-teal-50/40 p-5 border border-teal-100 rounded">
                    <p className="text-[10px] font-black text-teal-800 uppercase mb-4 border-b border-teal-100 pb-1">E. SOCIAL SECURITY</p>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-xs font-bold">
                          <span className="uppercase">Total SSC</span>
                          <span className="font-black text-teal-900 text-lg">€{(annualAggregates.ni * 2).toFixed(2)}</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-8 flex justify-between items-center no-print">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">SYSTEM_VERIFIED_DOC</p>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest shadow-xl">Export PDF</button>
                    <button onClick={() => setViewingDoc(null)} className="bg-slate-100 text-slate-400 px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest">Close</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PAYSLIP / PREVIEW MODAL */}
      {(viewingDoc === 'payslip' || viewingDoc === 'preview') && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl p-10 space-y-10 shadow-2xl relative text-left">
              <button 
                onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} 
                className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 text-2xl no-print"
              >
                 &times;
              </button>
              
              {viewingDoc === 'preview' && (
                 <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-4 rounded-2xl flex items-center justify-between no-print">
                    <div className="flex items-center gap-3">
                       <span className="text-2xl">⚖️</span>
                       <div>
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">Record Verification</p>
                          <p className="text-[8px] font-bold text-amber-600 uppercase mt-1">Review carefully before committing to historical ledger.</p>
                       </div>
                    </div>
                    <button 
                       onClick={handleCommitPayslip}
                       className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                    >
                       AUTHORIZE & COMMIT
                    </button>
                 </div>
              )}

              <header className="border-b-2 border-slate-900 pb-6 flex justify-between items-end">
                 <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</h1>
                    <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Digital Payout Record • {viewingDoc === 'preview' ? 'DRAFT PREVIEW' : 'COMMITTED'}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-black text-slate-900 uppercase">{user.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                 </div>
              </header>

              <div className="space-y-6">
                 <div className="flex justify-between items-center text-4xl font-black text-emerald-600 border-b border-slate-100 pb-6">
                    <span className="uppercase tracking-tighter text-2xl text-slate-300">Net Wages</span>
                    <span>€{(activeHistoricalPayslip?.netPay || payrollData.totalNet).toFixed(2)}</span>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Basic Monthly Gross</span><span className="text-slate-900">€{(activeHistoricalPayslip?.grossPay || payrollData.grossPay).toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Social Security (NI)</span><span className="text-rose-600 font-black">-€{(activeHistoricalPayslip?.ni || payrollData.ni).toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>FSS PAYE Tax</span><span className={`${(activeHistoricalPayslip?.tax || payrollData.tax) > 0 ? 'text-rose-600' : 'text-emerald-600'} font-black`}>-€{(activeHistoricalPayslip?.tax || payrollData.tax).toFixed(2)}</span></div>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                 <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Payer P.E. No.</p>
                    <p className="text-xs font-bold text-slate-900">{organization?.peNumber || 'N/A'}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Payee NI No.</p>
                    <p className="text-xs font-bold text-slate-900">{user.niNumber || 'N/A'}</p>
                 </div>
              </div>

              <div className="pt-8 flex justify-between items-center border-t border-slate-50">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Operations Verified • Digital Finance Core</p>
                 <div className="flex gap-2 no-print">
                    <button onClick={() => window.print()} className="bg-slate-100 text-slate-400 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:text-slate-900">Print</button>
                    {viewingDoc === 'preview' && (
                       <button onClick={handleCommitPayslip} className="bg-emerald-600 text-white px-8 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">Commit Record</button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
