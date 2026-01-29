
import React, { useState, useMemo } from 'react';
import { User, UserRole, EmploymentType, PaymentType } from '../../types';

interface StaffHubProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const StaffHub: React.FC<StaffHubProps> = ({ users, setUsers, onPreviewActivation, showToast }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInvitePreview, setShowInvitePreview] = useState<User | null>(null);
  const [confirmingSuspendId, setConfirmingSuspendId] = useState<string | null>(null);
  
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const isHousekeeping = currentUser.role === 'housekeeping';
  
  // Both Admin and Housekeeping can manage (invite) members
  const canManage = isAdmin || isHousekeeping;

  const [newUser, setNewUser] = useState<Partial<User>>({ 
    name: '', 
    email: '', 
    role: 'cleaner'
  });

  const [editForm, setEditForm] = useState<Partial<User>>({});

  const labelStyle = "text-[7px] font-black text-[#C5A059] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1 text-left";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all";

  const activeUser = useMemo(() => users.find(u => u.id === selectedId), [users, selectedId]);

  // CATEGORY 1: ACTIVE PERSONNEL (Status: Active) - Grouped by function for operational clarity
  const activeStaffGroups = useMemo(() => {
    const filtered = users.filter(u => u.status === 'active' && u.name.toLowerCase().includes(search.toLowerCase()));
    
    return [
      {
        title: 'HOUSEKEEPING FIELD STAFF',
        members: filtered.filter(u => ['cleaner', 'supervisor'].includes(u.role))
      },
      {
        title: 'LOGISTICS & MANAGEMENT',
        members: filtered.filter(u => ['admin', 'housekeeping', 'hr', 'finance', 'driver'].includes(u.role))
      },
      {
        title: 'TECHNICAL & LAUNDRY',
        members: filtered.filter(u => ['maintenance', 'laundry', 'outsourced_maintenance', 'client'].includes(u.role))
      }
    ];
  }, [users, search]);

  // CATEGORY 2: PENDING TO JOIN (Status: Pending)
  const pendingUsers = useMemo(() => {
    return users.filter(u => u.status === 'pending' && u.name.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  // CATEGORY 3: SUSPENDED ACCOUNTS (Status: Inactive)
  const suspendedUsers = useMemo(() => {
    return users.filter(u => u.status === 'inactive' && u.name.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const handleSuspendAccount = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'inactive' as const } : u));
    setConfirmingSuspendId(null);
    setSelectedId(null);
    if (showToast) showToast(`ACCOUNT REVOKED`, 'error');
  };

  const handleRestoreAccount = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' as const } : u));
    if (showToast) showToast(`ACCOUNT REINSTATED`, 'success');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) return;
    
    // Safety check for role based on the inviter
    const roleToAssign = isHousekeeping ? 'cleaner' : (newUser.role || 'cleaner');

    const createdUser: User = { 
      ...newUser, 
      role: roleToAssign as UserRole,
      id: `u-${Date.now()}`, 
      status: 'pending',
      paymentType: 'Per Hour',
      payRate: 5.00
    } as User;
    
    setUsers(prev => [...prev, createdUser]);
    setShowAddModal(false);
    setNewUser({ name: '', email: '', role: 'cleaner' });
    setShowInvitePreview(createdUser);
    if (showToast) showToast('INVITATION DISPATCHED', 'success');
  };

  const handleSaveEdit = () => {
    if (!editForm.id) return;
    setUsers(prev => prev.map(u => u.id === editForm.id ? { ...u, ...editForm } as User : u));
    setIsEditMode(false);
    if (showToast) showToast('RECORD SYNCHRONIZED', 'success');
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 text-left pb-24 max-w-6xl mx-auto relative px-2">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight text-left">Personnel Intelligence</h2>
          <p className="text-[8px] font-bold text-[#A68342] uppercase tracking-[0.4em] mt-1 opacity-80 text-left">TEAM REGISTRY & ACCESS CONTROL</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="SEARCH BY NAME..." 
              className="w-full bg-white border border-gray-300 rounded-full px-5 py-3 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all pr-12 shadow-sm" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <div className="absolute right-5 top-3.5 text-black/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>
          {canManage && (
            <button 
              type="button" 
              onClick={() => setShowAddModal(true)} 
              className="bg-[#C5A059] text-black px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl whitespace-nowrap active:scale-95 transition-all hover:bg-[#d4b476]"
            >
              INVITE MEMBER
            </button>
          )}
        </div>
      </header>

      {/* 1. ACTIVE USERS SECTION */}
      <div className="space-y-10">
        {activeStaffGroups.some(g => g.members.length > 0) ? (
          activeStaffGroups.map((group, gIdx) => group.members.length > 0 && (
            <section key={gIdx} className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-black/20">ACTIVE: {group.title}</h3>
                <div className="h-px flex-1 bg-black/5"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.members.map(u => (
                  <div key={u.id} className="p-5 rounded-[28px] border bg-[#FDF8EE] border-[#D4B476]/30 hover:border-[#C5A059] transition-all flex items-center justify-between gap-4 shadow-lg group">
                    <div className="flex items-center gap-5 flex-1 min-w-0 text-left">
                      <div className="w-12 h-12 rounded-full bg-black border border-[#C5A059]/20 text-[#C5A059] flex items-center justify-center font-serif-brand text-lg font-bold shadow-inner shrink-0 group-hover:scale-105 transition-transform">{u.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-black tracking-tight">{u.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                           <span className="text-[8px] font-black uppercase tracking-widest text-[#A68342]">{u.role}</span>
                           <span className="w-1 h-1 rounded-full bg-green-500"></span>
                           <span className="text-[7px] font-black text-green-600 uppercase tracking-widest">Active</span>
                           {u.phone && (
                             <span className="text-[7px] font-black text-black/40 uppercase tracking-widest ml-1">{u.phone}</span>
                           )}
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { if (!isHousekeeping) { setSelectedId(u.id); setEditForm(u); setIsEditMode(false); } }} 
                      disabled={isHousekeeping}
                      className={`px-6 font-black py-3 rounded-xl uppercase text-[9px] tracking-widest transition-all shadow-sm whitespace-nowrap ${isHousekeeping ? 'bg-gray-50 text-black/10 border border-gray-200 cursor-not-allowed' : 'bg-white/60 border border-gray-200 text-black/60 hover:text-black hover:bg-white'}`}
                    >
                      Details
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="py-12 text-center border border-dashed border-black/5 rounded-[40px] opacity-10 italic text-[10px] uppercase font-black">No active team members matching query.</div>
        )}

        {/* 2. PENDING ONBOARDING SECTION */}
        {pendingUsers.length > 0 && (
          <section className="space-y-4 pt-10">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-orange-600/40">PENDING INDUCTION</h3>
              <div className="h-px flex-1 bg-orange-600/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map(u => (
                <div key={u.id} className="p-5 rounded-[28px] border bg-white border-orange-500/20 flex items-center justify-between gap-4 shadow-sm group">
                  <div className="flex items-center gap-5 flex-1 min-w-0 text-left">
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-serif-brand text-lg font-bold border border-orange-100">{u.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-black tracking-tight">{u.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-orange-500/60">{u.role}</span>
                        <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest px-2 py-0.5 bg-orange-50 rounded border border-orange-200 animate-pulse">Awaiting Activation</span>
                        {u.phone && (
                          <span className="text-[7px] font-black text-black/40 uppercase tracking-widest ml-1">{u.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { if (!isHousekeeping) { setSelectedId(u.id); setEditForm(u); setIsEditMode(false); } }} 
                    disabled={isHousekeeping}
                    className={`px-6 font-black py-3 rounded-xl uppercase text-[9px] tracking-widest transition-all shadow-sm whitespace-nowrap ${isHousekeeping ? 'bg-gray-50 text-black/10 border border-gray-200 cursor-not-allowed' : 'bg-gray-50 border border-gray-200 text-black/40 hover:text-black'}`}
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. SUSPENDED USERS SECTION (Stored at the bottom) */}
        {suspendedUsers.length > 0 && (
          <section className="space-y-4 pt-16 border-t border-black/5">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-red-600/30">REVOKED / SUSPENDED</h3>
              <div className="h-px flex-1 bg-red-600/5"></div>
            </div>
            <div className="space-y-3">
              {suspendedUsers.map(u => (
                <div key={u.id} className="p-4 md:p-5 rounded-[24px] border bg-gray-50 border-gray-200 opacity-60 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm group hover:opacity-100 transition-all">
                  <div className="flex items-center gap-5 flex-1 min-w-0 w-full text-left grayscale">
                    <div className="w-12 h-12 rounded-full bg-gray-200 border border-gray-300 text-gray-400 flex items-center justify-center font-serif-brand text-lg font-bold shrink-0">{u.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-gray-500 tracking-tight">{u.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                         <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{u.role}</span>
                         <span className="text-[7px] font-black text-red-600 uppercase tracking-widest">Revoked Access</span>
                         {u.phone && (
                           <span className="text-[7px] font-black text-black/20 uppercase tracking-widest ml-1">{u.phone}</span>
                         )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto pt-4 md:pt-0 md:pl-6 border-t md:border-t-0 md:border-black/5">
                    {isAdmin && (
                      <button 
                        type="button" 
                        onClick={() => handleRestoreAccount(u.id)}
                        className="flex-1 md:flex-none px-6 bg-green-600 text-white font-black py-3 rounded-xl uppercase text-[9px] tracking-widest transition-all hover:bg-green-700 shadow-md whitespace-nowrap"
                      >
                        REINSTATE ACCESS
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* MEMBER INVITATION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#FDF8EE] border border-[#D4B476]/40 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-10 shadow-2xl relative text-left animate-in zoom-in-95 duration-200">
              <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-2 text-center md:text-left">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Member Invite</h2>
                 <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em]">Step 1: Identity & Role</p>
              </div>

              <form onSubmit={handleAdd} className="space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className={labelStyle}>Full Legal Name</label>
                       <input required className={inputStyle} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="E.G. MARIA AZZOPARDI" />
                    </div>
                    <div className="space-y-1">
                       <label className={labelStyle}>Official Work Email</label>
                       <input required type="email" className={inputStyle} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="NAME@RESET.STUDIO" />
                    </div>
                    <div className="space-y-1">
                       <label className={labelStyle}>Assigned Role</label>
                       <select 
                        className={inputStyle} 
                        value={isHousekeeping ? 'cleaner' : newUser.role} 
                        onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                        disabled={isHousekeeping}
                       >
                          <option value="cleaner">CLEANER</option>
                          {!isHousekeeping && (
                            <>
                              <option value="supervisor">SUPERVISOR</option>
                              <option value="driver">DRIVER</option>
                              <option value="housekeeping">HOUSEKEEPING</option>
                              <option value="admin">ADMIN</option>
                              <option value="maintenance">MAINTENANCE</option>
                              <option value="hr">HR</option>
                              <option value="finance">FINANCE</option>
                              <option value="laundry">LAUNDRY</option>
                            </>
                          )}
                       </select>
                       {isHousekeeping && <p className="text-[8px] font-bold text-[#A68342] uppercase tracking-widest mt-1 opacity-60">* Housekeeping can only invite Cleaners.</p>}
                    </div>
                 </div>

                 <button type="submit" className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all">GENERATE SECURE LINK</button>
              </form>
           </div>
        </div>
      )}

      {/* INVITATION PREVIEW MODAL */}
      {showInvitePreview && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-[#FDF8EE] border border-green-500/30 rounded-[48px] w-full max-w-lg p-10 space-y-10 shadow-2xl relative text-center">
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-600 mb-4">
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Invitation Vector Ready</h2>
                 <p className="text-[10px] text-black/40 font-black uppercase tracking-widest leading-relaxed">Unique access link generated for <br/><span className="text-black font-bold">{showInvitePreview.name}</span></p>
              </div>

              <div className="bg-white border border-gray-200 p-6 rounded-3xl space-y-4">
                 <p className="text-[8px] font-black text-black/20 uppercase tracking-[0.4em]">Internal Simulation Activation Link</p>
                 <div className="bg-gray-50 p-4 rounded-xl font-mono text-[9px] text-black break-all text-left border border-black/5 select-all cursor-pointer">
                    https://reset.studio/activate?id={showInvitePreview.id}
                 </div>
              </div>

              <div className="space-y-3 pt-4">
                 <button 
                  onClick={() => onPreviewActivation?.(showInvitePreview)}
                  className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl active:scale-95 transition-all"
                 >
                    SIMULATE STAFF ACTIVATION
                 </button>
                 <button 
                  onClick={() => setShowInvitePreview(null)}
                  className="w-full text-black/30 text-[9px] font-black uppercase tracking-widest hover:text-black transition-all"
                 >
                    Finish and Dismiss
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* PERSONNEL PROFILE VIEW/EDIT MODAL */}
      {selectedId && activeUser && (
        <div className="fixed inset-0 bg-black/98 z-[400] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#FDF8EE] border border-[#D4B476]/40 rounded-[48px] w-full max-w-2xl p-8 md:p-10 space-y-10 shadow-2xl relative my-auto text-left">
            <button type="button" onClick={() => { setSelectedId(null); setIsEditMode(false); }} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            
            <header className="flex items-center gap-8 border-b border-black/5 pb-8">
               <div className="w-20 h-20 rounded-full bg-black border border-[#C5A059]/40 text-[#C5A059] flex items-center justify-center font-serif-brand text-4xl font-bold shadow-2xl">{activeUser.name.charAt(0)}</div>
               <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-serif-brand font-bold uppercase tracking-tight text-black">{activeUser.name}</h2>
                      <div className="flex items-center gap-3 mt-1">
                         <p className="text-[#A68342] font-black uppercase tracking-[0.3em] text-[9px]">{activeUser.role}</p>
                         <span className={`text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeUser.status === 'active' ? 'bg-green-50 text-green-600 border border-green-200' : activeUser.status === 'pending' ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>Status: {activeUser.status}</span>
                      </div>
                    </div>
                    {isAdmin && activeUser.status !== 'inactive' && (
                      <button 
                        onClick={() => setConfirmingSuspendId(activeUser.id)}
                        className="text-[7px] font-black text-red-500 uppercase tracking-widest border border-red-500/20 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-all shadow-sm"
                      >
                        SUSPEND ACCOUNT
                      </button>
                    )}
                  </div>
               </div>
            </header>

            {confirmingSuspendId ? (
              <div className="py-12 text-center space-y-8 animate-in zoom-in-95">
                 <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                 </div>
                 <div className="space-y-2">
                    <h3 className="text-xl font-serif-brand font-bold uppercase text-black">Confirm Revocation?</h3>
                    <p className="text-[10px] text-black/40 font-black uppercase tracking-widest leading-relaxed">Suspending {activeUser.name} will immediately terminate <br/>all active sessions and access tokens.</p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => handleSuspendAccount(activeUser.id)} className="flex-1 bg-red-600 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all">YES, REVOKE ACCESS</button>
                    <button onClick={() => setConfirmingSuspendId(null)} className="flex-1 bg-white border border-gray-300 text-black/40 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest">STAY ACTIVE</button>
                 </div>
              </div>
            ) : (
              <>
                {!isEditMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div><label className={labelStyle}>Verified Mobile</label><p className="text-black font-bold text-xs">{activeUser.phone || 'NOT RECORDED'}</p></div>
                      <div><label className={labelStyle}>NI Number (Maltese)</label><p className="text-black font-mono text-xs">{activeUser.niNumber || 'PENDING'}</p></div>
                      <div><label className={labelStyle}>Residential Address</label><p className="text-black/60 text-[10px] italic leading-relaxed">{activeUser.address || 'N/A'}</p></div>
                    </div>
                    <div className="space-y-6">
                      <div><label className={labelStyle}>Remuneration Protocol</label><p className="text-black font-bold text-[10px] uppercase">{activeUser.paymentType || 'NOT SET'} {activeUser.payRate ? `@ €${activeUser.payRate.toFixed(2)}` : ''}</p></div>
                      <div><label className={labelStyle}>Marital Status</label><p className="text-black font-bold text-[10px] uppercase">{activeUser.maritalStatus || 'Single'}</p></div>
                      <div><label className={labelStyle}>Parental Status</label><p className="text-black font-bold text-[10px] uppercase">{activeUser.isParent ? 'YES' : 'NO'}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div>
                            <label className={labelStyle}>NI Number (Maltese)</label>
                            <input className={inputStyle} value={editForm.niNumber || ''} onChange={e => setEditForm({...editForm, niNumber: e.target.value})} placeholder="7654321A" />
                          </div>
                          <div><label className={labelStyle}>Payment Protocol</label><select className={inputStyle} value={editForm.paymentType || 'Per Hour'} onChange={e => setEditForm({...editForm, paymentType: e.target.value as PaymentType})}><option value="Fixed Wage">Fixed Wage</option><option value="Per Hour">Per Hour</option><option value="Per Clean">Per Clean</option></select></div>
                          <div><label className={labelStyle}>Base Rate (€)</label><input type="number" step="0.01" className={inputStyle} value={editForm.payRate || 0} onChange={e => setEditForm({...editForm, payRate: parseFloat(e.target.value)})} /></div>
                          <div className="pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input type="checkbox" className="w-5 h-5 accent-[#C5A059] rounded border-gray-300" checked={editForm.isParent || false} onChange={e => setEditForm({...editForm, isParent: e.target.checked})} />
                              <span className="text-[9px] font-black uppercase text-black/60">Parent Status</span>
                            </label>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div><label className={labelStyle}>Verified Mobile</label><input className={inputStyle} value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                          <div><label className={labelStyle}>Residential Address</label><input className={inputStyle} value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} /></div>
                          <div><label className={labelStyle}>Marital Status</label><select className={inputStyle} value={editForm.maritalStatus || 'Single'} onChange={e => setEditForm({...editForm, maritalStatus: e.target.value})}><option>Single</option><option>Married</option><option>Separated</option></select></div>
                       </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-8 border-t border-black/5 flex gap-3">
                   {isEditMode ? (
                     <>
                       <button type="button" onClick={handleSaveEdit} className="flex-1 bg-black text-[#C5A059] font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all">SAVE</button>
                       <button type="button" onClick={() => setIsEditMode(false)} className="flex-1 bg-white border border-gray-200 text-black/40 font-black py-4 rounded-xl uppercase text-[9px] tracking-widest">Discard Changes</button>
                     </>
                   ) : (
                     <button type="button" onClick={() => { setIsEditMode(true); setEditForm(activeUser); }} className="flex-1 font-black py-4 rounded-xl uppercase text-[9px] tracking-widest transition-all bg-white border border-gray-200 text-black/40 hover:text-black hover:border-black/10">Modify record</button>
                   )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffHub;
