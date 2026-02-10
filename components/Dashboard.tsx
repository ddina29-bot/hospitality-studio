
import React, { useMemo } from 'react';
import { User, TabType, Shift, Invoice, TimeEntry, SupplyRequest, ManualTask, Property, LeaveRequest, FeedItem } from '../types';
import AdminDashboard from './dashboards/AdminDashboard';
import HousekeeperDashboard from './dashboards/HousekeeperDashboard';
import DriverDashboard from './dashboards/DriverDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';
import InteractiveFeed from './InteractiveFeed';

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
  const isManagement = ['admin', 'housekeeping'].includes(role);

  const performanceStats = useMemo(() => {
    const myCompleted = (shifts || []).filter(s => s.status === 'completed' && s.userIds.includes(user.id));
    const totalCompleted = myCompleted.length;
    const totalApproved = myCompleted.filter(s => s.approvalStatus === 'approved').length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyCompleted = myCompleted.filter(s => {
        const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${currentYear}`);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyChecks = monthlyCompleted.filter(s => s.serviceType === 'TO CHECK APARTMENT').length;
    const monthlyHours = monthlyCompleted.reduce((acc, s) => {
        if (s.actualStartTime && s.actualEndTime) {
            return acc + (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60);
        }
        return acc;
    }, 0);

    const score = totalCompleted === 0 ? 100 : Math.round((totalApproved / totalCompleted) * 100);

    return { score, monthlyJobs: monthlyCompleted.length, monthlyChecks, monthlyHours: Math.round(monthlyHours * 10) / 10 };
  }, [shifts, user.id]);

  const renderDashboardModule = () => {
    switch(role) {
      case 'admin':
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
      case 'cleaner':
      case 'supervisor':
        return (
          <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
              <div className="flex flex-col space-y-1">
                <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px]">OPERATIONS TERMINAL ACTIVE</p>
                <h1 className="text-2xl md:text-4xl font-brand text-[#1E293B] tracking-tighter uppercase leading-none font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setActiveTab('settings')} className="flex-1 md:flex-none px-6 py-3.5 rounded-[1.5rem] bg-indigo-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">⛱️ REQUEST LEAVE</button>
              </div>
            </header>

            <section className="bg-[#1E293B] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
               <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <div>
                      <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Quality Score</p>
                      <p className="text-5xl font-bold font-brand tracking-tighter text-[#F59E0B]">{performanceStats.score}%</p>
                  </div>
                  <div>
                      <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Done (Month)</p>
                      <p className="text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyJobs}</p>
                  </div>
                  <div>
                      <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Hours Logged</p>
                      <p className="text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyHours}</p>
                  </div>
               </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
               <div onClick={() => setActiveTab('shifts')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl cursor-pointer hover:border-teal-500 transition-all group text-left">
                  <h3 className="text-xl font-black uppercase text-slate-900 group-hover:text-teal-600 transition-colors">Shift Queue</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">VIEW UPCOMING DEPLOYMENTS</p>
               </div>
               <div onClick={() => setActiveTab('tutorials')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl cursor-pointer hover:border-teal-500 transition-all group text-left">
                  <h3 className="text-xl font-black uppercase text-slate-900 group-hover:text-teal-600 transition-colors">Training</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OFFICIAL STUDIO STANDARDS</p>
               </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="w-full">
      <div className={`grid grid-cols-1 gap-10 ${isManagement ? 'lg:grid-cols-1' : 'lg:grid-cols-12'}`}>
         <div className={isManagement ? 'w-full space-y-10' : 'lg:col-span-8 space-y-10'}>
            {renderDashboardModule()}
         </div>
         
         {!isManagement && (
           <aside className="lg:col-span-4 space-y-8 animate-in slide-in-from-right-8 duration-700">
              <header className="px-2 text-left">
                 <h3 className="text-xl font-brand font-black uppercase text-slate-900 tracking-tighter">Live Pulse</h3>
                 <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.4em] mt-1">OPERATIONAL ACTIVITY</p>
              </header>
              
              <div className="bg-[#F8FAFC] p-4 rounded-[2.5rem] border border-slate-100 shadow-inner">
                 <InteractiveFeed 
                   items={feedItems} 
                   currentUser={user} 
                   onLike={onLikeFeedItem || (() => {})} 
                   onNavigate={setActiveTab} 
                   onPostManual={onPostFeedItem}
                   maxHeight="calc(100vh - 280px)"
                 />
              </div>
              
              <button 
                 onClick={() => setActiveTab('pulse')}
                 className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-teal-600 transition-colors"
              >
                 View Entire Stream →
              </button>
           </aside>
         )}
      </div>
    </div>
  );
};

export default Dashboard;
