
import React, { useMemo } from 'react';
import { AppNotification, TabType, UserRole } from '../types';

interface ActivityCenterProps {
  notifications: AppNotification[];
  onClose: () => void;
  onNavigate: (tab: TabType, id?: string) => void;
  userRole: UserRole;
  currentUserId: string;
}

const ActivityCenter: React.FC<ActivityCenterProps> = ({ notifications, onClose, onNavigate, userRole, currentUserId }) => {
  // PRIVACY FIREWALL: Filter notifications strictly based on ownership and role targets
  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        // 1. Admins and HR have full visibility over the operational log
        if (['admin', 'hr'].includes(userRole)) return true;
        
        // 2. Global broadcast/success messages are visible to all (system-wide announcements)
        if (n.type === 'success' && !n.linkTab) return true;

        // 3. User-Specific Lock: For any notification linked to a specific entity
        // If it's a personnel-related alert (leave, profile, payslip), it MUST match currentUserId.
        // Use a casted variable to bypass unintentional narrowing in TypeScript
        const linkTab = n.linkTab as string | undefined;
        if (linkTab === 'settings' || linkTab === 'worksheet') {
           return String(n.linkId) === String(currentUserId);
        }

        // 4. Role-based visibility for housekeeping managers (operational focus, NO private HR data)
        if (userRole === 'housekeeping') {
          // Use linkTab casted variable here as well for consistency
          const isPrivateAlertAboutOthers = n.type === 'alert' && linkTab === 'settings' && String(n.linkId) !== String(currentUserId);
          return !isPrivateAlertAboutOthers;
        }

        // 5. Strict owner-only lock for all other staff roles
        const isMyOwnData = String(n.linkId) === String(currentUserId);
        const isSafeGlobalType = (n.type === 'info' || n.type === 'success') && !n.linkTab;
        
        return isMyOwnData || isSafeGlobalType;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [notifications, userRole, currentUserId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex justify-end backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-[#FDF8EE] h-full shadow-2xl border-l border-[#C5A059]/30 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-[#D4B476]/20 flex justify-between items-center bg-white">
           <div>
              <h2 className="text-lg font-serif-brand font-bold text-black uppercase tracking-tight">Activity Center</h2>
              <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.3em]">Operational Dispatch</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 text-black/40 hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
           {filteredNotifications.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black">Log Clear</p>
             </div>
           ) : (
             filteredNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => { if(notif.linkTab) onNavigate(notif.linkTab, notif.linkId); onClose(); }}
                  className={`p-5 rounded-[2rem] border shadow-sm cursor-pointer transition-all hover:scale-[1.02] flex gap-4 items-start ${
                    notif.type === 'alert' ? 'bg-red-50 border-red-200' :
                    notif.type === 'success' ? 'bg-green-50 border-green-200' :
                    notif.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                    'bg-white border-[#D4B476]/20'
                  }`}
                >
                   <div className="flex-1 flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          notif.type === 'alert' ? 'bg-red-500 animate-pulse' :
                          notif.type === 'success' ? 'bg-green-500' :
                          notif.type === 'warning' ? 'bg-orange-500' :
                          'bg-[#C5A059]'
                      }`}></div>
                      <div className="flex-1">
                          <h4 className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${notif.type === 'alert' ? 'text-red-700' : 'text-black'}`}>{notif.title}</h4>
                          <p className="text-[10px] text-black/60 mt-1 leading-relaxed">{notif.message}</p>
                          <p className="text-[8px] text-black/20 font-black uppercase mt-2 text-right tracking-widest">
                            {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                      </div>
                   </div>
                </div>
             ))
           )}
        </div>
        
        <div className="p-6 bg-white border-t border-[#D4B476]/10">
           <button onClick={() => onClose()} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[9px] tracking-widest shadow-xl active:scale-95">Return to Hub</button>
        </div>
      </div>
    </div>
  );
};

export default ActivityCenter;
