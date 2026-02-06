
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPortal from './components/AdminPortal';
import CleanerPortal from './components/CleanerPortal';
import DriverPortal from './components/DriverPortal';
import TutorialsHub from './components/TutorialsHub';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import ReportsPortal from './components/ReportsPortal';
import StudioSettings from './components/management/StudioSettings';
import InventoryAdmin from './components/management/InventoryAdmin';
import LaundryDashboard from './components/dashboards/LaundryDashboard';
import PersonnelProfile from './components/PersonnelProfile';
import ActivityCenter from './components/ActivityCenter';
import Login from './components/Login';
import Signup from './components/Signup';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, AppNotification, LeaveType } from './types';

const load = <T,>(k: string, f: T): T => {
  if (typeof window === 'undefined') return f;
  const s = localStorage.getItem(k);
  if (!s) return f;
  try { return JSON.parse(s); } catch (e) { return f; }
};

const safeSave = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Storage limit reached for ${key}. Data held in memory only.`);
  }
};

const App: React.FC = () => {
  const [activationToken, setActivationToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('code');
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined' || activationToken) return null;
    const s = localStorage.getItem('current_user_obj');
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  });
  
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [orgId, setOrgId] = useState<string | null>(() => activationToken ? null : localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => activationToken ? 'dashboard' : (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [selectedAuditShiftId, setSelectedAuditShiftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [hasHydrated, setHasHydrated] = useState(false);
  const isHydratingInProgress = useRef(false);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load('studio_notifications', []));
  const [showActivityCenter, setShowActivityCenter] = useState(false);

  const [users, setUsers] = useState<User[]>(() => load('studio_users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => load('studio_shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => load('studio_props', []));
  const [clients, setClients] = useState<Client[]>(() => load('studio_clients', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('studio_invoices', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('studio_time_entries', []));
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => load('studio_tutorials', []));
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => load('studio_inventory', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => load('studio_supply_requests', []));
  const [anomalyReports, setAnomalyReports] = useState<AnomalyReport[]>(() => load('studio_anomalies', []));
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => load('studio_manual_tasks', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => load('studio_leave_requests', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: 'HQ Malta', email: 'ops@reset.studio', phone: '+356 2100 0000' }));
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>(() => load('studio_auth_laundry_ids', []));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPersistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(() => {
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActivationToken(null);
    localStorage.clear();
    setAuthView('login');
  }, []);

  const hydrateState = useCallback(async (emailToUse?: string) => {
    const targetEmail = emailToUse || user?.email;
    if (!targetEmail || isHydratingInProgress.current || hasHydrated) return;
    
    isHydratingInProgress.current = true;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/state?email=${encodeURIComponent(targetEmail)}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Session expired on server. Logging out.");
          handleLogout();
          return;
        }
        throw new Error("Sync failed");
      }
      const data = await response.json();
      if (data.success && data.organization) {
        const org = data.organization;
        setOrgId(org.id);
        if (org.users) setUsers(org.users);
        if (org.shifts) setShifts(org.shifts);
        if (org.properties) setProperties(org.properties);
        if (org.clients) setClients(org.clients);
        if (org.invoices) setInvoices(org.invoices);
        if (org.timeEntries) setTimeEntries(org.timeEntries);
        if (org.inventoryItems) setInventoryItems(org.inventoryItems);
        if (org.supplyRequests) setSupplyRequests(org.supplyRequests);
        if (org.anomalyReports) setAnomalyReports(org.anomalyReports);
        if (org.manualTasks) setManualTasks(org.manualTasks);
        if (org.leaveRequests) setLeaveRequests(org.leaveRequests);
        if (org.settings) setOrganization(org.settings);
        setHasHydrated(true);
      }
    } catch (err) {
      console.error("Hydration Error:", err);
    } finally {
      setIsLoading(false);
      isHydratingInProgress.current = false;
    }
  }, [user?.email, hasHydrated, handleLogout]);

  useEffect(() => {
    if (user && !activationToken && !hasHydrated) {
      hydrateState();
    }
  }, [user, hydrateState, activationToken, hasHydrated]);

  const saveAllLocal = useCallback(() => {
    if (!hasHydrated && user) return;

    safeSave('studio_users', users);
    safeSave('studio_shifts', shifts);
    safeSave('studio_props', properties);
    safeSave('studio_clients', clients);
    safeSave('studio_invoices', invoices);
    safeSave('studio_time_entries', timeEntries);
    safeSave('studio_inventory', inventoryItems);
    safeSave('studio_supply_requests', supplyRequests);
    safeSave('studio_anomalies', anomalyReports);
    safeSave('studio_manual_tasks', manualTasks);
    safeSave('studio_leave_requests', leaveRequests);
    safeSave('studio_notifications', notifications);
    localStorage.setItem('studio_active_tab', activeTab);
    safeSave('studio_org_settings', organization);
    if (user) safeSave('current_user_obj', user);
    safeSave('studio_auth_laundry_ids', authorizedLaundryUserIds);
  }, [users, shifts, properties, clients, invoices, timeEntries, activeTab, user, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications, hasHydrated]);

  useEffect(() => {
    if (!user || !hasHydrated) return;
    if (localPersistenceTimeoutRef.current) clearTimeout(localPersistenceTimeoutRef.current);
    localPersistenceTimeoutRef.current = setTimeout(saveAllLocal, 200);
  }, [users, shifts, properties, clients, invoices, timeEntries, organization, manualTasks, leaveRequests, activeTab, notifications, saveAllLocal, user, hasHydrated]);

  useEffect(() => {
    if (!user || !orgId || !hasHydrated || isHydratingInProgress.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { 
              users, shifts, properties, clients, invoices, timeEntries, 
              inventoryItems, supplyRequests, anomalyReports, manualTasks, leaveRequests,
              settings: organization, authorizedLaundryUserIds, notifications 
            }
          })
        });
        if (response.ok) {
           setTimeout(() => setIsSyncing(false), 500);
        }
      } catch (err) { 
        console.error("Cloud Sync error:", err); 
        setIsSyncing(false);
      }
    }, 1500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [user, orgId, hasHydrated, users, shifts, properties, clients, invoices, timeEntries, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications]);

  const handleUpdateUser = (updatedUser: User) => {
    if (user && updatedUser.id === user.id) setUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    const leave = leaveRequests.find(l => l.id === id);
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (leave) {
      const fullNotif: AppNotification = {
        id: `notif-${Date.now()}`,
        title: `Leave ${status.toUpperCase()}`,
        message: `Your request for ${leave.type} has been ${status}.`,
        type: status === 'approved' ? 'success' : 'alert',
        timestamp: Date.now(),
        linkTab: 'settings'
      };
      setNotifications(prev => [fullNotif, ...prev]);
    }
    setToast({ message: `LEAVE REQUEST ${status.toUpperCase()}`, type: status === 'approved' ? 'success' : 'error' });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRequestLeave = (type: LeaveType, start: string, end: string) => {
    if (!user) return;
    const newRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      type,
      startDate: start,
      endDate: end,
      status: 'pending'
    };
    setLeaveRequests(prev => [newRequest, ...prev]);
    setToast({ message: 'LEAVE REQUEST DISPATCHED', type: 'info' });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = (u: User, organizationData?: any) => {
    localStorage.clear();
    setActivationToken(null);
    
    if (organizationData) {
        const org = organizationData;
        setOrgId(org.id);
        if (org.users) setUsers(org.users);
        if (org.shifts) setShifts(org.shifts);
        if (org.properties) setProperties(org.properties);
        if (org.clients) setClients(org.clients);
        if (org.settings) setOrganization(org.settings);
        setHasHydrated(true);
        localStorage.setItem('current_org_id', org.id);
    }
    
    setUser(u);
    localStorage.setItem('current_user_obj', JSON.stringify(u));
    
    if (u.role === 'supervisor') setActiveTab('shifts');
    else if (u.role === 'laundry') setActiveTab('laundry');
    else if (u.role === 'driver') setActiveTab('logistics');
    else setActiveTab('dashboard');
  };

  const handleDemoLogin = (role: UserRole) => {
    const demoUser: User = { 
      id: `demo-${role}`, 
      name: `Demo ${role.toUpperCase()}`, 
      role, 
      email: `${role}@reset.studio`, 
      status: 'active', 
      payRate: 15, 
      paymentType: 'Per Hour', 
      employmentType: 'Full-Time', 
      payslips: [] 
    };
    handleLogin(demoUser, { id: 'demo-org', settings: organization });
  };

  if (!user) {
    return authView === 'login' 
      ? <Login onLogin={handleLogin} onSignupClick={() => setAuthView('signup')} onDemoLogin={handleDemoLogin} />
      : <Signup onSignupComplete={handleLogin} onBackToLogin={() => setAuthView('login')} />;
  }

  return (
    <div className="flex h-[100dvh] bg-[#F0FDFA] overflow-hidden w-full fixed inset-0">
      {isLoading && !hasHydrated ? (
        <div className="flex-1 flex flex-col items-center justify-center py-40 animate-pulse">
           <div className="w-12 h-12 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-teal-600">Synchronizing Session Core...</p>
        </div>
      ) : (
        <Layout 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={user.role} 
          onLogout={handleLogout}
          notificationCount={notifications.length}
          onOpenNotifications={() => setShowActivityCenter(true)}
          isSyncing={isSyncing}
        >
          {activeTab === 'settings' ? (
             <div className="space-y-12 max-w-5xl mx-auto px-1 md:px-4">
                {user.role === 'housekeeping' || user.role === 'admin' ? (
                    <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} />
                ) : null}
                <PersonnelProfile user={user} leaveRequests={leaveRequests} shifts={shifts} properties={properties} onUpdateUser={handleUpdateUser} organization={organization} onRequestLeave={handleRequestLeave} />
             </div>
          ) : activeTab === 'dashboard' ? (
            <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} timeEntries={timeEntries} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
          ) : activeTab === 'properties' ? (
            <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />
          ) : activeTab === 'clients' ? (
            <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />
          ) : activeTab === 'shifts' ? (
            ['admin', 'housekeeping', 'supervisor'].includes(user.role) ? 
                <AdminPortal user={user} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} leaveRequests={leaveRequests} initialSelectedShiftId={selectedAuditShiftId} onConsumedDeepLink={() => setSelectedAuditShiftId(null)} /> :
                <CleanerPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onUpdateUser={handleUpdateUser} initialSelectedShiftId={selectedAuditShiftId} onConsumedDeepLink={() => setSelectedAuditShiftId(null)} />
          ) : activeTab === 'logistics' ? (
            <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} />
          ) : activeTab === 'finance' ? (
            <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={handleUpdateUser} />
          ) : activeTab === 'reports' ? (
            <ReportsPortal users={users} shifts={shifts} userRole={user.role} anomalyReports={anomalyReports} leaveRequests={leaveRequests} />
          ) : activeTab === 'users' ? (
            <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} />
          ) : activeTab === 'inventory_admin' ? (
            <InventoryAdmin inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} shifts={shifts} setShifts={setShifts} showToast={(m, t) => setToast({message: m, type: t as any})} setAnomalyReports={setAnomalyReports} />
          ) : activeTab === 'tutorials' ? (
            <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} showToast={(m, t) => setToast({message: m, type: t as any})} />
          ) : activeTab === 'laundry' ? (
            <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? {...s, isLaundryPrepared: !s.isLaundryPrepared} : s))} authorizedLaundryUserIds={authorizedLaundryUserIds} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />
          ) : null}
        </Layout>
      )}

      {showActivityCenter && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <ActivityCenter notifications={notifications} onClose={() => setShowActivityCenter(false)} onNavigate={(tab) => { setActiveTab(tab); setShowActivityCenter(false); }} />
        </div>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300">
           <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' : toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
