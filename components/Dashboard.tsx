
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

  // 24 Hour Logic for Supplies Button
  const isRequestBlocked = useMemo(() => {
    if (!user.lastSupplyRequestDate) return false;
    const now = Date.now();
    const diff = now - user.lastSupplyRequestDate;
    return diff < 24 * 60 * 60 * 1000;
  }, [user.lastSupplyRequestDate]);

  const requestButtonLabel = useMemo(() => {
    if (isRequestBlocked && user.lastSupplyRequestDate) {
      const dateStr = new Date(user.lastSupplyRequestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
      return `Requested ${dateStr}`;
    }
    return 'Request Supplies';
  }, [isRequestBlocked, user.lastSupplyRequestDate]);

  // Statistics Calculation for Cleaner
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

    const monthlyHours = monthlyCompleted.reduce((acc, s) => {
        if (s.actualStartTime && s.actualEndTime) {
            return acc + (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60);
        }
        return acc;
    }, 0);

    const score = totalCompleted === 0 ? 100 : Math.round((totalApproved / totalCompleted) * 100);

    return {
        score,
        monthlyJobs: monthlyCompleted.length,
        monthlyHours: Math.round(monthlyHours * 10) / 10
    };
  }, [shifts, user.id]);

  const renderDashboardModule = () => {
    switch(role) {
      case 'admin':
        return (
          <AdminDashboard 
            user={user} 
            users={users} 
            shifts={shifts} 
            setShifts={setShifts as any} 
            setActiveTab={setActiveTab} 
            onLogout={onLogout as any} 
            onAuditDeepLink={onAuditDeepLink}
            supplyRequests={supplyRequests}
            setSupplyRequests={setSupplyRequests}
            leaveRequests={leaveRequests}
            onUpdateLeaveStatus={onUpdateLeaveStatus}
            manualTasks={manualTasks}
            setManualTasks={setManualTasks}
            properties={properties}
          />
        );
      case 'housekeeping':
        return (
          <HousekeeperDashboard 
            user={user} 
            users={users} 
            shifts={shifts} 
            setShifts={setShifts as any} 
            setActiveTab={setActiveTab} 
            properties={properties} 
            supplyRequests={supplyRequests || []} 
            setSupplyRequests={setSupplyRequests}
            leaveRequests={leaveRequests}
            onUpdateLeaveStatus={onUpdateLeaveStatus}
            onLogout={onLogout as any} 
            onResolveLogistics={() => {}}
            onAuditDeepLink={onAuditDeepLink}
            manualTasks={manualTasks}
            setManualTasks={setManualTasks}
          />
        );
      case 'driver':
        return (
          <DriverDashboard 
            user={user} 
            shifts={shifts} 
            properties={properties} 
            setActiveTab={setActiveTab} 
            onLogout={onLogout as any} 
            onResolveLogistics={() => {}} 
            onTogglePickedUp={() => {}} 
            onToggleLaundryPrepared={() => {}} 
          />
        );
      case 'cleaner':
      case 'supervisor':
      case 'laundry':
        const isCleaner = role === 'cleaner';
        const isSupervisor = role === 'supervisor';
        return (
          <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 text-left pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
              <div className="flex flex-col space-y-1">
                <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px]">OPERATIONS TERMINAL ACTIVE</p>
                <h1 className="text-2xl md:text-4xl font-brand text-[#1E293B] tracking-tighter uppercase leading-none font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
                <p className="text-[10px] md:text-[11px] text-slate-400 font-medium uppercase tracking-wide mt-1">Review deployment queue and performance.</p>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="flex-1 md:flex-none px-6 py-3.5 rounded-[1.5rem] bg-indigo-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-lg">⛱️</span>
                  REQUEST LEAVE
                </button>
                {isCleaner && (
                  <button 
                    onClick={() => setActiveTab('shifts')} 
                    disabled={isRequestBlocked}
                    className={`flex-1 md:flex-none px-6 md:px-8 py-3.5 md:py-4 rounded-[1.5rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isRequestBlocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                  >
                      <span className="text-lg">{isRequestBlocked ? '📅' : '📦'}</span>
                      <span>{requestButtonLabel}</span>
                  </button>
                )}
              </div>
            </header>

            {/* PERFORMANCE DASHBOARD HUD (Only for cleaner/supervisor) */}
            {(isCleaner || isSupervisor) && (
              <section className="bg-[#1E293B] rounded-3xl md:rounded-[40px] p-5 md:p-10 text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
                    <svg width="180" height="180" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                 </div>
                 
                 <div className="relative z-10 space-y-6 md:space-y-8">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]"></div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#2DD4BF]">Monthly Performance Intelligence</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
                        <div className="space-y-0.5">
                            <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Success Score</p>
                            <div className="flex items-baseline gap-1.5">
                                <p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-[#F59E0B]">{performanceStats.score}</p>
                                <span className="text-base md:text-lg font-bold text-[#F59E0B]/40">%</span>
                            </div>
                        </div>
                        
                        <div className="space-y-0.5">
                            <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Done This Month</p>
                            <div className="flex items-baseline gap-1.5">
                                <p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyJobs}</p>
                                <span className="text-base md:text-lg font-bold text-white/20">Units</span>
                            </div>
                        </div>
                        
                        <div className="space-y-0.5">
                            <p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Total Hours</p>
                            <div className="flex items-baseline gap-1.5">
                                <p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyHours}</p>
                                <span className="text-base md:text-lg font-bold text-white/20">Hrs</span>
                            </div>
                        </div>
                    </div>
                 </div>
              </section>
            )}

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div onClick={() => setActiveTab('shifts')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl cursor-pointer hover:border-teal-500 transition-all group">
                   <div className="flex justify-between items-center">
                      <div className="space-y-1">
                         <h3 className="text-xl font-black uppercase text-slate-900 group-hover:text-teal-600 transition-colors">Shift Queue</h3>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">VIEW UPCOMING DEPLOYMENTS</p>
                      </div>
                      <span className="text-2xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all">🗓️</span>
                   </div>
                </div>
                <div onClick={() => setActiveTab('tutorials')} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl cursor-pointer hover:border-teal-500 transition-all group">
                   <div className="flex justify-between items-center">
                      <div className="space-y-1">
                         <h3 className="text-xl font-black uppercase text-slate-900 group-hover:text-teal-600 transition-colors">Guidelines</h3>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">REVIEW STUDIO STANDARDS</p>
                      </div>
                      <span className="text-2xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all">📚</span>
                   </div>
                </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6 text-left animate-in fade-in duration-700 pb-24 max-w-2xl mx-auto">
            <header>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 uppercase">Studio Hub</h2>
              <p className="text-[8px] md:text-[9px] text-teal-600 font-bold uppercase tracking-[0.3em] mt-2">Personnel: {user.name.toUpperCase()}</p>
            </header>
            <p className="text-slate-400 text-xs italic">Select a navigation item from the dock to begin.</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {renderDashboardModule()}
    </div>
  );
};

export default Dashboard;
