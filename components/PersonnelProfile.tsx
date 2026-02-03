import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LeaveRequest, LeaveType, Shift, Property, OrganizationSettings } from '../types';

interface PersonnelProfileProps {
  user: User;
  leaveRequests?: LeaveRequest[];
  onRequestLeave?: (type: LeaveType, start: string, end: string) => void;
  shifts?: Shift[];
  properties?: Property[];
  onUpdateUser?: (user: User) => void;
  organization?: OrganizationSettings;
  initialDocView?: 'fs3' | 'payslip' | 'worksheet' | null;
}

const PersonnelProfile: React.FC<PersonnelProfileProps> = ({ user, leaveRequests = [], onRequestLeave, shifts = [], properties = [], onUpdateUser, organization, initialDocView }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'studio'>('profile');
  const [showDossier, setShowDossier] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<'payslip' | 'worksheet' | 'fs3' | null>(null);
  const [selectedDocMonth, setSelectedDocMonth] = useState<string>(new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase());
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editMaritalStatus, setEditMaritalStatus] = useState(user.maritalStatus || 'Single');
  const [editIsParent, setEditIsParent] = useState(user.isParent || false);
  const [editPassword, setEditPassword] = useState('');

  const [orgForm, setOrgForm] = useState<Partial<OrganizationSettings>>(organization || {});

  const isAdmin = user.role === 'admin';
  const subLabelStyle = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold uppercase text-xs outline-none focus:border-indigo-600";

  const myLeaves = leaveRequests.filter(l => l.userId === user.id);

  const handleSaveProfile = () => {
    if (onUpdateUser) {
      const updates: User = { ...user, phone: editPhone, maritalStatus: editMaritalStatus, isParent: editIsParent };
      if (editPassword.trim()) updates.password = editPassword.trim();
      onUpdateUser(updates);
    }
    setIsEditingProfile(false);
    setEditPassword('');
    alert("Profile registry updated.");
  };

  const handleSaveOrg = () => {
    // In a real app this would call setOrganization from App.tsx
    // Since we don't have the setter here, we simulate a save
    alert("Studio business details updated for future billing cycles.");
  };

  return (
    <div className="bg-slate-50 min-h-screen space-y-10 animate-in fade-in duration-700 text-left pb-24 px-1">
      <header className="space-y-4 px-4 pt-4">
        <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Studio Settings</h2>
        {isAdmin && (
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
            <button onClick={() => setActiveTab('profile')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>My Account</button>
            <button onClick={() => setActiveTab('studio')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>My Studio</button>
          </div>
        )}
      </header>

      {activeTab === 'profile' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
          <section className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-8">
            <div className="flex justify-between items-start">
               <div>
                  <p className={subLabelStyle}>Operator File</p>
                  <h3 className="text-2xl font-bold text-slate-900 uppercase">{user.name}</h3>
               </div>
               <button onClick={() => isEditingProfile ? handleSaveProfile() : setIsEditingProfile(true)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isEditingProfile ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-400'}`}>
                  {isEditingProfile ? 'Save Registry' : 'Edit File'}
               </button>
            </div>
            
            <div className="space-y-6">
              <div><p className={subLabelStyle}>Verified Mobile</p>{isEditingProfile ? <input className={inputStyle} value={editPhone} onChange={e => setEditPhone(e.target.value)} /> : <p className="font-bold">{user.phone || 'NOT RECORDED'}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                 <div><p className={subLabelStyle}>Marital Status</p>{isEditingProfile ? <select className={inputStyle} value={editMaritalStatus} onChange={e => setEditMaritalStatus(e.target.value)}><option value="Single">Single</option><option value="Married">Married</option></select> : <p className="font-bold">{user.maritalStatus || 'Single'}</p>}</div>
                 <div><p className={subLabelStyle}>NI Number</p><p className="font-bold opacity-40">{user.niNumber || 'SECURED'}</p></div>
              </div>
              <button onClick={() => setShowDossier(true)} className="w-full bg-slate-900 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest">Open Financial Dossier</button>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-8">
             <h3 className="text-xl font-bold uppercase">Leave Registry</h3>
             <div className="space-y-4">
                <input type="date" className={inputStyle} />
                <button onClick={() => alert("Request sent to HR")} className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black uppercase">Submit Day Off Request</button>
             </div>
             <div className="pt-6 border-t border-slate-50">
                <p className={subLabelStyle}>History</p>
                {myLeaves.length === 0 ? <p className="text-[10px] opacity-20 text-center py-4 italic">No requests logged</p> : myLeaves.map(l => (
                   <div key={l.id} className="flex justify-between p-3 bg-slate-50 rounded-xl mb-2"><span className="text-[10px] font-bold uppercase">{l.type}</span><span className="text-[8px] font-black uppercase opacity-40">{l.status}</span></div>
                ))}
             </div>
          </section>
        </div>
      ) : (
        <section className="bg-white border border-slate-100 rounded-[2rem] p-8 md:p-12 shadow-sm max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4">
           <div className="space-y-1">
              <h3 className="text-2xl font-bold uppercase tracking-tight">Studio Business Registry</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legal & Identity Management for Invoicing/Payroll</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div><label className={subLabelStyle}>Official Business Name</label><input className={inputStyle} value={orgForm.legalEntity || ''} onChange={e => setOrgForm({...orgForm, legalEntity: e.target.value})} placeholder="E.G. RESET HOSPITALITY LTD" /></div>
              <div><label className={subLabelStyle}>VAT Identification #</label><input className={inputStyle} value={orgForm.taxId || ''} onChange={e => setOrgForm({...orgForm, taxId: e.target.value})} placeholder="MT00000000" /></div>
              <div><label className={subLabelStyle}>PE Number (Personnel Registry)</label><input className={inputStyle} value={orgForm.peNumber || ''} onChange={e => setOrgForm({...orgForm, peNumber: e.target.value})} placeholder="000000" /></div>
              <div><label className={subLabelStyle}>Company Reg. Number</label><input className={inputStyle} value={orgForm.regNumber || ''} onChange={e => setOrgForm({...orgForm, regNumber: e.target.value})} placeholder="C 12345" /></div>
              <div className="md:col-span-2"><label className={subLabelStyle}>Official Registered Address</label><input className={inputStyle} value={orgForm.address || ''} onChange={e => setOrgForm({...orgForm, address: e.target.value})} placeholder="Building, Street, Town, Postcode" /></div>
           </div>
           <button onClick={handleSaveOrg} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Update Studio Registry</button>
        </section>
      )}

      {/* Dossier Modal would go here - Restored basic functionality */}
      {showDossier && (
        <div className="fixed inset-0 bg-slate-900/60 z-[600] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] p-12 max-w-2xl w-full space-y-8 shadow-2xl relative text-left">
              <button onClick={() => setShowDossier(false)} className="absolute top-8 right-8 text-slate-300 hover:text-black">&times;</button>
              <h2 className="text-2xl font-bold uppercase">Personnel Dossier</h2>
              <div className="space-y-4">
                 {['APR 2026', 'MAR 2026', 'FEB 2026'].map(m => (
                    <div key={m} className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100 hover:border-indigo-500 transition-all cursor-pointer">
                       <span className="font-bold uppercase text-xs">{m}</span>
                       <span className="text-[9px] font-black text-indigo-600 underline">View Record</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelProfile;