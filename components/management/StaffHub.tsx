
import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole } from '../../types';

interface StaffHubProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  shouldOpenAddModal?: boolean;
  setShouldOpenAddModal?: (val: boolean) => void;
}

const StaffHub: React.FC<StaffHubProps> = ({ users, setUsers, showToast, shouldOpenAddModal, setShouldOpenAddModal }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedUserEmail, setInvitedUserEmail] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const canManage = ['admin', 'housekeeping', 'hr'].includes(currentUser.role);

  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', role: 'cleaner' });

  // Effect to handle external trigger for modal opening
  useEffect(() => {
    if (shouldOpenAddModal) {
      setShowAddModal(true);
      if (setShouldOpenAddModal) setShouldOpenAddModal(false);
    }
  }, [shouldOpenAddModal, setShouldOpenAddModal]);

  const labelStyle = "text-[7px] font-black text-[#C5A059] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1 text-left";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all";

  const activeStaffGroups = useMemo(() => {
    const filtered = users.filter(u => u.status === 'active' && u.name.toLowerCase().includes(search.toLowerCase()));
    return [
      { title: 'HOUSEKEEPING FIELD STAFF', members: filtered.filter(u => ['cleaner', 'supervisor'].includes(u.role)) },
      { title: 'LOGISTICS & MANAGEMENT', members: filtered.filter(u => ['admin', 'housekeeping', 'hr', 'finance', 'driver'].includes(u.role)) },
      { title: 'TECHNICAL & LAUNDRY', members: filtered.filter(u => ['maintenance', 'laundry', 'outsourced_maintenance', 'client'].includes(u.role)) }
    ];
  }, [users, search]);

  const pendingUsers = useMemo(() => users.filter(u => u.status === 'pending'), [users]);

  // Determine if there are ANY active users to display
  const hasActiveUsers = activeStaffGroups.some(g => g.members.length > 0);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) return;
    setIsSending(true);

    try {
      const savedOrg = JSON.parse(localStorage.getItem('studio_org_settings') || '{}');
      
      if (!savedOrg.id) {
        alert("Session Error: Organization ID missing. Please Log Out and Log In again to restore session data.");
        setIsSending(false);
        return;
      }

      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: savedOrg.id,
          newUser: {
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUsers(prev => [...prev, data.user]);
      
      if (data.emailSent) {
        setInvitedUserEmail(newUser.email);
        setShowSuccessModal(true);
        setInviteLink(null); 
      } else {
        // Fallback to manual if no email server configured
        setInviteLink(data.inviteLink);
        setInvitedUserEmail(newUser.email);
      }

      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'cleaner' });
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const getActivationUrl = (code?: string) => {
    const finalCode = code || inviteLink;
    return `${window.location.origin}/?code=${finalCode}`;
  };

  const handleCopyLink = (code?: string) => {
    const url = getActivationUrl(code);
    navigator.clipboard.writeText(url);
    if (showToast) showToast('LINK COPIED', 'success');
    else alert('Link copied to clipboard');
  };

  const handleResendEmail = async (email: string) => {
    if (!confirm(`Resend invitation email to ${email}?`)) return;
    try {
        const res = await fetch('/api/auth/resend-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
            if (data.emailSent) {
                if (showToast) showToast('EMAIL RESENT', 'success');
                else alert('Email resent successfully.');
            } else {
                alert('Email server not configured. Please use "Copy Link".');
            }
        } else {
            alert(data.error || 'Failed to resend');
        }
    } catch (e) {
        alert('Connection error');
    }
  };

  const handleOpenEmailApp = () => {
    if (!invitedUserEmail) return;
    const subject = encodeURIComponent("Welcome to Reset Hospitality Studio");
    const body = encodeURIComponent(`You have been invited to join the Reset Hospitality Studio platform.\n\nPlease click the link below to activate your account and set your password:\n\n${getActivationUrl()}\n\nWelcome to the team.`);
    window.open(`mailto:${invitedUserEmail}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 text-left pb-24 max-w-6xl mx-auto relative px-2">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight text-left">Personnel Intelligence</h2>
          <p className="text-[8px] font-bold text-[#A68342] uppercase tracking-[0.4em] mt-1 opacity-80 text-left">TEAM REGISTRY</p>
        </div>
        
        {canManage && (
            <button onClick={() => setShowAddModal(true)} className="bg-[#C5A059] text-black px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl whitespace-nowrap active:scale-95 transition-all hover:bg-[#d4b476]">
              ADD USER
            </button>
        )}
      </header>

      {/* ACTIVE USERS */}
      <div className="space-y-10">
        {!hasActiveUsers ? (
          <div className="py-20 text-center border-2 border-dashed border-black/10 rounded-[40px]">
             <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.4em]">NO ACTIVE PERSONNEL FOUND</p>
             <p className="text-[8px] text-black/20 font-black uppercase mt-2">Use "Add User" to invite staff.</p>
          </div>
        ) : (
          activeStaffGroups.map((group, gIdx) => group.members.length > 0 && (
              <section key={gIdx} className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-black/20">ACTIVE: {group.title}</h3>
                  <div className="h-px flex-1 bg-black/5"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.members.map(u => (
                    <div key={u.id} className="p-5 rounded-[28px] border bg-[#FDF8EE] border-[#D4B476]/30 flex items-center justify-between gap-4 shadow-lg">
                      <div className="flex items-center gap-5 flex-1 min-w-0 text-left">
                        <div className="w-12 h-12 rounded-full bg-black border border-[#C5A059]/20 text-[#C5A059] flex items-center justify-center font-serif-brand text-lg font-bold">{u.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-black">{u.name}</h3>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[#A68342]">{u.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
          ))
        )}

        {/* PENDING INVITES */}
        {pendingUsers.length > 0 && (
          <section className="space-y-4 pt-10">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-orange-600/40">PENDING ACTIVATION</h3>
              <div className="h-px flex-1 bg-orange-600/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map(u => (
                <div key={u.id} className="p-5 rounded-[28px] border bg-white border-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-5 flex-1 min-w-0 text-left w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-serif-brand text-lg font-bold shrink-0">{u.name.charAt(0)}</div>
                    <div>
                      <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-black">{u.name}</h3>
                      <p className="text-[7px] font-black text-orange-500 uppercase tracking-widest">Invite Sent</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                     <button onClick={() => u.activationToken && handleCopyLink(u.activationToken)} className="flex-1 sm:flex-none px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-white hover:border-[#C5A059] transition-all">COPY LINK</button>
                     <button onClick={() => handleResendEmail(u.email)} className="flex-1 sm:flex-none px-4 py-2 bg-orange-50 border border-orange-200 text-orange-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all">RESEND</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* INVITE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#FDF8EE] border border-[#D4B476]/40 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-10 shadow-2xl relative text-left">
              <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-2 text-center md:text-left">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Member Registration</h2>
                 <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em]">Send Activation Link</p>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                 <div className="space-y-4">
                    <div><label className={labelStyle}>Full Name</label><input required className={inputStyle} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="E.G. MARIA BORG" /></div>
                    <div><label className={labelStyle}>Email Address</label><input required type="email" className={inputStyle} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="EMAIL@DOMAIN.COM" /></div>
                    <div>
                       <label className={labelStyle}>Role</label>
                       <select className={inputStyle} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                          <option value="cleaner">CLEANER</option>
                          <option value="supervisor">SUPERVISOR</option>
                          <option value="driver">DRIVER</option>
                          <option value="admin">ADMIN</option>
                          <option value="housekeeping">HOUSEKEEPING</option>
                          <option value="hr">HR</option>
                          <option value="maintenance">MAINTENANCE</option>
                       </select>
                    </div>
                 </div>
                 <button type="submit" disabled={isSending} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    {isSending ? (
                      <>
                        <span className="w-3 h-3 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin"></span>
                        SENDING...
                      </>
                    ) : 'SEND INVITATION'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* SUCCESS MODAL (EMAIL SENT) */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
           <div className="bg-[#FDF8EE] border border-green-500/30 rounded-[48px] w-full max-w-lg p-12 space-y-8 shadow-2xl relative text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 animate-in zoom-in spin-in-12 duration-500">
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
              </div>
              <div className="space-y-3">
                 <h2 className="text-3xl font-serif-brand font-bold uppercase text-black tracking-tight">Invitation Sent</h2>
                 <p className="text-[10px] text-black/60 font-medium leading-relaxed max-w-xs mx-auto">
                    A secure activation link has been emailed to <strong>{invitedUserEmail}</strong>.
                 </p>
              </div>
              <button onClick={() => setShowSuccessModal(false)} className="bg-black text-white font-black py-4 px-12 rounded-2xl uppercase tracking-[0.3em] text-[9px] shadow-xl hover:bg-zinc-800 transition-all active:scale-95">
                 Done
              </button>
           </div>
        </div>
      )}

      {/* FALLBACK MANUAL LINK (IF NO EMAIL SERVER) */}
      {inviteLink && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-[#FDF8EE] border border-green-500/30 rounded-[48px] w-full max-w-lg p-10 space-y-8 shadow-2xl relative text-center">
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Manual Dispatch</h2>
                 <p className="text-[10px] text-black/40 font-black uppercase tracking-widest">Email server not configured. Share link manually:</p>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-gray-200 break-all text-[10px] font-mono select-all">
                 {getActivationUrl()}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                 <button onClick={handleOpenEmailApp} className="flex items-center justify-center gap-2 bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[8px] hover:bg-[#d4b476] transition-all shadow-lg active:scale-95">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Compose Email
                 </button>
                 <button onClick={() => handleCopyLink()} className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-black font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[8px] hover:bg-gray-50 transition-all active:scale-95">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy Link
                 </button>
              </div>

              <button onClick={() => setInviteLink(null)} className="text-[9px] font-black text-black/30 uppercase tracking-[0.3em] hover:text-black transition-colors mt-4">Close Window</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default StaffHub;
