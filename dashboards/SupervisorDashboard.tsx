import React, { useState, useMemo, useEffect } from 'react';
import { TabType, Shift, User, ManualTask } from '../../types';

interface SupervisorDashboardProps {
  user: User;
  users: User[];
  setActiveTab: (tab: TabType) => void;
  shifts?: Shift[];
  onLogout: () => void;
  manualTasks?: ManualTask[];
  setManualTasks?: React.Dispatch<React.SetStateAction<ManualTask[]>>;
  isLaundryAuthorized?: boolean;
  onToggleLaundryPrepared: (shiftId: string) => void;
  onAuditDeepLink?: (shiftId: string) => void;
  authorizedInspectorIds: string[];
  setAuthorizedInspectorIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ 
  user, users, setActiveTab, shifts = [], onLogout, manualTasks = [], setManualTasks, isLaundryAuthorized = false, onToggleLaundryPrepared, onAuditDeepLink, authorizedInspectorIds, setAuthorizedInspectorIds 
}) => {
  const isActualSupervisor = user.role === 'supervisor';
  const isAdmin = user.role === 'admin';
  const isHousekeeping = user.role === 'housekeeping';
  const isManagement = isAdmin || isHousekeeping;
  
  const [adminOverride, setAdminOverride] = useState(false);

  // Check for ANY active session for the current user
  const currentlyActiveSession = useMemo(() => {
    return (shifts || []).find(s => s.status === 'active' && s.userIds.includes(user.id));
  }, [shifts, user.id]);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), []);

  const { activeInspections, archivedInspections } = useMemo(() => {
    const list = (shifts || []).filter(s => s && s.serviceType === 'TO CHECK APARTMENT');
    const active = list.filter(s => {
      if (s.status === 'completed') return false;
      if (isActualSupervisor) return s.userIds.includes(user.id);
      return true;
    });
    const archived = list.filter(s => s.status === 'completed');
    return { activeInspections: active, archivedInspections: archived.sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0)) };
  }, [shifts, isActualSupervisor, user.id]);
  
  const handleInspectAction = (shiftId: string) => {
    if (currentlyActiveSession && currentlyActiveSession.id !== shiftId) {
        alert(`ACTIVE SESSION ALERT: Finish ${currentlyActiveSession.propertyName} before starting a new inspection.`);
        return;
    }
    if (onAuditDeepLink) onAuditDeepLink(shiftId);
    else setActiveTab('shifts');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      {currentlyActiveSession && (
          <div className="bg-rose-50 border-2 border-rose-200 p-6 rounded-[2rem] shadow-lg animate-in slide-in-from-top-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-left">
                  <p className="text-sm font-black text-rose-800 uppercase tracking-tight">Active Deployment: {currentlyActiveSession.propertyName}</p>
                  <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest mt-1">Inspection actions are locked until this unit is finished.</p>
              </div>
              <button 
                onClick={() => setActiveTab('shifts')}
                className="bg-rose-600 text-white px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl"
              >
                Go to Active Unit
              </button>
          </div>
      )}
      {/* Rest of the component follows... */}
    </div>
  );
};

export default SupervisorDashboard;