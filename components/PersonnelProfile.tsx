
import React, { useState, useMemo, useEffect } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings, SavedPayslip, PaymentType } from '../types';

// Helper for Maltese Tax Calculation (2024 Rates)
const calculateMaltesePayroll = (gross: number, status: string, isParent: boolean) => {
  const annualGross = gross * 12;
  let tax = 0;

  // Simplified 2024 Tax Bands
  if (isParent) { // Parent Rates
    if (annualGross <= 10500) tax = 0;
    else if (annualGross <= 15800) tax = (annualGross - 10500) * 0.15;
    else if (annualGross <= 21200) tax = ((15800 - 10500) * 0.15) + (annualGross - 15800) * 0.25;
    else tax = ((15800 - 10500) * 0.15) + ((21200 - 15800) * 0.25) + (annualGross - 21200) * 0.25;
  } else if (status === 'Married') { // Married Rates
    if (annualGross <= 12700) tax = 0;
    else if (annualGross <= 21200) tax = (annualGross - 12700) * 0.15;
    else tax = ((21200 - 12700) * 0.15) + (annualGross - 21200) * 0.25;
  } else { // Single Rates
    if (annualGross <= 9100) tax = 0;
    else if (annualGross <= 14500) tax = (annualGross - 9100) * 0.15;
    else tax = ((14500 - 9100) * 0.15) + (annualGross - 14500) * 0.25;
  }

  const monthlyTax = tax / 12;
  // NI Class 1 (approx 10% capped at ~€53/week for 2024)
  const weeklyNI = Math.min(53.48, (gross / 4.33) * 0.1);
  const monthlyNI = weeklyNI * 4.33;

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
  
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.toLocaleString('default', { month: 'short' }).toUpperCase()} ${now.getFullYear()}`;
  }); 

  // FIX: Calculate annual aggregates from historical payslips for FS3 generation
  const annualAggregates = useMemo(() => {
    return (user.payslips || []).reduce((acc, ps) => ({
      gross: acc.gross + (ps.grossPay || 0),
      tax: acc.tax + (ps.tax || 0),
      ni: acc.ni + (ps.ni || 0)
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
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-inner";

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
                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{user.maritalStatus || 'Single'} • {user.isParent ? `Parent (${user.childrenCount})` : 'No Children'}</p>
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
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Est. Tax (PAYE)</span><span className="text-rose-600">-€{payrollData.tax.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Est. NI Contribution</span><span className="text-rose-600">-€{payrollData.ni.toFixed(2)}</span></div>
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[8px] text-slate-400 leading-relaxed italic">Calculated using 2024 Maltese Statutory Rates for {user.maritalStatus} {user.isParent ? 'Parent' : 'Individual'}.</p>
                            </div>
                        </div>
                     </div>
                     <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">Calculated Net Payout</p>
                        <p className="text-6xl font-black text-emerald-700 tracking-tighter leading-none">€{payrollData.totalNet.toFixed(2)}</p>
                        <button onClick={handleCommitPayslip} className="mt-8 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95">COMMIT PAYROLL RECORD</button>
                     </div>
                  </div>
              </section>
           )}

           {activeSubTab === 'PAYSLIP REGISTRY' && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden text-left animate-in slide-in-from-right-4">
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
                             <tr><td colSpan={4} className="px-10 py-20 text-center opacity-20 text-[10px] uppercase font-black">No payslips found</td></tr>
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

      {/* FS3 ANNUAL MODAL (Official Layout) */}
      {viewingDoc === 'fs3' && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[1rem] w-full max-w-4xl p-10 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95 border border-slate-200 font-sans">
              <button onClick={() => setViewingDoc(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 text-2xl no-print">&times;</button>
              
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                 <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                       <span className="text-blue-600">FS3</span>
                       <div className="text-left">
                          <p className="text-xs uppercase font-bold leading-none tracking-tighter">Final Settlement System (FSS)</p>
                          <p className="text-[10px] uppercase font-medium leading-none mt-1">Payee Statement of Earnings</p>
                       </div>
                    </h1>
                 </div>
                 <div className="text-right border-2 border-slate-900 px-4 py-2 rounded">
                    <p className="text-[8px] font-bold uppercase">Year Ended 31 December</p>
                    <p className="text-xl font-black">{new Date().getFullYear()}</p>
                 </div>
              </div>

              <div className="grid grid-cols-12 gap-8">
                 {/* Section A */}
                 <div className="col-span-12 bg-blue-50/50 p-4 border border-blue-100 rounded">
                    <p className="text-[10px] font-black text-blue-800 uppercase mb-3 px-1 border-b border-blue-200 pb-1">A. PAYEE INFORMATION</p>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4 px-1">
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block">Surname / First Name</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.name}</p>
                       </div>
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block">ID / Passport Number</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.idPassportNumber || 'N/A'}</p>
                       </div>
                       <div className="col-span-2">
                          <label className="text-[8px] font-bold text-slate-400 block">Address</label>
                          <p className="text-sm font-bold uppercase text-slate-900">{user.homeAddress || 'N/A'}</p>
                       </div>
                    </div>
                 </div>

                 {/* Section C & D */}
                 <div className="col-span-7 space-y-6">
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-3 border-b border-slate-200 pb-1">C. GROSS EMOLUMENTS</p>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold px-1">
                             <span>Gross Emoluments (FSS Main)</span>
                             <span className="font-black">€{annualAggregates.gross.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold px-1 pt-2 border-t border-slate-200">
                             <span className="uppercase">Total Gross Emoluments</span>
                             <span className="font-black">€{annualAggregates.gross.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 rounded">
                       <p className="text-[10px] font-black text-slate-800 uppercase mb-3 border-b border-slate-200 pb-1">D. TOTAL DEDUCTIONS</p>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold px-1">
                             <span>Tax Deductions (FSS Main)</span>
                             <span className="font-black">€{annualAggregates.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold px-1 pt-2 border-t border-slate-200">
                             <span className="uppercase">Total Tax Deductions</span>
                             <span className="font-black">€{annualAggregates.tax.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section E */}
                 <div className="col-span-5 bg-teal-50/50 p-4 border border-teal-100 rounded">
                    <p className="text-[10px] font-black text-teal-800 uppercase mb-3 border-b border-teal-200 pb-1">E. SOCIAL SECURITY</p>
                    <div className="space-y-6">
                       <div>
                          <label className="text-[8px] font-bold text-slate-400 block">NI Number</label>
                          <p className="text-sm font-black uppercase text-slate-900">{user.niNumber || 'N/A'}</p>
                       </div>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold px-1">
                             <span>Total NI Contribution</span>
                             <span className="font-black">€{annualAggregates.ni.toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section F */}
                 <div className="col-span-12 border-t-2 border-slate-200 pt-6">
                    <div className="grid grid-cols-2 gap-12 items-end">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase">F. PAYER INFORMATION</p>
                          <div className="space-y-1">
                             <p className="text-xs font-black uppercase">{organization?.legalEntity || organization?.name || 'RESET STUDIO'}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">{organization?.address}</p>
                             <p className="text-[9px] font-black text-blue-600 uppercase mt-2">PE NO: {organization?.peNumber || 'N/A'}</p>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end gap-3">
                          <div className="w-40 h-16 border-b-2 border-slate-300 border-dashed relative">
                             <p className="absolute bottom-2 right-0 text-[8px] font-bold text-slate-200 uppercase">Principal Signature</p>
                          </div>
                          <p className="text-[9px] font-black uppercase text-slate-400">Date of issue: {new Date().toLocaleDateString('en-GB')}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-6 flex justify-between items-center no-print">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">SYSTEM_VERIFIED_DOCUMENT</p>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest">Download PDF</button>
                    <button onClick={() => setViewingDoc(null)} className="bg-slate-100 text-slate-400 px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest">Close</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
