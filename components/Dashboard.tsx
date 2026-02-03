
import React from 'react';
import { User, TabType, Shift, Invoice, TimeEntry } from '../types';
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
  invoices?: Invoice[];
  timeEntries?: TimeEntry[];
  onLogisticsAlertClick?: (userId: string) => void;
  onAuditDeepLink?: (id: string) => void;
  onLogout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, users = [], setActiveTab, shifts = [], setShifts, invoices = [], timeEntries = [], onLogisticsAlertClick, onAuditDeepLink, onLogout 
}) => {
  
  const role = user.role;

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
            properties={[]} 
            supplyRequests={[]} 
            onLogout={onLogout as any} 
            onResolveLogistics={() => {}}
            onAuditDeepLink={onAuditDeepLink}
          />
        );
      case 'driver':
        return (
          <DriverDashboard 
            user={user} 
            shifts={shifts} 
            properties={[]} 
            setActiveTab={setActiveTab} 
            onLogout={onLogout as any} 
            onResolveLogistics={() => {}} 
            onTogglePickedUp={() => {}} 
            onToggleLaundryPrepared={() => {}} 
          />
        );
      case 'supervisor':
        return (
            <SupervisorDashboard 
              user={user} 
              users={users} 
              shifts={shifts} 
              setActiveTab={setActiveTab} 
              onLogout={onLogout as any} 
              onToggleLaundryPrepared={() => {}} 
              onAuditDeepLink={onAuditDeepLink}
              authorizedInspectorIds={[]}
              setAuthorizedInspectorIds={() => {}}
            />
        );
      default:
        return (
          <div className="space-y-6 text-left animate-in fade-in duration-500 pb-32 max-w-2xl mx-auto">
            <header>
              <h2 className="text-2xl font-bold text-slate-900 uppercase">Studio Hub</h2>
              <p className="text-[9px] text-teal-600 font-bold uppercase tracking-[0.3em] mt-2">Personnel: {user.name.toUpperCase()}</p>
            </header>

            <section className="bg-teal-600 p-8 rounded-[2.5rem] text-white shadow-xl space-y-4">
              <h3 className="text-lg font-bold uppercase">Field Deployment</h3>
              <p className="text-teal-50/80 text-sm">Access your interactive schedule to initialize today's missions.</p>
              <button onClick={() => setActiveTab('shifts')} className="w-full bg-white text-teal-600 font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg">Start Work</button>
            </section>
          </div>
        );
    }
  };

  return (
    <div className="pb-24">
      {renderDashboardModule()}
    </div>
  );
};

export default Dashboard;
