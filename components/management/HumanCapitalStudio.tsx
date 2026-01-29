
import React, { useState, useMemo } from 'react';
import { User, Announcement, LeaveRequest, TabType } from '../../types';
import StaffHub from './StaffHub';

interface HumanCapitalStudioProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  leaveRequests?: LeaveRequest[];
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => void;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const HumanCapitalStudio: React.FC<HumanCapitalStudioProps> = ({ 
  users, setUsers, leaveRequests = [], onUpdateLeaveStatus, onPreviewActivation, showToast 
}) => {
  const [activeTab, setActiveTab] = useState<'registry' | 'intelligence'>('intelligence');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', category: 'Company' as any });
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: '1', title: 'Winter Uniform Distribution', content: 'Please visit the office this Friday to collect your winter fleece and jackets.', date: '24 OCT', author: 'HR Sarah', category: 'Company', timestamp: Date.now() },
    { id: '2', title: 'New Safety Protocol: Chemicals', content: 'Mandatory gloves required for all Degreaser Spray usage starting immediately.', date: '22 OCT', author: 'Operations', category: 'Safety', timestamp: Date.now() - 1000 * 60 * 60 * 1 }
  ]);

  const pendingLeaves = useMemo(() => leaveRequests.filter(l => l.status === 'pending'), [leaveRequests]);
  
  const complianceStats = useMemo(() => {
    const total = users.length;
    const missingDocs = users.filter(u => !u.hasID || !u.hasContract).length;
    return { total, missingDocs };
  }, [users]);

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    const post: Announcement = {
      ...newAnnouncement,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
      author: 'ADMINISTRATION',
      timestamp: Date.now()
    };
    setAnnouncements([post, ...announcements]);
    setShowAnnouncementModal(false);
    setNewAnnouncement({ title: '', content: '', category: 'Company' });
    if (showToast) showToast('BROADCAST DISPATCHED', 'success');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px]">Human Capital Terminal</p>
          <h2 className="text-2xl md:text-3xl font-serif-brand text-black uppercase font-bold tracking-tight leading-tight">STUDIO <span className="text-[#C5A059] italic">PEOPLE</span></h2>
        </div>
        
        <div className="p-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center shadow-inner w-full md:w-auto">
           <button 
             onClick={() => setActiveTab('intelligence')}
             className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
               activeTab === 'intelligence' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/30 hover:text-black/60'
             }`}
           >
             Personnel Intelligence
           </button>
           <button 
             onClick={() => setActiveTab('registry')}
             className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
               activeTab === 'registry' ? 'bg-[#C5A059] text-black shadow-lg' : 'text-black/30 hover:text-black/60'
             }`}
           >
             Registry & Onboarding
           </button>
        </div>
      </header>

      {activeTab === 'intelligence' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COMPLIANCE & TEAM HEALTH */}
          <div className="lg:col-span-1 space-y-8">
            <section className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-xl space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-serif-brand font-bold uppercase tracking-widest">Compliance Monitor</h3>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${complianceStats.missingDocs > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                     {complianceStats.missingDocs > 0 ? 'Action Required' : 'Audit Clear'}
                  </span>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-gray-50 pb-4">
                     <p className="text-[10px] font-black text-black/30 uppercase tracking-widest leading-none">Missing Documents</p>
                     <p className="text-3xl font-serif-brand font-bold text-red-600 leading-none">{complianceStats.missingDocs}</p>
                  </div>
                  <div className="space-y-2">
                     {users.filter(u => !u.hasID || !u.hasContract).slice(0, 3).map(u => (
                       <div key={u.id} className="flex justify-between items-center text-[9px] font-bold uppercase">
                          <span className="text-black/60">{u.name}</span>
                          <span className="text-red-500/60">Missing Contract</span>
                       </div>
                     ))}
                  </div>
                  <button onClick={() => setActiveTab('registry')} className="w-full py-3 bg-gray-50 text-black/40 hover:text-black rounded-xl text-[8px] font-black uppercase tracking-widest transition-all">RESOLVE RECORDS</button>
               </div>
            </section>

            {/* LEAVE QUEUE */}
            <section className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] shadow-xl space-y-6">
               <h3 className="text-xs font-serif-brand font-bold uppercase tracking-widest">Absence Requests</h3>
               <div className="space-y-3">
                  {pendingLeaves.length === 0 ? (
                    <p className="text-[10px] text-black/20 italic text-center py-4">No pending requests</p>
                  ) : pendingLeaves.map(l => (
                    <div key={l.id} className="bg-white p-4 rounded-2xl border border-[#D4B476]/10 shadow-sm space-y-3">
                       <div className="flex justify-between items-start">
                          <div className="text-left">
                             <p className="text-[10px] font-black text-black uppercase">{l.userName}</p>
                             <p className="text-[8px] text-[#C5A059] font-black uppercase tracking-widest">{l.type}</p>
                          </div>
                          <span className="text-[8px] text-black/30 font-bold">{l.startDate}</span>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => onUpdateLeaveStatus?.(l.id, 'approved')} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-[8px] font-black uppercase">Approve</button>
                          <button onClick={() => onUpdateLeaveStatus?.(l.id, 'rejected')} className="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-[8px] font-black uppercase">Reject</button>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          </div>

          {/* ANNOUNCEMENT FEED */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-sm font-serif-brand font-bold uppercase tracking-widest text-black">Company Notice Board</h3>
               <button 
                  onClick={() => setShowAnnouncementModal(true)}
                  className="bg-black text-[#C5A059] font-black px-5 py-2 rounded-xl text-[8px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  NEW BROADCAST
                </button>
            </div>

            <div className="space-y-4">
               {announcements.map(ann => (
                 <div key={ann.id} className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-lg hover:shadow-2xl transition-all group relative overflow-hidden text-left">
                    <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-[20px] text-[8px] font-black uppercase tracking-widest ${
                      ann.category === 'Safety' ? 'bg-red-600 text-white' : 'bg-[#C5A059] text-black'
                    }`}>
                      {ann.category}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                       <div className="space-y-3 flex-1">
                          <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-widest">{ann.date} • {ann.author.toUpperCase()}</p>
                          <h4 className="text-xl font-serif-brand font-bold text-black uppercase tracking-tight leading-tight">{ann.title}</h4>
                          <p className="text-[11px] text-black/60 leading-relaxed font-medium">{ann.content}</p>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-4 duration-500">
           <StaffHub 
             users={users} 
             setUsers={setUsers} 
             onPreviewActivation={onPreviewActivation}
             showToast={showToast}
           />
        </div>
      )}

      {/* NEW ANNOUNCEMENT MODAL */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-xl p-10 space-y-8 shadow-2xl relative text-left">
              <button onClick={() => setShowAnnouncementModal(false)} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <h2 className="text-2xl font-serif-brand font-bold uppercase text-black">Broadcast Message</h2>
              <form onSubmit={handlePostAnnouncement} className="space-y-6">
                 <div className="space-y-4">
                    <div>
                       <label className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2 block">Subject Line</label>
                       <input required className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={newAnnouncement.title} onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})} placeholder="E.G. NEW UNIFORMS ARRIVING" />
                    </div>
                    <div>
                       <label className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2 block">Category</label>
                       <select className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-[#C5A059]" value={newAnnouncement.category} onChange={e => setNewAnnouncement({...newAnnouncement, category: e.target.value})}>
                          <option value="Company">Company Update</option>
                          <option value="Safety">Safety Alert</option>
                          <option value="Procedure">Procedure Change</option>
                          <option value="Social">Social</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2 block">Content Body</label>
                       <textarea required className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 text-[10px] h-32 font-medium leading-relaxed outline-none focus:border-[#C5A059]" value={newAnnouncement.content} onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})} placeholder="Type your message here..." />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl active:scale-95 transition-all">POST TO NOTICE BOARD</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default HumanCapitalStudio;
