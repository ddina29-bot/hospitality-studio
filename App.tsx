
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
  
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [selectedAuditShiftId, setSelectedAuditShiftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [hasHydrated, setHasHydrated] = useState(false);
  const isHydratingInProgress = useRef(false);

  const [isBuildMode, setIsBuildMode] = useState(() => load('studio_build_mode', false));

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
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: '', email: '', phone: '' }));
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>(() => load('studio_auth_laundry_ids', []));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPersistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRole = user?.role || 'admin';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        const next = !isBuildMode;
        setIsBuildMode(next);
        safeSave('studio_build_mode', next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBuildMode]);

  const handleBuildModeRoleSwitch = (role: UserRole) => {
    const buildUserId = `build-${role}`;
    
    const dummyUser: User = {
      id: buildUserId,
      name: `BUILD_${role.toUpperCase()}`,
      email: `build@reset.studio`,
      role: role,
      status: 'active',
      payRate: role === 'supervisor' ? 15 : 10,
      paymentType: 'Per Hour'
    };
    
    let activeProps = [...properties];
    if (activeProps.length === 0) {
      activeProps = [
        { id: 'p1', name: 'Valletta Heritage Loft', type: 'Apartment', clientId: 'c1', address: '12 Old Bakery St, Valletta', rooms: 2, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 2, sofaBeds: 0, pillows: 6, capacity: 4, hasDishwasher: true, hasCoffeeMachine: true, entrancePhoto: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', keyboxCode: '1234', mainEntranceCode: '9999', accessNotes: 'Keybox on left rail.', status: 'active', specialRequests: [], clientPrice: 120, cleanerPrice: 45 },
        { id: 'p2', name: 'Sliema Seafront', type: 'Penthouse', clientId: 'c1', address: 'Tower Road, Sliema', rooms: 3, bathrooms: 2, halfBaths: 1, doubleBeds: 2, singleBeds: 2, sofaBeds: 1, pillows: 10, capacity: 7, hasDishwasher: true, hasCoffeeMachine: true, entrancePhoto: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80', keyboxCode: '5678', status: 'active', specialRequests: [], clientPrice: 180, cleanerPrice: 70 }
      ];
      setProperties(activeProps);
    }

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    const demoShifts: Shift[] = [];
    
    if (role === 'supervisor') {
      demoShifts.push({
        id: 'demo-sup-audit',
        propertyId: activeProps[0].id,
        propertyName: activeProps[0].name,
        userIds: [buildUserId],
        date: today,
        startTime: '09:00 AM',
        endTime: '10:30 AM',
        serviceType: 'TO CHECK APARTMENT',
        status: 'pending',
        approvalStatus: 'pending',
        isPublished: true
      });
    }

    if (role === 'cleaner') {
      demoShifts.push({
        id: 'demo-cl-refresh',
        propertyId: activeProps[0].id,
        propertyName: activeProps[0].name,
        userIds: [buildUserId],
        date: today,
        startTime: '08:00 AM',
        endTime: '09:30 AM',
        serviceType: 'REFRESH',
        status: 'pending',
        approvalStatus: 'pending',
        isPublished: true
      });
    }

    setShifts(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const filteredDemos = demoShifts.filter(ds => !existingIds.has(ds.id));
        return [...filteredDemos, ...prev];
    });

    setUser(dummyUser);
    
    // REDIRECTION: For Laundry role, land directly on Laundry page.
    if (role === 'laundry') {
      setActiveTab('laundry');
    } else if (role === 'supervisor') {
      setActiveTab('shifts');
    } else if (role === 'driver') {
      setActiveTab('logistics');
    } else {
      setActiveTab('dashboard');
    }

    setHasHydrated(true); 
    showToast(`Build: Switched to ${role.toUpperCase()}.`, 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAuditDeepLink = (id: string) => {
    setSelectedAuditShiftId(id);
    setActiveTab('shifts');
  };

  const handleConsumedAuditDeepLink = () => {
    setSelectedAuditShiftId(null);
  };

  const addNotification = (notif: Partial<AppNotification>) => {
    const fullNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: notif.title || 'Notification',
      message: notif.message || '',
      type: notif.type || 'info',
      timestamp: Date.now(),
      linkTab: notif.linkTab,
      linkId: notif.linkId
    };
    setNotifications(prev => [fullNotif, ...prev]);
  };

  const hydrateState = useCallback(async (emailToUse?: string) => {
    const targetEmail = emailToUse || user?.email;
    
    if (!targetEmail || targetEmail === 'build@reset.studio' || isHydratingInProgress.current || hasHydrated) {
       if (targetEmail === 'build@reset.studio' || hasHydrated) setHasHydrated(true);
       return;
    }
    
    isHydratingInProgress.current = true;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/state?email=${encodeURIComponent(targetEmail)}`);
      if (!response.ok) {
         setHasHydrated(true); 
         return;
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
      }
    } catch (err) {
      console.warn("Hydration skipped: using local state.");
    } finally {
      setHasHydrated(true); 
      setIsLoading(false);
      isHydratingInProgress.current = false;
    }
  }, [user?.email, hasHydrated]);

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
    safeSave('studio_build_mode', isBuildMode);
    localStorage.setItem('studio_active_tab', activeTab);
    safeSave('studio_org_settings', organization);
    if (user) safeSave('current_user_obj', user);
    safeSave('studio_auth_laundry_ids', authorizedLaundryUserIds);
  }, [users, shifts, properties, clients, invoices, timeEntries, activeTab, user, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications, hasHydrated, isBuildMode]);

  useEffect(() => {
    if (!user || !hasHydrated) return;
    if (localPersistenceTimeoutRef.current) clearTimeout(localPersistenceTimeoutRef.current);
    localPersistenceTimeoutRef.current = setTimeout(saveAllLocal, 200);
  }, [users, shifts, properties, clients, invoices, timeEntries, organization, manualTasks, leaveRequests, activeTab, notifications, saveAllLocal, user, hasHydrated, isBuildMode]);

  useEffect(() => {
    if (!user || !orgId || !hasHydrated || isHydratingInProgress.current || user.email === 'build@reset.studio') return;

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
      addNotification({
        title: `Leave ${status.toUpperCase()}`,
        message: `Your request for ${leave.type} has been ${status}.`,
        type: status === 'approved' ? 'success' : 'alert',
        linkTab: 'settings'
      });
    }
    showToast(`LEAVE REQUEST ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'error');
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
        if (org.manualTasks) setManualTasks(org.manualTasks);
        if (org.leaveRequests) setLeaveRequests(org.leaveRequests);
        if (org.inventoryItems) setInventoryItems(org.inventoryItems);
        if (org.timeEntries) setTimeEntries(org.timeEntries);
        
        setHasHydrated(true);
        localStorage.setItem('current_org_id', org.id);
        localStorage.setItem('current_user_obj', JSON.stringify(u));
    }
    
    setUser(u);
    
    // REDIRECTION: Logic for role-based landing page
    if (u.role === 'laundry') setActiveTab('laundry');
    else if (u.role === 'supervisor') setActiveTab('shifts');
    else if (u.role === 'driver') setActiveTab('logistics');
    else setActiveTab('dashboard');
    
    if (window.location.search) {
       window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActivationToken(null);
    localStorage.clear();
    setAuthView('login');
  };

  const onToggleLaundryPrepared = (shiftId: string) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s));
    showToast('LINEN PREPARATION STATUS UPDATED', 'success');
  };

  if (activationToken && !user) {
    return (
      <UserActivation 
        token={activationToken} 
        onActivationComplete={(activatedUser, orgData) => handleLogin(activatedUser, orgData)} 
        onCancel={() => {
            setActivationToken(null);
            window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  const renderContent = () => {
    if (!user) return null;
    if (activeTab === 'settings') {
      return (
        <div className="space-y-12 max-w-5xl mx-auto px-1 md:px-4">
          {user.role === 'admin' && (
            <section className="space-y-6">
              <StudioSettings 
                organization={organization} 
                setOrganization={setOrganization} 
                userCount={users.length} 
                propertyCount={properties.length} 
                currentOrgId={orgId} 
              />
              <div className="h-px bg-slate-200 w-full opacity-50"></div>
            </section>
          )}
          <PersonnelProfile 
            user={user} 
            leaveRequests={leaveRequests} 
            onRequestLeave={(type, start, end) => {
               const leaveId = `leave-${Date.now()}`;
               setLeaveRequests(prev => [...prev, { id: leaveId, userId: user.id, userName: user.name, type, startDate: start, endDate: end, status: 'pending' }]);
               addNotification({ title: 'New Leave Request', message: `${user.name} requested ${type}`, type: 'info', linkTab: 'dashboard', linkId: leaveId });
               showToast('LEAVE REQUEST SUBMITTED', 'info');
            }} 
            shifts={shifts} 
            properties={properties} 
            onUpdateUser={handleUpdateUser} 
            organization={organization}
          />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return (
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
          onUpdateLeaveStatus={handleUpdateLeaveStatus}
          onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} 
          onAuditDeepLink={handleAuditDeepLink}
          onLogout={handleLogout} 
          onUpdateUser={handleUpdateUser} 
        />
      );
      case 'worksheet': return <EmployeeWorksheet user={user} shifts={shifts} properties={properties} />;
      case 'properties': return <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients': return <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(currentRole)) return <AdminPortal user={user} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} leaveRequests={leaveRequests} initialSelectedShiftId={selectedAuditShiftId} onConsumedDeepLink={handleConsumedAuditDeepLink} />;
        return <CleanerPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onAddSupplyRequest={(batch) => {
            const now = Date.now();
            const newRequests: SupplyRequest[] = Object.entries(batch).map(([itemId, qty]) => ({
                id: `sr-${now}-${itemId}`, itemId, itemName: inventoryItems.find(i => i.id === itemId)?.name || 'Unknown', quantity: qty as number, userId: user.id, userName: user.name, date: new Date().toISOString().split('T')[0], status: 'pending'
            }));
            setSupplyRequests(prev => [...prev, ...newRequests]);
            handleUpdateUser({ ...user, lastSupplyRequestDate: now });
        }} onUpdateUser={handleUpdateUser} initialSelectedShiftId={selectedAuditShiftId} onConsumedDeepLink={handleConsumedAuditDeepLink} isBuildMode={isBuildMode} />;
      case 'logistics': return <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
      case 'laundry': return (
        <LaundryDashboard 
          user={user} 
          setActiveTab={setActiveTab} 
          onLogout={handleLogout} 
          shifts={shifts} 
          setShifts={setShifts} 
          users={users} 
          properties={properties} 
          onTogglePrepared={onToggleLaundryPrepared}
          authorizedLaundryUserIds={authorizedLaundryUserIds}
          onToggleAuthority={(uid) => setAuthorizedLaundryUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])}
          timeEntries={timeEntries}
          setTimeEntries={setTimeEntries}
        />
      );
      case 'inventory_admin': return (
        <InventoryAdmin 
          inventoryItems={inventoryItems} 
          setInventoryItems={setInventoryItems} 
          supplyRequests={supplyRequests} 
          setSupplyRequests={setSupplyRequests} 
          shifts={shifts} 
          setShifts={setShifts} 
          showToast={showToast}
          setAnomalyReports={setAnomalyReports}
        />
      );
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={currentRole} showToast={showToast} />;
      case 'users': return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={handleUpdateUser} />;
      case 'reports': return <ReportsPortal auditReports={[]} users={users} shifts={shifts} userRole={currentRole} anomalyReports={anomalyReports} leaveRequests={leaveRequests} />;
      default: return null;
    }
  };

  if (!user && !isBuildMode) {
    return authView === 'login' 
      ? <Login onLogin={handleLogin} />
      : <Signup onSignupComplete={handleLogin} onBackToLogin={() => setAuthView('login')} />;
  }

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden">
      {isLoading && !hasHydrated ? (
        <div className="flex-1 flex flex-col items-center justify-center py-40 animate-pulse">
           <div className="w-12 h-12 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-6">Synchronizing Session Core...</p>
        </div>
      ) : (
        <Layout 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentRole} 
          onLogout={handleLogout}
          notificationCount={notifications.length}
          onOpenNotifications={() => setShowActivityCenter(true)}
          isSyncing={isSyncing}
          onBuildModeToggle={() => {
             const next = !isBuildMode;
             setIsBuildMode(next);
             safeSave('studio_build_mode', next);
          }}
        >
          {renderContent()}
        </Layout>
      )}

      {isBuildMode && (
        <BuildModeOverlay 
           currentUser={user}
           onSwitchUser={handleBuildModeRoleSwitch}
           onToggleTab={setActiveTab}
           onClose={() => {
              setIsBuildMode(false);
              safeSave('studio_build_mode', false);
           }}
           stats={{
              users: users.length,
              properties: properties.length,
              shifts: shifts.length
           }}
        />
      )}

      {showActivityCenter && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <ActivityCenter 
            notifications={notifications} 
            onClose={() => setShowActivityCenter(false)} 
            onNavigate={(tab) => { setActiveTab(tab); setShowActivityCenter(false); }}
          />
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
