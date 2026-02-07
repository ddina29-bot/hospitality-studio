
import React, { useMemo, useState } from 'react';
import { User, TabType, Shift, Invoice, TimeEntry, SupplyItem, SupplyRequest, ManualTask, Property, LeaveRequest } from '../types';
import AdminDashboard from './dashboards/AdminDashboard';
import HousekeeperDashboard from './dashboards/HousekeeperDashboard';
import DriverDashboard from './dashboards/DriverDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';

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
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, users = [], setActiveTab, shifts = [], setShifts, properties = [], invoices = [], timeEntries = [], 
  supplyRequests = [], setSupplyRequests, manualTasks = [], setManualTasks, leaveRequests = [], onUpdateLeaveStatus, onLogisticsAlertClick, onAuditDeepLink, onLogout, onUpdateUser
}) => {
  
  const role = user.role;

  const performanceStats = useMemo(() => {
    const myCompleted = (shifts || []).filter(s => s.status === 'completed' && s.userIds.includes(user.id));
    const totalCompleted = myCompleted.length;
    const totalApproved = myCompleted.filter(s => s.approvalStatus === 'approved').length;
    const score = totalCompleted === 0 ? 100 : Math.round((totalApproved / totalCompleted) * 100);
    return { score, monthlyJobs: myCompleted.length };
  }, [shifts, user.id]);

  const renderDashboardModule = () => {
    switch(role) {
      case 'admin':
        return <AdminDashboard user={user} users={users} shifts={shifts} setShifts={setShifts as any} setActiveTab={setActiveTab} onLogout={onLogout as any} onAuditDeepLink={onAuditDeepLink} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} leaveRequests={leaveRequests} onUpdateLeaveStatus={onUpdateLeaveStatus} manualTasks={manualTasks} setManualTasks={setManualTasks} properties={properties} />;
      case 'housekeeping':
        return <HousekeeperDashboard user={user} users={users} shifts={shifts} setShifts={setShifts as any} setActiveTab={setActiveTab} properties={properties} supplyRequests={supplyRequests || []} setSupplyRequests={setSupplyRequests} leaveRequests={leaveRequests} onUpdateLeaveStatus={onUpdateLeaveStatus} onLogout={onLogout as any} onResolveLogistics={() => {}} onAuditDeepLink={onAuditDeepLink} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
      case 'driver':
        return <DriverDashboard user={user} shifts={shifts} properties={properties} setActiveTab={setActiveTab} onLogout={onLogout as any} onResolveLogistics={() => {}} onTogglePickedUp={() => {}} onToggleLaundryPrepared={() => {}} />;
      case 'cleaner':
      case 'supervisor':
        const isSupervisor = role === 'supervisor';
        return (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 text-left pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
              <div className="flex flex-col space-y-0.5">
                <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">OPERATIONS TERMINAL</p>
                <h1 className="text-xl md:text-2xl font-brand text-[#1E293B] tracking-tight uppercase leading-none font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setActiveTab('settings')} className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest shadow-md">REQUEST LEAVE</button>
              </div>
            </header>

            {/* Compact HUD */}
            <section className="bg-[#1E293B] rounded-2xl md:rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#2DD4BF]">Monthly Intelligence</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      <div className="space-y-0.5">
                          <p className="text-[7px] font-black text-[#CBD5E1] uppercase tracking-widest">Score</p>
                          <div className="flex items-baseline gap-1">
                              <p className="text-2xl md:text-3xl font-bold tracking-tighter text-[#F59E0B]">{performanceStats.score}</p>
                              <span className="text-xs text-[#F59E0B]/40">%</span>
                          </div>
                      </div>
                      <div className="space-y-0.5">
                          <p className="text-[7px] font-black text-[#CBD5E1] uppercase tracking-widest">Jobs Done</p>
                          <div className="flex items-baseline gap-1">
                              <p className="text-2xl md:text-3xl font-bold tracking-tighter text-white">{performanceStats.monthlyJobs}</p>
                              <span className="text-xs text-white/20">Units</span>
                          </div>
                      </div>
                  </div>
               </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={() => setActiveTab('shifts')} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md cursor-pointer hover:border-teal-500 transition-all flex justify-between items-center group">
                   <div className="space-y-0.5">
                      <h3 className="text-sm font-black uppercase text-slate-900 group-hover:text-teal-600 transition-colors">Shift Queue</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Deployments</p>
                   </div>
                   <span className="text-xl opacity-30">🗓️</span>
                </div>
            </div>
          </div>
        );
      default:
        return <div className="py-20 text-center opacity-30 uppercase font-black tracking-widest text-xs">Module standby...</div>;
    }
  };

  return <div className="w-full">{renderDashboardModule()}</div>;
};

export default Dashboard;
