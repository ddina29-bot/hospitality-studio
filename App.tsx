
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
import EmployeeWorksheet from './components/EmployeeWorksheet';
import BuildModeOverlay from './components/BuildModeOverlay';
import Login from './components/Login';
import Signup from './components/Signup';
import UserActivation from './components/UserActivation';
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
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (activationToken) return 'dashboard';
    const saved = localStorage.getItem('studio_active_tab') as TabType;
    return saved || 'dashboard';
  });

  const [activeCleanerShiftId, setActiveCleanerShiftId] = useState<string | null>(() => load('studio_active_cleaner_shift_id', null));
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const isHydratingInProgress = useRef(false);
  const [isBuildMode, setIsBuildMode] = useState(() => load('studio_build_mode', false));
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load('studio_notifications', []));
  const [showActivityCenter, setShowActivityCenter] = useState(false);

  // Core Data State
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
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: '', email: '', phone: '' }));
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>(() => load('studio_auth_laundry_ids', []));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut for Build Mode (Ctrl+B / Cmd+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsBuildMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    safeSave('studio_build_mode', isBuildMode);
  }, [isBuildMode]);

  useEffect(() => {
    safeSave('studio_active_cleaner_shift_id', activeCleanerShiftId);
  }, [activeCleanerShiftId]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const hydrateState = useCallback(async (emailToUse?: string) => {
    const targetEmail = emailToUse || user?.email;
    // Skip remote hydration for the build user or if already done
    if (!targetEmail || targetEmail === 'build@reset.studio' || isHydratingInProgress.current || hasHydrated) {
       if (targetEmail === 'build@reset.studio' || hasHydrated) setHasHydrated(true);
       return;
    }
    
    isHydratingInProgress.current = true;
    setIsLoading(true);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 2500)
    );

    try {
      const fetchPromise = fetch(`/api/state?email=${encodeURIComponent(targetEmail)}`).then(r => r.json());
      const data: any = await Promise.race([fetchPromise, timeoutPromise]);

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
      }
    } catch (err) {
      console.warn("Hydration using local cache.");
    } finally {
      setHasHydrated(true); 
      setIsLoading(false);
      isHydratingInProgress.current = false;
    }
  }, [user?.email, hasHydrated]);

  useEffect(() => {
    if (user && !activationToken && !hasHydrated) hydrateState();
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
  }, [users, shifts, properties, clients, invoices, timeEntries, activeTab, user, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications, hasHydrated]);

  useEffect(() => {
    saveAllLocal();
  }, [saveAllLocal]);

  const triggerManualSync = useCallback(async () => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;
    setIsSyncing(true);
    try {
      await fetch('/api/sync', {
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
      setTimeout(() => setIsSyncing(false), 500);
    } catch (err) { 
      setIsSyncing(false);
    }
  }, [user, orgId, hasHydrated, users, shifts, properties, clients, invoices, timeEntries, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications]);

  useEffect(() => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(triggerManualSync, 2000);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [user, orgId, hasHydrated, users, shifts, properties, clients, invoices, timeEntries, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications, triggerManualSync]);

  const handleLogout = async () => {
    if (orgId && hasHydrated && user?.email !== 'build@reset.studio') {
        setIsSyncing(true);
        try {
          await fetch('/api/sync', {
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
        } catch (e) { console.warn("Final sync failed."); }
    }
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    localStorage.clear();
    setAuthView('login');
  };

  const handleLogin = (u: User, organizationData?: any) => {
    localStorage.clear();
    if (organizationData) {
        setOrgId(organizationData.id);
        setUsers(organizationData.users || []);
        setShifts(organizationData.shifts || []);
        setProperties(organizationData.properties || []);
        setOrganization(organizationData.settings || {});
        setHasHydrated(true);
        localStorage.setItem('current_org_id', organizationData.id);
        localStorage.setItem('current_user_obj', JSON.stringify(u));
    }
    setUser(u);
    if (u.role === 'laundry') setActiveTab('laundry');
    else if (u.role === 'supervisor') setActiveTab('shifts');
    else if (u.role === 'driver') setActiveTab('logistics');
    else setActiveTab('dashboard');
  };

  const handleUpdateUser = (updatedUser: User) => {
    if (user && updatedUser.id === user.id) setUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleSwitchUser = (role: UserRole) => {
    const mockUser: User = user ? { ...user, role } : {
      id: 'build-user-1',
      name: 'STUDIO BUILDER',
      email: 'build@reset.studio',
      role: role,
      status: 'active',
      payslips: []
    };
    
    setUser(mockUser);
    setHasHydrated(true); // satisfy hydration since we are in local-only build mode now
    localStorage.setItem('current_user_obj', JSON.stringify(mockUser));
    
    // Auto-navigate to sensible tab for role
    if (role === 'laundry') setActiveTab('laundry');
    else if (role === 'cleaner') setActiveTab('shifts');
    else if (role === 'driver') setActiveTab('logistics');
    else setActiveTab('dashboard');
    
    showToast(`IMPERSONATING: ${role.toUpperCase()}`, 'info');
  };

  const renderContent = () => {
    if (!user) return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
         <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-4xl mb-2">🛠️</div>
         <h2 className="text-xl font-bold text-slate-900 uppercase">Build Mode Active</h2>
         <p className="text-sm text-slate-500 max-w-sm">Use the console buttons to select an identity and bypass the login wall for rapid testing.</p>
      </div>
    );
    
    if (activeTab === 'shifts' && user.role === 'cleaner') {
      return (
        <CleanerPortal 
           user={user} 
           shifts={shifts} 
           setShifts={setShifts} 
           properties={properties} 
           users={users} 
           inventoryItems={inventoryItems}
           onUpdateUser={handleUpdateUser}
           initialSelectedShiftId={activeCleanerShiftId} 
           onSelectShiftId={setActiveCleanerShiftId}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            users={users} 
            setActiveTab={setActiveTab} 
            shifts={shifts} 
            setShifts={setShifts} 
            properties={properties}
            invoices={invoices} 
            timeEntries={timeEntries} 
            supplyRequests={supplyRequests}
            setSupplyRequests={setSupplyRequests}
            manualTasks={manualTasks}
            setManualTasks={setManualTasks}
            leaveRequests={leaveRequests}
            onLogout={handleLogout} 
            onUpdateUser={handleUpdateUser} 
          />
        );
      case 'shifts':
        return (
          <AdminPortal 
            user={user} 
            view="scheduling" 
            shifts={shifts} 
            setShifts={setShifts} 
            properties={properties} 
            users={users} 
            setActiveTab={setActiveTab} 
            setSelectedClientIdFilter={() => {}} 
            leaveRequests={leaveRequests} 
          />
        );
      case 'worksheet':
        return <EmployeeWorksheet user={user} shifts={shifts} properties={properties} />;
      case 'logistics':
        return <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'laundry':
        return <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? {...s, isLaundryPrepared: !s.isLaundryPrepared} : s))} timeEntries={timeEntries} setTimeEntries={setTimeEntries} organization={organization} />;
      case 'inventory_admin':
        return <InventoryAdmin inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} shifts={shifts} setShifts={setShifts} setAnomalyReports={setAnomalyReports} showToast={showToast} />;
      case 'tutorials':
        return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} showToast={showToast} />;
      case 'properties':
        return <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients':
        return <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance':
        return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={handleUpdateUser} />;
      case 'reports':
        return <ReportsPortal users={users} shifts={shifts} userRole={user.role} anomalyReports={anomalyReports} leaveRequests={leaveRequests} />;
      case 'users':
        return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} />;
      case 'settings':
        return (
          <div className="space-y-8">
            {user.role === 'admin' && <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} />}
            <PersonnelProfile user={user} shifts={shifts} properties={properties} organization={organization} onUpdateUser={handleUpdateUser} />
          </div>
        );
      default:
        return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} onUpdateUser={handleUpdateUser} />;
    }
  };

  if (activationToken && !user) {
    return <UserActivation token={activationToken} onActivationComplete={handleLogin} onCancel={() => setActivationToken(null)} />;
  }

  if (!user && !isBuildMode) {
    return authView === 'login' ? <Login onLogin={handleLogin} /> : <Signup onSignupComplete={handleLogin} onBackToLogin={() => setAuthView('login')} />;
  }

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden">
      {isLoading && !hasHydrated ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-pulse z-[6000]">
           <div className="w-12 h-12 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-6">Synchronizing Personnel Core...</p>
        </div>
      ) : (
        <Layout 
           activeTab={activeTab} 
           setActiveTab={setActiveTab} 
           role={user?.role || 'admin'} 
           onLogout={handleLogout} 
           notificationCount={notifications.length} 
           onOpenNotifications={() => setShowActivityCenter(true)} 
           isSyncing={isSyncing}
           onBuildModeToggle={() => setIsBuildMode(!isBuildMode)}
        >
          {renderContent()}
        </Layout>
      )}

      {isBuildMode && (
        <BuildModeOverlay 
           currentUser={user} 
           onSwitchUser={handleSwitchUser} 
           onToggleTab={setActiveTab} 
           stats={{ users: users.length, properties: properties.length, shifts: shifts.length }} 
           onClose={() => setIsBuildMode(false)} 
        />
      )}

      {showActivityCenter && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <ActivityCenter notifications={notifications} onClose={() => setShowActivityCenter(false)} onNavigate={(tab) => { setActiveTab(tab); setShowActivityCenter(false); }} />
        </div>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300 pointer-events-none">
           <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border pointer-events-auto ${toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' : toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
