
import React, { useMemo, useState, useEffect } from 'react';
import { User, TabType, Shift, Invoice, TimeEntry, SupplyRequest, ManualTask, Property, LeaveRequest, FeedItem } from '../types';
import AdminDashboard from './dashboards/AdminDashboard';
import HousekeeperDashboard from './dashboards/HousekeeperDashboard';
import DriverDashboard from './dashboards/DriverDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';
import InteractiveFeed from './InteractiveFeed';
import { getCleanerBriefing } from '../services/geminiService';

interface DashboardProps {
  user: User;
  users?: User[];
  setActiveTab: (tab: TabType) => void;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties?: Property[];
  invoices?: Invoice[];
  timeEntries?: TimeEntry[];
  supplyRequests?: SupplyRequest[];
  setSupplyRequests?: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  leaveRequests?: LeaveRequest[];
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => void;
  onLogisticsAlertClick?: (userId: string) => void;
  onAuditDeepLink?: (id: string) => void;
  onLogout?: () => void;
  onUpdateUser?: (u: User) => void;
  feedItems?: FeedItem[];
  onLikeFeedItem?: (id: string) => void;
  onPostFeedItem?: (post: Partial<FeedItem>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, users = [], setActiveTab, shifts = [], setShifts, properties = [], invoices = [], 
  supplyRequests = [], setSupplyRequests, manualTasks = [], setManualTasks, leaveRequests = [], onUpdateLeaveStatus, onAuditDeepLink, onLogout, onUpdateUser,
  feedItems = [], onLikeFeedItem, onPostFeedItem
}) => {
  
  const role = user.role;
  const [aiPulse, setAiPulse] = useState<string>('Analyzing...');
  const [isAiLoading, setIsAiLoading] = useState(true);

  // Fetch AI Briefing for Field Staff
  useEffect(() => {
    if (['cleaner', 'supervisor'].includes(role)) {
      const fetchData = async () => {
        setIsAiLoading(true);
        const myShifts = shifts.filter(s => s.userIds.includes(user.id));
        const pending = myShifts.filter(s => s.status !== 'completed').length;
        const completed = myShifts.filter(s => s.status === 'completed' && s.approvalStatus === 'approved').length;
        const issues = myShifts.filter(s => s.approvalStatus === 'rejected').length;

        const briefing = await getCleanerBriefing({
          pendingShifts: pending,
          completedToday: completed,
          reportedIssues: issues
        });
        setAiPulse(briefing);
        setIsAiLoading(false);
      };
      fetchData();
    }
  }, [role, shifts, user.id]);

  const renderDashboardModule = () => {
    switch(role) {
      case 'admin':
      case 'hr':
        return (
          <AdminDashboard 
            user={user} users={users} shifts={shifts} setShifts={setShifts as any} setActiveTab={setActiveTab} onLogout={onLogout as any} onAuditDeepLink={onAuditDeepLink}
            supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} leaveRequests={leaveRequests} onUpdateLeaveStatus={onUpdateLeaveStatus}
            manualTasks={manualTasks} setManualTasks={setManualTasks} properties={properties}
          />
        );
      case 'housekeeping':
        return (
          <HousekeeperDashboard 
            user={user} users={users} shifts={shifts} setShifts={setShifts as any} setActiveTab={setActiveTab} properties={properties} 
            supplyRequests={supplyRequests || []} setSupplyRequests={setSupplyRequests} leaveRequests={leaveRequests} onUpdateLeaveStatus={onUpdateLeaveStatus}
            onLogout={onLogout as any} onResolveLogistics={() => {}} onAuditDeepLink={onAuditDeepLink} manualTasks={manualTasks} setManualTasks={setManualTasks}
          />
        );
      case 'driver':
        return (
          <DriverDashboard 
            user={user} shifts={shifts} properties={properties} setActiveTab={setActiveTab} onLogout={onLogout as any} 
            onResolveLogistics={() => {}} onTogglePickedUp={() => {}} onToggleLaundryPrepared={() => {}} 
          />
        );
      default:
        // Cleaner/Supervisor standard "Home" view
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 text-left">
            
            {/* COMPACT AI STATUS BAR */}
            <div className="bg-slate-900 px-6 py-3 rounded-full flex items-center justify-between border border-teal-500/20 shadow-xl overflow-hidden group">
               <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isAiLoading ? 'bg-teal-400 animate-ping' : 'bg-teal-500 animate-pulse'}`}></div>
                  <p className={`text-[10px] md:text-xs text-teal-100 font-medium truncate italic ${isAiLoading ? 'opacity-40' : ''}`}>
                    "{aiPulse}"
                  </p>
               </div>
               <button onClick={() => setActiveTab('shifts')} className="shrink-0 text-[8px] font-black text-teal-400 uppercase tracking-widest hover:text-white transition-colors ml-4 border-l border-teal-500/20 pl-4">GO TO JOBS →</button>
            </div>

            {/* TOP STATS & WELCOME ROW */}
            <header className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
               <div className="lg:col-span-7 flex flex-col justify-center gap-1">
                  <p className="text-teal-600 font-black uppercase tracking-[0.4em] text-[9px]">Operator Portal</p>
                  <h1 className="text-3xl md:text-4xl font-brand text-[#1E293B] tracking-tighter uppercase font-black leading-none">Hello, {user.name.split(' ')[0]}</h1>
               </div>
               
               {/* PERFORMANCE STATS */}
               <div className="lg:col-span-5 bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between gap-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="text-left border-r border-slate-50 pr-4">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Quality Index</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">98%</p>
                     </div>
                     <div className="text-left pl-4">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Jobs</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{shifts.filter(s => s.userIds.includes(user.id) && s.status === 'completed').length}</p>
                     </div>
                  </div>
               </div>
            </header>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
               <div className="lg:col-span-7 space-y-8">
                  {/* PULSE FEED (Manual Updates Priority) */}
                  <div className="space-y-6">
                     <header className="px-2 flex justify-between items-end">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Studio Pulse Feed</h3>
                          <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mt-1">Manual Operational Updates</p>
                        </div>
                        <button onClick={() => setActiveTab('pulse')} className="text-[8px] font-black text-teal-600 uppercase tracking-widest hover:underline">Full Feed →</button>
                     </header>
                     <InteractiveFeed 
                        items={feedItems} 
                        currentUser={user} 
                        onLike={onLikeFeedItem || (() => {})} 
                        onNavigate={setActiveTab} 
                        onPostManual={['admin', 'hr', 'housekeeping', 'supervisor'].includes(user.role) ? onPostFeedItem : undefined}
                        maxHeight="none"
                     />
                  </div>
               </div>

               {/* SIDEBAR */}
               <aside className="lg:col-span-5 space-y-6 md:space-y-8">
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group cursor-pointer" onClick={() => setActiveTab('shifts')}>
                     <div className="absolute top-0 right-0 p-6 opacity-5">
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                     </div>
                     <div className="relative z-10">
                        <h4 className="text-lg font-bold uppercase tracking-tight">Active Assignments</h4>
                        <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mt-1">View Schedule</p>
                        <div className="mt-6 flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 font-black">
                              {shifts.filter(s => s.userIds.includes(user.id) && s.status !== 'completed').length}
                           </div>
                           <p className="text-[11px] font-bold text-slate-400 uppercase">Shifts pending today</p>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-6">
                     <div className="text-left space-y-2">
                       <h3 className="text-xs font-black uppercase tracking-widest">Financial Ledger</h3>
                       <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Review your verified deployments and estimated gross earnings.</p>
                     </div>
                     <button onClick={() => setActiveTab('worksheet')} className="w-full py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all">MY WORK HISTORY →</button>
                  </div>

                  <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group cursor-pointer" onClick={() => setActiveTab('tutorials')}>
                     <div className="relative z-10 flex items-center justify-between">
                        <div>
                           <h4 className="text-lg font-bold uppercase tracking-tight">Access Academy</h4>
                           <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-1">SOPs & Training</p>
                        </div>
                        <span className="text-4xl group-hover:rotate-12 transition-transform">🎓</span>
                     </div>
                  </div>
               </aside>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full animate-in fade-in duration-700">
       {renderDashboardModule()}
    </div>
  );
};

export default Dashboard;
