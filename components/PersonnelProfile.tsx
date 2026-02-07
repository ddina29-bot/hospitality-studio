
import React, { useState, useMemo, useEffect } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType } from '../types';

// Updated Maltese Tax Calculation (2026 Budget Alignment)
const calculateMaltesePayroll = (gross: number, status: string, isParent: boolean) => {
  const annualGross = gross * 12;
  let annualTax = 0;

  if (isParent) { 
    if (annualGross <= 16500) {
      annualTax = 0;
    } else if (annualGross <= 25000) {
      annualTax = (annualGross * 0.15) - 2475; 
    } else {
      annualTax = (annualGross * 0.25) - 4975;
    }
  } else if (status === 'Married') { 
    if (annualGross <= 17500) {
      annualTax = 0;
    } else {
      annualTax = (annualGross * 0.15) - 2625;
    }
  } else { 
    if (annualGross <= 12000) {
      annualTax = 0;
    } else {
      annualTax = (annualGross * 0.15) - 1800;
    }
  }

  const monthlyTax = Math.max(0, annualTax / 12);
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
    return { grossPay: baseSalary, ni: calc.ni, tax: calc.tax, totalNet: calc.net };
  }, [user, activeHistoricalPayslip]);

  const handleCommitPayslip = () => {
    if (!onUpdateUser) return;
    const newPayslip: SavedPayslip = {
      id: `ps-${Date.now()}`,
      month: selectedDocMonth,
      periodFrom: '', periodUntil: '',
      grossPay: payrollData.grossPay,
      netPay: payrollData.totalNet,
      tax: payrollData.tax,
      ni: payrollData.ni,
      niWeeks: 4, govBonus: 0, daysWorked: 20,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUserObj.name || 'Admin'
    };
    onUpdateUser({ ...user, payslips: [...(user.payslips || []), newPayslip] });
    setViewingDoc(null);
    setActiveSubTab('PAYSLIP REGISTRY');
  };

  // Helper to render box-digits for FS3
  const DigitBox = ({ value, length }: { value: string | number, length: number }) => {
    const s = String(value).replace(/[.,]/g, '').padStart(length, ' ');
    return (
      <div className="flex gap-0.5">
        {s.split('').map((char, i) => (
          <div key={i} className="w-5 h-7 border border-slate-400 bg-white flex items-center justify-center text-[11px] font-bold text-slate-800">
            {char === ' ' ? '' : char}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-transparent min-h-fit text-left font-brand animate-in fade-in duration-500">
      <div className="mx-auto space-y-6">
        {/* Profile Card - Compact */}
        <section className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-5 text-left">
              <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-xl shadow-inner border border-teal-100 overflow-hidden shrink-0">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div>
                 <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight truncate max-w-[200px]">{user.name}</h2>
                 <p className="text-[8px] font-black text-[#0D9488] uppercase tracking-widest mt-0.5">{user.role} • {user.paymentType}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase">
                    {user.maritalStatus} • {user.isParent ? `Parent Status` : 'Single Status'}
                 </p>
              </div>
           </div>
           <div className="flex gap-2">
              <div className="bg-slate-50 px-5 py-2 rounded-xl border border-slate-100 text-center">
                 <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">GROSS</p>
                 <p className="text-xs font-black text-slate-900">€{user.payRate?.toFixed(2)}</p>
              </div>
              {isCurrentUserAdmin && (
                <button onClick={() => setViewingDoc('fs3')} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">FS3</button>
              )}
           </div>
        </section>

        <div className="space-y-4">
           <div className="flex gap-6 border-b border-slate-200 px-2">
              {['PENDING PAYOUTS', 'PAYSLIP REGISTRY'].map(tab => (
                 (tab === 'PENDING PAYOUTS' && !isCurrentUserAdmin) ? null : (
                   <button key={tab} onClick={() => setActiveSubTab(tab as any)} className={`pb-3 text-[9px] font-black tracking-widest relative transition-all ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                      {tab}
                      {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488]"></div>}
                   </button>
                 )
              ))}
           </div>

           {activeSubTab === 'PENDING PAYOUTS' && (
              <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-md space-y-6 animate-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="space-y-4 text-left">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">FSS Summary (2026 Rules)</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>Monthly Gross</span><span className="text-slate-900">€{payrollData.grossPay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>PAYE Tax</span><span className={`${payrollData.tax > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{payrollData.tax > 0 ? `-€${payrollData.tax.toFixed(2)}` : '€0.00 (Exempt)'}</span></div>
                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>NI (10%)</span><span className="text-rose-600">-€{payrollData.ni.toFixed(2)}</span></div>
                        </div>
                     </div>
                     <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col justify-center shadow-inner group">
                        <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-2">Net Wage Payout</p>
                        <p className="text-4xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                        <button onClick={() => setViewingDoc('preview')} className="mt-6 bg-slate-900 text-white font-black py-3 rounded-lg uppercase text-[8px] tracking-widest shadow-lg group-hover:bg-emerald-600">PREVIEW & COMMIT</button>
                     </div>
                  </div>
              </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
              <div className="bg-white border border-slate-100 rounded-2xl shadow-md overflow-hidden text-left">
                  <table className="w-full">
                     <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                           <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                           <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Net (€)</th>
                           <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {(user.payslips || []).length === 0 ? (
                           <tr><td colSpan={3} className="px-6 py-10 text-center opacity-20 text-[8px] uppercase font-black">No history</td></tr>
                        ) : [...(user.payslips || [])].reverse().map(ps => (
                           <tr key={ps.id}>
                              <td className="px-6 py-4 text-[9px] font-black text-slate-900 uppercase">{ps.month}</td>
                              <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">€{ps.netPay.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right">
                                 <button onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }} className="text-[#0D9488] text-[8px] font-black uppercase underline">View</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
              </div>
           )}
        </div>
      </div>

      {/* FS3 ANNUAL MODAL - LEGAL FORMAT MATCH */}
      {viewingDoc === 'fs3' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-[#FFFFFF] rounded-sm w-full max-w-5xl p-8 space-y-4 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border-2 border-slate-300 font-sans text-slate-900 leading-tight">
              <button onClick={() => setViewingDoc(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              
              {/* Header Section */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                 <div className="flex items-center gap-4">
                    <img src="https://logodix.com/logo/2012053.png" className="h-10 grayscale brightness-0" alt="Malta Tax" />
                    <div>
                       <h1 className="text-[10px] font-black uppercase leading-tight">Tax & Customs Administration</h1>
                       <p className="text-[8px] font-bold uppercase text-slate-500">Malta</p>
                    </div>
                 </div>
                 <div className="text-center">
                    <h2 className="text-5xl font-black text-[#3B82F6] italic tracking-tighter">FS3</h2>
                 </div>
                 <div className="text-right">
                    <h2 className="text-[12px] font-black uppercase tracking-tight">Final Settlement System (FSS)</h2>
                    <p className="text-[10px] uppercase font-medium">Payee Statement of Earnings</p>
                 </div>
              </div>

              {/* Main Form Content */}
              <div className="grid grid-cols-12 gap-x-6 gap-y-4">
                 
                 {/* A. PAYEE INFORMATION */}
                 <div className="col-span-7 space-y-2">
                    <div className="bg-[#3B82F6] text-white px-2 py-0.5 text-[10px] font-black uppercase">A PAYEE INFORMATION</div>
                    <div className="grid grid-cols-2 gap-4 border border-slate-200 p-3">
                       <div className="space-y-3">
                          <div>
                            <label className="text-[8px] font-bold text-slate-500 block">Surname</label>
                            <p className="text-xs font-black uppercase border-b border-slate-100 pb-1">{user.name.split(' ').pop()}</p>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-500 block">First Name</label>
                            <p className="text-xs font-black uppercase border-b border-slate-100 pb-1">{user.name.split(' ')[0]}</p>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-500 block">Address</label>
                            <p className="text-[10px] font-bold uppercase leading-tight whitespace-pre-line">{user.homeAddress || 'N/A'}</p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center">
                             <label className="text-[8px] font-black uppercase text-slate-600">For Year Ended 31 December</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[8px] font-bold">A1</span>
                                <DigitBox value="2025" length={4} />
                             </div>
                          </div>
                          <div className="flex justify-between items-center">
                             <label className="text-[8px] font-black uppercase text-slate-600">Payee's ID Card / IT Reg. No.</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[8px] font-bold">A2</span>
                                <DigitBox value={user.idPassportNumber || ''} length={9} />
                             </div>
                          </div>
                          <div className="flex justify-between items-center">
                             <label className="text-[8px] font-black uppercase text-slate-600">Payee's Social Security No.</label>
                             <div className="flex gap-2 items-center">
                                <span className="text-[8px] font-bold">A3</span>
                                <DigitBox value={user.niNumber || ''} length={9} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* C. GROSS EMOLUMENTS */}
                 <div className="col-span-5 space-y-2">
                    <div className="bg-[#3B82F6] text-white px-2 py-0.5 text-[10px] font-black uppercase">C GROSS EMOLUMENTS</div>
                    <div className="border border-slate-200 p-3 space-y-3">
                       <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold text-slate-700 w-48">Gross Emoluments (FSS Main applies)</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-[8px] font-bold text-slate-400">C1</span>
                             <DigitBox value={Math.floor(annualAggregates.gross)} length={5} />
                          </div>
                       </div>
                       <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold text-slate-700 w-48 italic">Total Gross Emoluments & Benefits</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-[8px] font-bold text-slate-400">C4</span>
                             <DigitBox value={Math.floor(annualAggregates.gross)} length={5} />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* D. TOTAL DEDUCTIONS */}
                 <div className="col-span-12 space-y-2">
                    <div className="bg-[#3B82F6] text-white px-2 py-0.5 text-[10px] font-black uppercase">D TOTAL DEDUCTIONS</div>
                    <div className="border border-slate-200 p-3 grid grid-cols-2 gap-8">
                       <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold text-slate-700">Tax Deductions (FSS Main applies)</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-[8px] font-bold text-slate-400">D1</span>
                             <DigitBox value={Math.floor(annualAggregates.tax)} length={5} />
                          </div>
                       </div>
                       <div className="flex justify-between items-center bg-slate-50 p-2">
                          <label className="text-[9px] font-black text-slate-900 uppercase">Total Tax Deductions</label>
                          <div className="flex gap-2 items-center">
                             <span className="text-[8px] font-bold text-slate-400">D4</span>
                             <DigitBox value={Math.floor(annualAggregates.tax)} length={5} />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* E. SOCIAL SECURITY & MATERNITY FUND */}
                 <div className="col-span-12 space-y-2">
                    <div className="bg-[#3B82F6] text-white px-2 py-0.5 text-[10px] font-black uppercase">E SOCIAL SECURITY AND MATERNITY FUND INFORMATION</div>
                    <div className="border border-slate-200 overflow-hidden">
                       <table className="w-full text-center border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[8px] font-black uppercase text-slate-600">
                             <tr>
                                <th className="border-r border-slate-200 p-1" colSpan={3}>Basic Weekly Wage</th>
                                <th className="border-r border-slate-200 p-1" rowSpan={2}>Cat</th>
                                <th className="border-r border-slate-200 p-1" colSpan={3}>Social Security Contributions</th>
                                <th className="p-1" colSpan={2}>Maternity Fund</th>
                             </tr>
                             <tr>
                                <th className="border-r border-slate-200 p-1">€</th>
                                <th className="border-r border-slate-200 p-1">C</th>
                                <th className="border-r border-slate-200 p-1">Number</th>
                                <th className="border-r border-slate-200 p-1">Payee (€)</th>
                                <th className="border-r border-slate-200 p-1">Payer (€)</th>
                                <th className="border-r border-slate-200 p-1">Total SSC (€)</th>
                                <th className="p-1">Payer (€)</th>
                             </tr>
                          </thead>
                          <tbody className="text-[10px] font-bold">
                             <tr>
                                <td className="border-r border-slate-200 p-2">{(user.payRate ? user.payRate/4.33 : 0).toFixed(0)}</td>
                                <td className="border-r border-slate-200 p-2">00</td>
                                <td className="border-r border-slate-200 p-2">52</td>
                                <td className="border-r border-slate-200 p-2">C</td>
                                <td className="border-r border-slate-200 p-2 text-blue-700">{annualAggregates.ni.toFixed(2)}</td>
                                <td className="border-r border-slate-200 p-2 opacity-20">0.00</td>
                                <td className="border-r border-slate-200 p-2 text-indigo-900">{annualAggregates.ni.toFixed(2)}</td>
                                <td className="p-2 opacity-20">0.00</td>
                             </tr>
                             <tr className="bg-slate-100 font-black">
                                <td className="border-r border-slate-200 p-1" colSpan={4}>TOTAL</td>
                                <td className="border-r border-slate-200 p-1 text-blue-800">{annualAggregates.ni.toFixed(2)}</td>
                                <td className="border-r border-slate-200 p-1">0.00</td>
                                <td className="border-r border-slate-200 p-1 text-indigo-900">{annualAggregates.ni.toFixed(2)}</td>
                                <td className="p-1">0.00</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* F. PAYER INFORMATION */}
                 <div className="col-span-12 space-y-2">
                    <div className="bg-[#3B82F6] text-white px-2 py-0.5 text-[10px] font-black uppercase">F PAYER INFORMATION</div>
                    <div className="border border-slate-200 p-4 grid grid-cols-2 gap-12">
                       <div className="space-y-4">
                          <div>
                             <label className="text-[8px] font-bold text-slate-500 uppercase">Business Name</label>
                             <p className="text-xs font-black uppercase border-b border-slate-200 pb-1">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                          </div>
                          <div>
                             <label className="text-[8px] font-bold text-slate-500 uppercase">Principal's Full Name</label>
                             <p className="text-xs font-black uppercase border-b border-slate-200 pb-1">{currentUserObj.name || 'Dina Dadai'}</p>
                          </div>
                          <div className="flex gap-10">
                             <div className="flex-1">
                                <label className="text-[8px] font-bold text-slate-500 uppercase">Principal's Signature</label>
                                <div className="h-10 italic font-serif text-lg opacity-80 pt-2 border-b border-slate-200">
                                   {currentUserObj.name || 'Dina'}
                                </div>
                             </div>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center">
                             <label className="text-[8px] font-black uppercase text-slate-600">F1 Payer PE Number</label>
                             <DigitBox value={organization?.peNumber || '12522'} length={5} />
                          </div>
                          <div className="flex justify-between items-center">
                             <label className="text-[8px] font-black uppercase text-slate-600">F2 Date</label>
                             <DigitBox value={new Date().toLocaleDateString('en-GB').replace(/\//g, '')} length={8} />
                          </div>
                          <div className="pt-4">
                             <p className="text-[7px] text-slate-400 leading-tight italic uppercase">
                                This form is to be completed in quadruplicate. The original is to be sent to the 
                                Malta Tax and Customs Administration with the FS7, two copies are to be given 
                                to the Payee and the other copy is to be retained by the Payer. 
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-4 flex justify-between items-center no-print">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">CERTIFIED_MTA_REPLICA_V1</p>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest shadow-xl">Export PDF</button>
                    <button onClick={() => setViewingDoc(null)} className="bg-slate-100 text-slate-400 px-8 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest border border-slate-200">Close</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PAYSLIP / PREVIEW MODAL - Compacted */}
      {(viewingDoc === 'payslip' || viewingDoc === 'preview') && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-xl w-full max-w-xl p-6 md:p-10 space-y-6 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => { setViewingDoc(null); setActiveHistoricalPayslip(null); }} className="absolute top-4 right-4 text-slate-300 hover:text-slate-900 text-xl no-print">&times;</button>
              
              <header className="border-b border-slate-900 pb-4 flex justify-between items-end">
                 <div className="space-y-0.5">
                    <h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{organization?.legalEntity || organization?.name}</h1>
                    <p className="text-[7px] font-black text-teal-600 uppercase tracking-widest">{viewingDoc === 'preview' ? 'DRAFT PREVIEW' : 'OFFICIAL PAYSLIP'}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-900 uppercase">{user.name}</p>
                    <p className="text-[8px] font-bold text-slate-400">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                 </div>
              </header>

              <div className="space-y-4">
                 <div className="flex justify-between items-center text-3xl font-black text-emerald-600 border-b border-slate-100 pb-4">
                    <span className="uppercase tracking-tighter text-lg text-slate-300">Net Wages</span>
                    <span>€{(activeHistoricalPayslip?.netPay || payrollData.totalNet).toFixed(2)}</span>
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Monthly Gross</span><span className="text-slate-900">€{(activeHistoricalPayslip?.grossPay || payrollData.grossPay).toFixed(2)}</span></div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>NI (Payee Share)</span><span className="text-rose-600">-€{(activeHistoricalPayslip?.ni || payrollData.ni).toFixed(2)}</span></div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>FSS Tax</span><span className={`${(activeHistoricalPayslip?.tax || payrollData.tax) > 0 ? 'text-rose-600' : 'text-emerald-600'} font-black`}>-€{(activeHistoricalPayslip?.tax || payrollData.tax).toFixed(2)}</span></div>
                 </div>
              </div>

              <div className="pt-6 flex justify-between items-center border-t border-slate-50 no-print">
                 <button onClick={() => window.print()} className="bg-slate-100 text-slate-500 px-5 py-2 rounded-lg text-[8px] font-black uppercase">Print</button>
                 {viewingDoc === 'preview' && (
                    <button onClick={handleCommitPayslip} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-[8px] font-black uppercase shadow-lg">AUTHORIZE & COMMIT</button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
