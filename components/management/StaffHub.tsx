
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole, EmploymentType, PaymentType, Shift, Tutorial } from '../../types';
import { uploadFile } from '../../services/storageService';
import OnboardingPathView from './OnboardingPathView';

interface StaffHubProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  shouldOpenAddModal?: boolean;
  setShouldOpenAddModal?: (val: boolean) => void;
  orgId?: string | null;
  tutorials?: Tutorial[];
}

const StaffHub: React.FC<StaffHubProps> = ({ users, setUsers, shifts = [], setShifts, showToast, shouldOpenAddModal, setShouldOpenAddModal, orgId, tutorials = [] }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitedUserEmail, setInvitedUserEmailState] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', role: 'cleaner' });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editModalMode, setEditModalMode] = useState<'details' | 'onboarding'>('details');
  const [newPassword, setNewPassword] = useState('');
  const contractInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (shouldOpenAddModal) {
      setShowAddModal(true);
      if (setShouldOpenAddModal) setShouldOpenAddModal(false);
    }
  }, [shouldOpenAddModal, setShouldOpenAddModal]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
    if (!currentUser.email) return;

    try {
      const response = await fetch(`/api/state?email=${encodeURIComponent(currentUser.email)}`);
      const data = await response.json();
      if (data.success && data.organization?.users) {
        setUsers(data.organization.users);
        if (showToast) showToast('STATUS SYNCED', 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const labelStyle = "text-[7px] font-black text-[#0D9488] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1 text-left";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-semibold outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-teal-50 transition-all";

  const getQualityScore = (userId: string) => {
    const myShifts = shifts.filter(s => s.userIds.includes(userId) && s.status === 'completed');
    if (myShifts.length === 0) return 100;
    const approved = myShifts.filter(s => s.approvalStatus === 'approved').length;
    return Math.round((approved / myShifts.length) * 100);
  };

  const staffGroups = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = users.filter(u => (u.name || '').toLowerCase().includes(query));
    
    const activeMembers = filtered.filter(u => u.status !== 'inactive');
    const suspendedMembers = filtered.filter(u => u.status === 'inactive');

    return [
      { title: 'MANAGEMENT & ADMIN', members: activeMembers.filter(u => ['admin', 'housekeeping', 'hr', 'finance'].includes(u.role)) },
      { title: 'FIELD STAFF (CLEANING)', members: activeMembers.filter(u => ['cleaner', 'supervisor'].includes(u.role)) },
      { title: 'LOGISTICS & OPERATIONS', members: activeMembers.filter(u => ['driver', 'maintenance', 'laundry', 'outsourced_maintenance', 'client'].includes(u.role)) },
      { title: 'SUSPENDED ACCOUNTS', members: suspendedMembers, isSuspendedGroup: true }
    ];
  }, [users, search]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) return;
    
    const cleanOrgId = orgId || localStorage.getItem('current_org_id');
    if (!cleanOrgId) {
        alert("Session error: Organization ID not found. Please log out and log back in.");
        return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: cleanOrgId, newUser })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
          throw new Error(data.error || "Failed to generate invite.");
      }

      if (data.user) {
        setUsers(prev => [...prev, data.user]);
        setInviteToken(data.user.activationToken || null);
        setInvitedUserEmailState(newUser.email!);
        setShowSuccessModal(true);
        setShowAddModal(false);
        setNewUser({ name: '', email: '', role: 'cleaner' });
      } else {
        throw new Error("Server returned an empty user object.");
      }
    } catch (err: any) {
      console.error("Invite Error:", err);
      alert(err.message || "Invite failed. Please check your connection.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const updatedUser = { ...editingUser };
    if (newPassword.trim()) updatedUser.password = newPassword.trim();
    setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
    setShowEditModal(false);
    if (showToast) showToast('EMPLOYEE FILE UPDATED', 'success');
  };

  const toggleStatus = () => {
    if (!editingUser) return;
    const isSuspending = editingUser.status !== 'inactive';
    const newStatus: 'active' | 'inactive' = isSuspending ? 'inactive' : 'active';
    const updatedUser = { ...editingUser, status: newStatus };
    
    setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
    
    // CRITICAL: If suspending, remove from all future/current shifts automatically
    if (isSuspending && setShifts) {
      setShifts(prev => prev.map(s => ({
        ...s,
        userIds: s.userIds.filter(id => id !== editingUser.id)
      })));
    }

    setEditingUser(updatedUser);
    if (showToast) {
        showToast(
            isSuspending 
              ? 'ACCOUNT SUSPENDED & REMOVED FROM ALL SHIFTS' 
              : 'ACCOUNT REACTIVATED', 
            'info'
        );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'contract' | 'id') => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;
    const url = await uploadFile(file);
    if (type === 'contract') setEditingUser({ ...editingUser, contractFileUrl: url, hasContract: true });
    else setEditingUser({ ...editingUser, idFileUrl: url, hasID: true });
  };

  const openEditModal = (u: User) => {
    setEditingUser({ ...u, childrenCount: u.childrenCount || 0 });
    setNewPassword('');
    setEditModalMode('details');
    setShowEditModal(true);
  };

  const copyInviteLink = () => {
    if (!inviteToken) return;
    const link = `${window.location.origin}/?code=${inviteToken}`;
    navigator.clipboard.writeText(link);
    if (showToast) showToast('LINK COPIED TO CLIPBOARD', 'success');
  };

  const isRoadmapIrrelevant = useMemo(() => {
    if (!editingUser) return true;
    return ['admin', 'housekeeping', 'driver', 'laundry'].includes(editingUser.role);
  }, [editingUser]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-24 max-w-6xl mx-auto relative px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">Employee Registry</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2">Manage personnel profiles, roles, and compliance documentation.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
          <button onClick={handleRefresh} disabled={isRefreshing} className="p-3 rounded-2xl bg-white border border-slate-100 hover:border-teal-200 transition-all text-slate-400 hover:text-teal-600 disabled:opacity-50">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isRefreshing ? 'animate-spin' : ''}><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
          <div className="relative flex-1 sm:w-64">
             <input type="text" placeholder="SEARCH EMPLOYEES..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-10 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-teal-400 transition-all" value={search} onChange={e => setSearch(e.target.value)} />
             <div className="absolute left-4 top-3 text-slate-300">🔍</div>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-teal px-5 py-2.5 shadow-lg shadow-teal-900/5 flex items-center justify-center gap-2 shrink-0">
            <span className="text-base font-bold">+</span>
            <span className="uppercase text-[9px] tracking-widest font-black">Invite user</span>
          </button>
        </div>
      </header>

      <div className="space-y-10">
        {staffGroups.map((group, gIdx) => group.members.length > 0 && (
          <section key={gIdx} className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap ${group.isSuspendedGroup ? 'text-red-500' : 'text-slate-300'}`}>
                {group.title}
              </h3>
              <div className={`h-px flex-1 ${group.isSuspendedGroup ? 'bg-red-100' : 'bg-slate-50'}`}></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.members.map(u => {
                const score = getQualityScore(u.id);
                return (
                <div key={u.id} onClick={() => openEditModal(u)} className={`soft-card p-6 flex flex-col gap-5 cursor-pointer transition-all hover:shadow-2xl group border-transparent hover:border-teal-200 ${u.status === 'inactive' ? 'opacity-60 bg-red-50/20 border-red-100 grayscale' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-teal-100 flex items-center justify-center font-bold text-teal-600 text-lg group-hover:scale-110 transition-transform overflow-hidden shadow-sm">
                        {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover" /> : (u.name || '?').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold uppercase truncate text-slate-900">{u.name}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.role}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${u.status === 'active' ? 'bg-teal-600 text-white' : u.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-red-500 text-white'}`}>
                            {u.status}
                        </span>
                        {u.role === 'cleaner' && (
                           <div className={`px-2 py-0.5 rounded border text-[7px] font-black uppercase ${score >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                              QI: {score}%
                           </div>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-teal-50">
                    <div className={`w-2 h-2 rounded-full ${u.hasContract ? 'bg-green-500' : 'bg-red-400'}`}></div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contract</span>
                    <div className="w-px h-3 bg-slate-100 mx-1"></div>
                    <div className={`w-2 h-2 rounded-full ${u.hasID ? 'bg-green-500' : 'bg-red-400'}`}></div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID Docs</span>
                    <div className="flex-1 text-right">
                       <span className="text-[9px] font-black text-teal-700 uppercase">{u.phone || 'NO PHONE'}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </section>
        ))}
      </div>

      {/* EDIT/VIEW MODAL */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-6xl p-8 md:p-12 shadow-2xl relative text-left my-auto animate-in slide-in-from-bottom-8">
            <button onClick={() => setShowEditModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 text-xl font-bold">&times;</button>
            
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:pr-16">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-none font-serif-brand">Employee Master File</h2>
                <p className="text-[10px] text-teal-600 font-bold uppercase tracking-[0.4em] mt-2">UUID: {editingUser.id} • AUTH: {editingUser.email}</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setEditModalMode('details')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editModalMode === 'details' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`}>DATA REGISTRY</button>
                    {!isRoadmapIrrelevant && (
                      <button onClick={() => setEditModalMode('onboarding')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editModalMode === 'onboarding' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`}>ONBOARDING ROADMAP</button>
                    )}
                 </div>
                 <button 
                  type="button"
                  onClick={toggleStatus}
                  className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg min-w-[120px] ${editingUser.status === 'inactive' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}
                >
                  {editingUser.status === 'inactive' ? 'Active' : 'Suspend'}
                </button>
              </div>
            </header>

            {editModalMode === 'details' ? (
              <form onSubmit={handleSaveEdit} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-8">
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-8 shadow-inner">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3">Onboarding Data Registry</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="md:col-span-2">
                          <label className={labelStyle}>Full EMPLOYEE Name</label>
                          <input className={inputStyle} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                        </div>
                        <div>
                          <label className={labelStyle}>Maltese Phone Number</label>
                          <input className={inputStyle} value={editingUser.phone} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} placeholder="+356 ..." />
                        </div>
                        <div>
                          <label className={labelStyle}>Date of Birth</label>
                          <input type="date" className={inputStyle} value={editingUser.dateOfBirth} onChange={e => setEditingUser({...editingUser, dateOfBirth: e.target.value})} />
                        </div>
                        <div>
                          <label className={labelStyle}>Employment Start Date</label>
                          <input type="date" className={inputStyle} value={editingUser.activationDate} onChange={e => setEditingUser({...editingUser, activationDate: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelStyle}>Permanent Home Address</label>
                          <input className={inputStyle} value={editingUser.homeAddress} onChange={e => setEditingUser({...editingUser, homeAddress: e.target.value})} placeholder="STREET, TOWN, POSTCODE" />
                        </div>
                        <div>
                          <label className={labelStyle}>ID Card / Passport Number</label>
                          <input className={inputStyle} value={editingUser.idPassportNumber} onChange={e => setEditingUser({...editingUser, idPassportNumber: e.target.value})} placeholder="E.G. 123456M" />
                        </div>
                        <div>
                          <label className={labelStyle}>Maltese NI Number</label>
                          <input className={inputStyle} value={editingUser.niNumber} onChange={e => setEditingUser({...editingUser, niNumber: e.target.value})} />
                        </div>
                        <div>
                          <label className={labelStyle}>Marital Status</label>
                          <select className={inputStyle} value={editingUser.maritalStatus} onChange={e => setEditingUser({...editingUser, maritalStatus: e.target.value})}>
                              <option value="Single">Single</option>
                              <option value="Married">Married</option>
                              <option value="Separated">Separated</option>
                              <option value="Divorced">Divorced</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 h-[54px]">
                              <input type="checkbox" id="editParentCheck" className="w-5 h-5 accent-[#0D9488]" checked={editingUser.isParent} onChange={e => setEditingUser({...editingUser, isParent: e.target.checked})} />
                              <label htmlFor="editParentCheck" className="text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer leading-tight">Tax: Has children</label>
                          </div>
                          {editingUser.isParent && (
                              <div className="animate-in slide-in-from-left-2 flex items-center gap-2">
                                  <label className="text-[7px] font-black text-indigo-600 uppercase tracking-widest whitespace-nowrap">How many?</label>
                                  <select className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold" value={editingUser.childrenCount} onChange={e => setEditingUser({...editingUser, childrenCount: parseInt(e.target.value)})}>
                                      <option value={0}>0</option>
                                      <option value={1}>1</option>
                                      <option value={2}>2+</option>
                                  </select>
                              </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 border border-slate-100 rounded-[2.5rem] bg-white space-y-4 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Document Repository</p>
                          <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div><p className="text-[9px] font-bold text-slate-900 uppercase">Contract</p></div>
                                  <button type="button" onClick={() => contractInputRef.current?.click()} className={`text-[8px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${editingUser.hasContract ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                                      {editingUser.hasContract ? 'FILED' : 'UPLOAD'}
                                  </button>
                                  <input type="file" id="contractInput" ref={contractInputRef} className="hidden" onChange={e => handleFileUpload(e, 'contract')} />
                              </div>
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div><p className="text-[9px] font-bold text-slate-900 uppercase">ID Scan</p></div>
                                  <button type="button" onClick={() => idInputRef.current?.click()} className={`text-[8px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${editingUser.hasID ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                                      {editingUser.hasID ? 'VERIFIED' : 'UPLOAD'}
                                  </button>
                                  <input type="file" id="idInput" ref={idInputRef} className="hidden" onChange={e => handleFileUpload(e, 'id')} />
                              </div>
                          </div>
                      </div>
                      
                      <div className="p-6 border border-slate-100 rounded-[2.5rem] bg-white space-y-4 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">System Auth Overwrite</p>
                          <div className="space-y-4">
                            <div>
                                <label className={labelStyle}>Assign New Role</label>
                                <select className={inputStyle} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                                  <option value="cleaner">CLEANER</option>
                                  <option value="supervisor">SUPERVISOR</option>
                                  <option value="driver">DRIVER</option>
                                  <option value="laundry">LAUNDRY</option>
                                  <option value="housekeeping">HOUSEKEEPING</option>
                                  <option value="maintenance">MAINTENANCE</option>
                                  <option value="hr">HR</option>
                                  <option value="finance">FINANCE</option>
                                  <option value="admin">ADMIN</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelStyle}>Reset Passkey</label>
                                <input type="password" className={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="NO CHANGE" />
                            </div>
                          </div>
                      </div>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <div className="p-8 bg-teal-50/50 rounded-[3rem] border border-teal-100 space-y-8 shadow-xl">
                      <div className="flex items-center gap-4 border-b border-teal-200/40 pb-4">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-teal-600 shadow-sm">💳</div>
                          <p className="text-11px font-black text-teal-800 uppercase tracking-[0.2em]">Financial Ledger Registry</p>
                      </div>
                      <div className="space-y-6">
                          <div>
                            <label className={labelStyle}>Employment Basis</label>
                            <select className={inputStyle} value={editingUser.employmentType} onChange={e => setEditingUser({...editingUser, employmentType: e.target.value as EmploymentType})}>
                                <option value="Full-Time">FULL-TIME</option>
                                <option value="Part-Time">PART-TIME</option>
                                <option value="Casual">CASUAL / AD-HOC</option>
                                <option value="Contractor">CONTRACTOR (OUTSOURCED)</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelStyle}>Payment Methodology</label>
                            <select className={inputStyle} value={editingUser.paymentType} onChange={e => setEditingUser({...editingUser, paymentType: e.target.value as PaymentType})}>
                                <option value="Per Clean">PER DEPLOYMENT (PIECE-RATE)</option>
                                <option value="Per Hour">HOURLY RATE (MALTESE LAW)</option>
                                <option value="Fixed Wage">FIXED SALARY / RETAINER</option>
                            </select>
                          </div>
                          <div className="bg-white/80 p-6 rounded-[2rem] border border-teal-200/50 shadow-sm">
                            <label className={labelStyle}>Base Remuneration Rate (€)</label>
                            <input type="number" step="0.01" className="w-full bg-transparent text-3xl font-black text-teal-900 outline-none" value={editingUser.payRate} onChange={e => setEditingUser({...editingUser, payRate: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                          </div>
                          <div>
                            <label className={labelStyle}>Official SEPA IBAN (PAYOUTS)</label>
                            <input className={inputStyle + " font-mono text-xs text-teal-800"} value={editingUser.iban} onChange={e => setEditingUser({...editingUser, iban: e.target.value})} placeholder="MT00..." />
                          </div>
                      </div>
                    </div>
                    <div className="flex flex-row gap-3">
                      <button type="submit" className="flex-1 bg-[#0D9488] text-white py-3.5 rounded-xl shadow-xl shadow-teal-900/10 text-[9px] uppercase tracking-[0.2em] font-black active:scale-98 transition-transform">
                        Verify and save
                      </button>
                      <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-slate-100 text-slate-400 font-black py-3.5 rounded-xl text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200 active:scale-98">
                        Abort
                      </button>
                    </div>
                </div>
              </form>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-4">
                <OnboardingPathView user={editingUser} tutorials={tutorials} onNavigateToTutorials={() => {}} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-10 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
              <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 text-2xl">&times;</button>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">New Employee Invite</h2>
              <form onSubmit={handleInvite} className="space-y-6">
                 <div><label className={labelStyle}>Full Legal Name</label><input required className={inputStyle} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="E.G. JOHN DOE" /></div>
                 <div><label className={labelStyle}>Email Address</label><input required type="email" className={inputStyle} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="STAFF@EXAMPLE.COM" /></div>
                 <div>
                    <label className={labelStyle}>Assigned Role</label>
                    <select className={inputStyle} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                       <option value="admin">ADMIN (FULL ACCESS)</option>
                       <option value="cleaner">CLEANER</option>
                       <option value="supervisor">SUPERVISOR</option>
                       <option value="driver">DRIVER</option>
                       <option value="laundry">LAUNDRY STAFF</option>
                       <option value="housekeeping">HOUSEKEEPING</option>
                       <option value="maintenance">MAINTENANCE</option>
                       <option value="finance">FINANCE</option>
                    </select>
                 </div>
                 <button type="submit" disabled={isSending} className="w-full btn-teal py-5 shadow-2xl shadow-teal-900/10 text-xs uppercase tracking-[0.3em] font-black disabled:opacity-50">
                    {isSending ? 'Generating Link...' : 'Initialize Invite'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[600] flex items-center justify-center p-6 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] p-10 max-w-md w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95">
              <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center text-white text-4xl mx-auto shadow-xl">✓</div>
              <h2 className="text-2xl font-bold uppercase text-slate-900">User Invited</h2>
              <p className="text-sm text-slate-500">Provide this secure activation link to <b>{invitedUserEmail}</b>.</p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 break-all text-[10px] font-mono font-bold text-teal-800">
                {window.location.origin}/?code={inviteToken}
              </div>
              <div className="flex gap-3">
                <button onClick={copyInviteLink} className="flex-1 btn-teal py-4 text-xs uppercase tracking-widest font-black">Copy Link</button>
                <button onClick={() => setShowSuccessModal(false)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest font-black">Dismiss</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StaffHub;
