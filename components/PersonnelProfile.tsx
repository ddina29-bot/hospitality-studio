
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
  const isAdmin = currentUserObj.role === 'admin';
  
  // STRICT RULE: Only Admin can even see the existence of Payroll, Invoicing, and Records
  const visibleModules = useMemo(() => {
    if (isAdmin) return ['PAYROLL', 'INVOICING', 'RECORDS'];
    return ['MY DOCUMENTS']; // Staff only see their own file
  }, [isAdmin]);

  const [activeModule, setActiveModule] = useState(visibleModules[0]);
  const [activeSubTab, setActiveSubTab] = useState<'PENDING PAYOUTS' | 'PAYSLIP REGISTRY' | 'LEAVE REGISTRY'>('PAYSLIP REGISTRY');
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(initialDocView || null);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState<SavedPayslip | null>(initialHistoricalPayslip || null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Date and Billing states
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>('JAN 2026'); 
  const [manualGrossPay, setManualGrossPay] = useState<number | null>(null);

  // Edit fields
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editAddress, setEditAddress] = useState(user.homeAddress || '');
  const [editMaritalStatus, setEditMaritalStatus] = useState(user.maritalStatus || 'Single');
  const [editIsParent, setEditIsParent] = useState(user.isParent || false);
  const [editChildrenCount, setEditChildrenCount] = useState(user.childrenCount || 0);
  const [editPayRate, setEditPayRate] = useState(user.payRate || 5.00);
  const [editPaymentType, setEditPaymentType] = useState<PaymentType>(user.paymentType || 'Per Hour');
  const [editEmploymentType, setEditEmploymentType] = useState<EmploymentType>(user.employmentType || 'Full-Time');

  // Leave Form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  const visibleSubTabs = useMemo(() => {
    if (isAdmin && activeModule !== 'MY DOCUMENTS') return ['PENDING PAYOUTS', 'PAYSLIP REGISTRY', 'LEAVE REGISTRY'];
    return ['PAYSLIP REGISTRY', 'LEAVE REGISTRY'];
  }, [isAdmin, activeModule]);

  const payrollData = useMemo(() => {
    if (activeHistoricalPayslip) {
      return { ...activeHistoricalPayslip, totalNet: activeHistoricalPayslip.netPay, daysInPeriod: activeHistoricalPayslip.daysWorked };
    }
    const gross = manualGrossPay || 0;
    const ni = gross * 0.1;
    const tax = gross > 1000 ? gross * 0.15 : 0;
    return { grossPay: gross, ni, tax, totalNet: gross - ni - tax, daysInPeriod: 30, niWeeks: 4, govBonus: 0, performanceBonus: 0, auditFees: 0 };
  }, [activeHistoricalPayslip, manualGrossPay]);

  const handleSaveProfile = () => {
    if (onUpdateUser) {
      onUpdateUser({ 
        ...user, 
        phone: editPhone, 
        homeAddress: editAddress,
        maritalStatus: editMaritalStatus, 
        isParent: editIsParent, 
        childrenCount: editChildrenCount,
        payRate: editPayRate,
        paymentType: editPaymentType,
        employmentType: editEmploymentType
      });
    }
    setIsEditingProfile(false);
  };

  const handleLeaveSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) return;
    onRequestLeave?.(leaveType, leaveStart, leaveEnd);
    setShowLeaveForm(false);
  };

  const subLabelStyle = "text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block text-left";
  const editInputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none focus:border-teal-500 transition-all";

  return (
    <div className="bg-[#F0FDFA] min-h-screen text-left pb-24 font-brand animate-in fade-in duration-500">
      {/* Top Module Selector - Strictly Admin Filtered */}
      <div className="bg-white border-b border-teal-50 px-6 py-2 shadow-sm flex gap-4 overflow-x-auto no-scrollbar">
         {visibleModules.map(mod => (
            <button 
              key={mod}
              onClick={() => setActiveModule(mod)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeModule === mod ? 'bg-[#0D9488] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
               {mod}
            </button>
         ))}
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-10">
        {/* Profile Card */}
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
           <div className="flex items-center gap-6 flex-1 w-full md:w-auto">
              <div className="w-20 h-20 rounded-[1.5rem] bg-teal-50 flex items-center justify-center text-[#0D9488] font-bold text-3xl shadow-inner border border-teal-100 overflow-hidden">
                 {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : user.name.charAt(0)}
              </div>
              <div className="text-left flex-1 min-w-0">
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight truncate">{user.name}</h2>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-1">{user.role}</p>
                 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                       <label className={subLabelStyle}>Phone</label>
                       {isEditingProfile ? <input className={editInputStyle} value={editPhone} onChange={e => setEditPhone(e.target.value)} /> : <p className="text-xs font-bold text-slate-700">{user.phone || '---'}</p>}
                    </div>
                    <div>
                       <label className={subLabelStyle}>Home Address</label>
                       {isEditingProfile ? <input className={editInputStyle} value={editAddress} onChange={e => setEditAddress(e.target.value)} /> : <p className="text-xs font-bold text-slate-700 truncate">{user.homeAddress || '---'}</p>}
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                <button onClick={() => isEditingProfile ? handleSaveProfile() : setIsEditingProfile(true)} className={`w-full md:w-48 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${isEditingProfile ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>{isEditingProfile ? 'SAVE DETAILS' : 'EDIT PROFILE'}</button>
                <button onClick={() => setShowLeaveForm(!showLeaveForm)} className="w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100">REQUEST LEAVE</button>
           </div>
        </section>

        {showLeaveForm && (
            <section className="bg-white border border-indigo-100 rounded-[2.5rem] p-8 shadow-sm animate-in slide-in-from-top-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Leave Application</h3>
                <form onSubmit={handleLeaveSubmission} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className={subLabelStyle}>Leave Category</label>
                        <select className={editInputStyle} value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)}>
                            <option value="Vacation Leave">Vacation Leave</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Day Off">Day Off</option>
                        </select>
                    </div>
                    <div>
                        <label className={subLabelStyle}>Start Date</label>
                        <input type="date" className={editInputStyle} value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <button type="submit" className="bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Submit Request</button>
                </form>
            </section>
        )}

        {/* Dynamic Registry Sections */}
        <div className="space-y-6">
           <div className="flex gap-10 border-b border-slate-200 px-4">
              {visibleSubTabs.map(tab => (
                 <button key={tab} onClick={() => setActiveSubTab(tab as any)} className={`pb-4 text-[10px] font-black tracking-widest transition-all relative ${activeSubTab === tab ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488]"></div>}
                 </button>
              ))}
           </div>

           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden min-h-[400px]">
              {activeSubTab === 'PAYSLIP REGISTRY' ? (
                 <div className="divide-y divide-slate-50">
                    {(user.payslips || []).length === 0 ? (
                        <div className="py-32 text-center opacity-20 grayscale">
                            <span className="text-4xl block mb-4">📑</span>
                            <p className="text-[10px] font-black uppercase tracking-widest">No historical payslips found</p>
                        </div>
                    ) : user.payslips.map(ps => (
                        <div key={ps.id} className="p-8 flex justify-between items-center hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setActiveHistoricalPayslip(ps); setViewingDoc('payslip'); }}>
                           <div className="text-left">
                              <p className="text-sm font-bold text-slate-900 uppercase">{ps.month}</p>
                              <p className="text-[9px] font-black text-[#0D9488] uppercase tracking-widest mt-1">Net: €{ps.netPay.toFixed(2)}</p>
                           </div>
                           <button className="bg-slate-50 text-slate-400 px-6 py-2 rounded-xl text-[9px] font-black uppercase group-hover:bg-[#0D9488] group-hover:text-white transition-all">View Doc</button>
                        </div>
                    ))}
                 </div>
              ) : activeSubTab === 'LEAVE REGISTRY' ? (
                 <div className="divide-y divide-slate-50">
                    {leaveRequests.filter(l => l.userId === user.id).length === 0 ? (
                        <div className="py-32 text-center opacity-20">
                            <p className="text-[10px] font-black uppercase tracking-widest">No leave records</p>
                        </div>
                    ) : leaveRequests.filter(l => l.userId === user.id).map(l => (
                        <div key={l.id} className="p-8 flex justify-between items-center">
                           <div className="text-left">
                              <p className="text-sm font-bold text-slate-900 uppercase">{l.type}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{l.startDate} TO {l.endDate}</p>
                           </div>
                           <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${l.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{l.status}</span>
                        </div>
                    ))}
                 </div>
              ) : isAdmin && activeSubTab === 'PENDING PAYOUTS' ? (
                 <div className="p-10 text-left space-y-8 animate-in slide-in-from-bottom-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Financial Terminal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <label className={subLabelStyle}>Simulated Gross Pay (€)</label>
                            <input type="number" className={editInputStyle} value={manualGrossPay || ''} onChange={e => setManualGrossPay(parseFloat(e.target.value) || 0)} placeholder="ENTER AMOUNT" />
                        </div>
                        <div className="bg-teal-50 p-8 rounded-3xl text-right">
                            <p className={subLabelStyle}>Calculated Net</p>
                            <p className="text-4xl font-black text-[#0D9488]">€{payrollData.totalNet.toFixed(2)}</p>
                        </div>
                    </div>
                 </div>
              ) : null}
           </div>
        </div>
      </div>

      {/* Doc Preview Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/90 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 md:p-14 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => setViewingDoc(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 text-2xl">&times;</button>
              <header className="border-b-2 border-slate-900 pb-8 mb-8">
                 <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">{organization?.name || 'RESET STUDIO'}</h1>
                 <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-2">PE NO: {organization?.peNumber || 'N/A'}</p>
              </header>
              <div className="space-y-6">
                 <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                    <div>
                        <p className={subLabelStyle}>Official Payslip</p>
                        <p className="text-lg font-bold text-slate-900 uppercase">{user.name}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{activeHistoricalPayslip?.month || selectedDocMonth}</p>
                 </div>
                 <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase"><span>Gross Wage</span><span>€{payrollData.grossPay.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold uppercase text-rose-600"><span>NI (Class 1)</span><span>-€{payrollData.ni.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs font-bold uppercase text-rose-600"><span>FSS Tax</span><span>-€{payrollData.tax.toFixed(2)}</span></div>
                    <div className="flex justify-between pt-6 border-t-2 border-slate-900 text-3xl font-black text-emerald-600"><span>Net Payout</span><span>€{payrollData.totalNet.toFixed(2)}</span></div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;
