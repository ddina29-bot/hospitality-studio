
import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../../types';

interface StaffHubProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const StaffHub: React.FC<StaffHubProps> = ({ users, setUsers, showToast }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const isHousekeeping = currentUser.role === 'housekeeping';
  const canManage = isAdmin || isHousekeeping;

  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', role: 'cleaner' });

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) return;

    try {
      // Find org ID. In a real scenario this comes from props or context.
      // For now, we fetch it from the potentially stored org settings if available, or rely on server context
      // Note: The App component stores org settings in localStorage 'studio_org_settings' for persistence across refreshes if needed,
      // but ideally we passed it down. Let's grab it from localStorage if available as a fallback.
      const savedOrg = JSON.parse(localStorage.getItem('studio_org_settings') || '{}');
      
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
      setInviteLink(data.inviteLink);
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'cleaner' });
      
    } catch (err: any) {
      alert(err.message);
    }
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
              INVITE MEMBER
            </button>
        )}
      </header>

      {/* ACTIVE USERS */}
      <div className="space-y-10">
        {activeStaffGroups.map((group, gIdx) => group.members.length > 0 && (
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
        ))}

        {/* PENDING INVITES */}
        {pendingUsers.length > 0 && (
          <section className="space-y-4 pt-10">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap text-orange-600/40">PENDING ACTIVATION</h3>
              <div className="h-px flex-1 bg-orange-600/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map(u => (
                <div key={u.id} className="p-5 rounded-[28px] border bg-white border-orange-500/20 flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-5 flex-1 min-w-0 text-left">
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-serif-brand text-lg font-bold">{u.name.charAt(0)}</div>
                    <div>
                      <h3 className="text-sm font-serif-brand font-bold uppercase truncate text-black">{u.name}</h3>
                      <p className="text-[7px] font-black text-orange-500 uppercase tracking-widest">Invite Sent</p>
                    </div>
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
                       </select>
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all">SEND INVITATION</button>
              </form>
           </div>
        </div>
      )}

      {/* INVITE SUCCESS LINK */}
      {inviteLink && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-[#FDF8EE] border border-green-500/30 rounded-[48px] w-full max-w-lg p-10 space-y-10 shadow-2xl relative text-center">
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Invitation Generated</h2>
                 <p className="text-[10px] text-black/40 font-black uppercase tracking-widest">Share this verification link with the member:</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 break-all text-[10px] font-mono">
                 {window.location.origin}/login?code={inviteLink} <br/> (Simulated Email: "Click here to activate")
              </div>
              <button onClick={() => setInviteLink(null)} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px]">DONE</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default StaffHub;
