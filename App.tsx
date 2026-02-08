
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import EmployeeWorksheet from './components/EmployeeWorksheet';
import BuildModeOverlay from './components/BuildModeOverlay';
import Login from './components/Login';
import Signup from './components/Signup';
import UserActivation from './components/UserActivation';
import ActivityCenter from './components/ActivityCenter';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, AppNotification } from './types';

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
    console.warn(`Storage limit reached for ${key}`);
  }
};

const App: React.FC = () => {
  const [activationToken, setActivationToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('code');
  });

  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isBuildMode, setIsBuildMode] = useState(() => load('studio_build_mode', false));
  const [showActivityCenter, setShowActivityCenter] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const [users, setUsers] = useState<User[]>(() => load('studio_users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => load('studio_shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => load('studio_props', []));
  const [clients, setClients] = useState<Client[]>(() => load('studio_clients', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('studio_invoices', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('studio_time_entries', []));
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => load('studio_inventory', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => load('studio_supply_requests', []));
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => load('studio_manual_tasks', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => load('studio_leave_requests', []));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load('studio_notifications', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: '', email: '', phone: '' }));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateState = useCallback(async (email: string) => {
    if (!email || email === 'build@reset.studio') return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/state?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success && data.organization) {
        const org = data.organization;
        setOrgId(org.id);
        if (org.users) setUsers(org.users);
        if (org.shifts) setShifts(org.shifts);
        if (org.properties) setProperties(org.properties);
        if (org.clients) setClients(org.clients);
        if (org.invoices) setInvoices(org.invoices);
        if (org.settings) setOrganization(org.settings);
        if (org.manualTasks) setManualTasks(org.manualTasks);
        if (org.leaveRequests) setLeaveRequests(org.leaveRequests);
        if (org.inventoryItems) setInventoryItems(org.inventoryItems);
        if (org.timeEntries) setTimeEntries(org.timeEntries);
        localStorage.setItem('current_org_id', org.id);
        setHasHydrated(true);
      }
    } catch (err) {
      console.warn("Hydration failed, using local fallback.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !hasHydrated && !activationToken) {
      hydrateState(user.email);
    }
  }, [user, hydrateState, hasHydrated, activationToken]);

  // Persistent Active Tab
  useEffect(() => {
    localStorage.setItem('studio_active_tab', activeTab);
  }, [activeTab]);

  // Global Sync Logic - DEBOUNCED
  useEffect(() => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      // DATA INTEGRITY GUARD: Ensure we don't accidentally wipe data with an empty sync
      if (shifts.length === 0 && load('studio_shifts', []).length > 0) return;

      setIsSyncing(true);
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, settings: organization, notifications }
          })
        });
        // Update local backups
        safeSave('studio_users', users);
        safeSave('studio_shifts', shifts);
        safeSave('studio_props', properties);
        safeSave('studio_clients', clients);
        safeSave('studio_invoices', invoices);
        safeSave('studio_time_entries', timeEntries);
        safeSave('studio_inventory', inventoryItems);
        safeSave('studio_supply_requests', supplyRequests);
        safeSave('studio_manual_tasks', manualTasks);
        safeSave('studio_leave_requests', leaveRequests);
        safeSave('studio_org_settings', organization);
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
    }, 1500); // Faster sync debounce

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, organization, notifications, user, orgId, hasHydrated]);

  const handleLogin = (u: User, organizationData?: any) => {
    // DO NOT clear all localStorage here, only session-specific ones
    localStorage.removeItem('current_user_obj');
    localStorage.removeItem('cleaner_active_shift_id');
    
    if (organizationData) {
      setOrgId(organizationData.id);
      localStorage.setItem('current_org_id', organizationData.id);
      setUsers(organizationData.users || []);
      setClients(organizationData.clients || []);
      setProperties(organizationData.properties || []);
      setShifts(organizationData.shifts || []);
      setOrganization(organizationData.settings || organization);
      setHasHydrated(true);
    }

    setUser(u);
    safeSave('current_user_obj', u);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActiveTab('dashboard');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (activationToken && !user) {
    return <UserActivation token={activationToken} onActivationComplete={handleLogin} onCancel={() => setActivationToken(null)} />;
  }

  if (!user && !isBuildMode) {
    return <Login onLogin={handleLogin} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user!} users={users} setActiveTab={setActiveTab} shifts={shifts} properties={properties} invoices={invoices} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateUser={setUser} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(user!.role)) return <AdminPortal user={user!} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
        return <CleanerPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onAddSupplyRequest={() => {}} onUpdateUser={setUser} />;
      case 'logistics': return <DriverPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'laundry': return <LaundryDashboard user={user!} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} onTogglePrepared={() => {}} timeEntries={timeEntries} setTimeEntries={setTimeEntries} organization={organization} />;
      case 'properties': return <AdminPortal user={user!} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients': return <AdminPortal user={user!} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
      case 'users': return <AdminPortal user={user!} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} />;
      case 'settings': return <div className="max-w-5xl mx-auto py-10"><StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} /></div>;
      case 'worksheet': return <EmployeeWorksheet user={user!} shifts={shifts} properties={properties} />;
      default: return <div className="p-20 text-center opacity-20 uppercase font-black tracking-widest">Module Under Construction</div>;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      role={user?.role || 'admin'} 
      onLogout={handleLogout}
      isSyncing={isSyncing}
      notificationCount={notifications.length}
      onOpenNotifications={() => setShowActivityCenter(true)}
    >
      {renderTab()}
      {showActivityCenter && <ActivityCenter notifications={notifications} onClose={() => setShowActivityCenter(false)} onNavigate={setActiveTab} />}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
          <div className={`px-8 py-3 rounded-2xl shadow-2xl text-white font-black uppercase text-[10px] tracking-widest ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'success' ? 'bg-teal-600' : 'bg-slate-900'}`}>
            {toast.message}
          </div>
        </div>
      )}
      {isBuildMode && <BuildModeOverlay currentUser={user} onSwitchUser={(role) => handleLogin({ ...user!, role } as User)} onToggleTab={setActiveTab} stats={{ users: users.length, properties: properties.length, shifts: shifts.length }} onClose={() => setIsBuildMode(false)} />}
    </Layout>
  );
};

export default App;
