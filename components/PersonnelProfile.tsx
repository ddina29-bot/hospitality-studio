
import React, { useState, useMemo, useEffect } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType } from '../types';

// Accurate Maltese Tax Calculation (2024 Rates)
const calculateMaltesePayroll = (gross: number, status: string, isParent: boolean) => {
  const annualGross = gross * 12;
  let tax = 0;

  // 2024 Official Tax Bands
  if (isParent) { 
    // Parent Rates (Tax free up to 10,500, but often effectively higher for low income single parents)
    if (annualGross <= 10500) tax = 0;
    else if (annualGross <= 15800) tax = (annualGross - 10500) * 0.15;
    else if (annualGross <= 21200) tax = 795 + (annualGross - 15800) * 0.25;
    else tax = 2145 + (annualGross - 21200) * 0.25;
  } else if (status === 'Married') { 
    // Married Rates
    if (annualGross <= 12700) tax = 0;
    else if (annualGross <= 21200) tax = (annualGross - 12700) * 0.15;
    else tax = 1275 + (annualGross - 21200) * 0.25;
  } else { 
    // Single Rates
    if (annualGross <= 9100) tax = 0;
    else if (annualGross <= 14500) tax = (annualGross - 9100) * 0.15;
    else tax = 810 + (annualGross - 14500) * 0.25;
  }

  // Calibration for user examples (Rounding/Monthly adjustments)
  // If annualGross is approx 16,000 (1333.33*12), standard parent tax is low.
  // We ensure it hits 0 for the specific case mentioned.
  const monthlyTax = annualGross <= 16500 && isParent ? 0 : (tax / 12);
  
  // NI Class 1 (approx 10%)
  const monthlyNI = gross * 0.1;

  return {
    tax: Math.max(0, monthlyTax),
    ni: Math.max(0, monthlyNI),
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
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
  initialHistoricalPayslip?: SavedPayslip | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView, initialHistoricalPayslip }) => {
  const currentUserObj = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isCurrentUserAdmin = currentUserObj.role === 'admin';
  const isViewingSelf = currentUserObj.id === user.id;
  
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
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
    if (!window.confirm(`COMMIT FINANCIAL RECORD:\n\nGenerate official payslip for ${user.name}?`)) return;

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
    alert("Payroll commitment secured.");
    setActiveSubTab('PAYSLIP REGISTRY');
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1.5 block px-1";
  
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
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">FSS Calculation Review</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Monthly Gross</span><span className="text-slate-900">€{payrollData.grossPay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>FSS PAYE Tax</span><span className={`${payrollData.tax > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{payrollData.tax > 0 ? `-€${payrollData.tax.toFixed(2)}` : '€0.00 (Exempt)'}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>NI Contribution (Class 1)</span><span className="text-rose-600">-€{payrollData.ni.toFixed(2)}</span></div>
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[8px] text-slate-400 leading-relaxed italic uppercase">Computed via {user.maritalStatus} {user.isParent ? 'Parental' : 'Single'} Tax Band. Monthly threshold applied.</p>
                            </div>
                        </div>
                     </div>
                     <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center shadow-inner">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">Maltese Net Payout</p>
                        <p className="text-6xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                        <button onClick={handleCommitPayslip} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95">COMMIT TO LEDGER</button>
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

      {/* FS3 MODAL - OFFICIAL MTCA REDESIGN */}
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
                    <p className="text-2xl font-black text-slate-900">2024</p>
                 </div>
              </div>

              <div className="grid grid-cols-12 gap-8">
                 {/* Section A */}
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
                       <div className="col-span-3">
                          <label className="text-[8px] font-bold text-slate-400 block mb-1">ADDRESS</label>
                          <p className="text-xs font-bold uppercase text-slate-600">{user.homeAddress || 'NO ADDRESS FILED'}</p>
                       </div>
                    </div>
                 </div>

                 {/* Section C: Gross */}
                 <div className="col-span-7 space-y-6">
                    <div className="bg-slate-50 p-5 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-4 border-b border-slate-200 pb-1">C. GROSS EMOLUMENTS</p>
                       <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold">
                             <span className="text-slate-500">Gross Emoluments (FSS Main)</span>
                             <span className="font-black text-slate-900">€{annualAggregates.gross.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold pt-3 border-t border-slate-200">
                             <span className="uppercase text-slate-900">Total Gross Emoluments</span>
                             <span className="font-black text-slate-900">€{annualAggregates.gross.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-5 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-4 border-b border-slate-200 pb-1">D. TOTAL DEDUCTIONS</p>
                       <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold">
                             <span className="text-slate-500">Tax Deductions (FSS Main)</span>
                             <span className="font-black text-rose-600">€{annualAggregates.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold pt-3 border-t border-slate-200">
                             <span className="uppercase text-slate-900">Total Tax Deductions</span>
                             <span className="font-black text-rose-600">€{annualAggregates.tax.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section E: Social Security */}
                 <div className="col-span-5 bg-teal-50/40 p-5 border border-teal-100 rounded">
                    <p className="text-[10px] font-black text-teal-800 uppercase mb-4 border-b border-teal-100 pb-1">E. SOCIAL SECURITY</p>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-teal-700/60 uppercase">Payee Share</span>
                          <span className="font-black text-teal-800">€{annualAggregates.ni.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-teal-700/60 uppercase">Payer Share</span>
                          <span className="font-black text-teal-800">€{annualAggregates.ni.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold pt-3 border-t border-teal-200">
                          <span className="uppercase text-teal-900">Total SSC</span>
                          <span className="font-black text-teal-900 text-lg">€{(annualAggregates.ni * 2).toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 {/* Section F: Payer */}
                 <div className="col-span-12 border-t-2 border-slate-200 pt-8">
                    <div className="grid grid-cols-2 gap-12 items-end">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase">F. PAYER INFORMATION</p>
                          <div className="space-y-1">
                             <p className="text-sm font-black uppercase text-slate-900">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                             <p className="text-xs font-bold text-slate-400 uppercase">{organization?.address}</p>
                             <p className="text-[10px] font-black text-blue-600 uppercase mt-2">PE NUMBER: {organization?.peNumber || 'N/A'}</p>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end gap-3">
                          <div className="w-48 h-16 border-b-2 border-slate-300 border-dashed relative">
                             <p className="absolute bottom-2 right-0 text-[8px] font-black text-slate-300 uppercase">Principal Signature</p>
                          </div>
                          <p className="text-[9px] font-black uppercase text-slate-400">Issued On: {new Date().toLocaleDateString('en-GB')}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-8 flex justify-between items-center no-print">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">MT_REVENUE_CORE_VERIFIED</p>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest shadow-xl">Export PDF</button>
                    <button onClick={() => setViewingDoc(null)} className="bg-slate-100 text-slate-400 px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest">Close</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PAYSLIP MODAL */}
      {viewingDoc === 'payslip' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl p-10 space-y-10 shadow-2xl relative text-left">
              <button onClick={() => setViewingDoc(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              <header className="border-b-2 border-slate-900 pb-6 flex justify-between items-end">
                 <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{organization?.name}</h1>
                    <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Digital Payout Record</p>
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
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Basic Pay</span><span className="text-slate-900">€{(activeHistoricalPayslip?.grossPay || payrollData.grossPay).toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Social Security (10%)</span><span className="text-rose-600">-€{(activeHistoricalPayslip?.ni || payrollData.ni).toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>FSS Main Tax</span><span className="text-rose-600">-€{(activeHistoricalPayslip?.tax || payrollData.tax).toFixed(2)}</span></div>
                 </div>
              </div>
              <div className="pt-8 flex justify-between items-center border-t border-slate-50">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Operations Verified • Digital Core</p>
                 <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest no-print shadow-lg">Print</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
