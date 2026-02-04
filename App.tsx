
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
import ActivityCenter from './components/ActivityCenter';
import Login from './components/Login';
import UserActivation from './components/UserActivation';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, LeaveType, AppNotification } from './types';

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
  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem('studio_is_demo') === 'true');
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [selectedAuditShiftId, setSelectedAuditShiftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isHydrating = useRef(false);
  const lastLocalUpdate = useRef<number>(0);

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

  // HYDRATION: Fetch data from server on startup
  useEffect(() => {
    const hydrateState = async () => {
      if (!user || isHydrating.current || isDemoMode) return;
      
      // If we just made a local change, wait for that to sync instead of fetching old data
      if (Date.now() - lastLocalUpdate.current < 3000) return;

      isHydrating.current = true;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/state?email=${encodeURIComponent(user.email)}`);
        if (!response.ok) throw new Error("Sync failed");
        const data = await response.json();
        if (data.success && data.organization) {
          const org = data.organization;
          setOrgId(org.id);
          // Only overwrite if we haven't touched the app recently to avoid race conditions
          if (Date.now() - lastLocalUpdate.current > 3000) {
              if (org.users) setUsers(org.users);
              if (org.shifts) setShifts(org.shifts);
              if (org.properties) setProperties(org.properties);
              if (org.clients) setClients(org.clients);
              if (org.invoices) setInvoices(org.invoices);
              if (org.timeEntries) setTimeEntries(org.timeEntries);
              if (org.tutorials) setTutorials(org.tutorials);
              if (org.inventoryItems) setInventoryItems(org.inventoryItems);
              if (org.supplyRequests) setSupplyRequests(org.supplyRequests);
              if (org.anomalyReports) setAnomalyReports(org.anomalyReports);
              if (org.manualTasks) setManualTasks(org.manualTasks);
              if (org.leaveRequests) setLeaveRequests(org.leaveRequests);
              if (org.settings) setOrganization(org.settings);
              if (org.authorizedLaundryUserIds) setAuthorizedLaundryUserIds(org.authorizedLaundryUserIds);
          }
        }
      } catch (err) {
        console.error("Hydration Error:", err);
      } finally {
        setIsLoading(false);
        isHydrating.current = false;
      }
    };
    hydrateState();
  }, [user?.email, isDemoMode]);

  const saveAllLocal = useCallback(() => {
    lastLocalUpdate.current = Date.now();
    safeSave('studio_users', users);
    safeSave('studio_shifts', shifts);
    safeSave('studio_props', properties);
    safeSave('studio_clients', clients);
    safeSave('studio_invoices', invoices);
    safeSave('studio_time_entries', timeEntries);
    safeSave('studio_tutorials', tutorials);
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
  }, [users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, user, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications]);

  // SYNC Logic: Push local state to server
  useEffect(() => {
    if (!user) return;

    if (localPersistenceTimeoutRef.current) clearTimeout(localPersistenceTimeoutRef.current);
    localPersistenceTimeoutRef.current = setTimeout(saveAllLocal, 500); 

    if (!orgId || isHydrating.current || isDemoMode) return;

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
              tutorials, inventoryItems, supplyRequests, anomalyReports, manualTasks, leaveRequests,
              settings: organization, authorizedLaundryUserIds, notifications 
            }
          })
        });
        if (response.ok) {
           setTimeout(() => setIsSyncing(false), 1000); // Keep indicator briefly
        }
      } catch (err) { 
        console.error("Cloud Sync error:", err); 
        setIsSyncing(false);
      }
    }, 1500); // 1.5s debounce for faster saving

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (localPersistenceTimeoutRef.current) clearTimeout(localPersistenceTimeoutRef.current);
    };
  }, [saveAllLocal, user, orgId, isDemoMode, users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications]);

  useEffect(() => {
    const handleUnload = () => saveAllLocal();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [saveAllLocal]);

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
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
    setNotifications(prev => prev.filter(n => n.linkId !== id));
    showToast(`LEAVE REQUEST ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'error');
  };

  const handleLogin = (u: User, organizationData?: any) => {
    setUser(u);
    if (organizationData) {
        setOrgId(organizationData.id);
        if (organizationData.users) setUsers(organizationData.users);
        if (organizationData.shifts) setShifts(organizationData.shifts);
        if (organizationData.properties) setProperties(organizationData.properties);
        if (organizationData.clients) setClients(organizationData.clients);
        if (organizationData.settings) setOrganization(organizationData.settings);
        if (organizationData.manualTasks) setManualTasks(organizationData.manualTasks);
        if (organizationData.leaveRequests) setLeaveRequests(organizationData.leaveRequests);
        if (organizationData.authorizedLaundryUserIds) setAuthorizedLaundryUserIds(organizationData.authorizedLaundryUserIds);
        if (organizationData.notifications) setNotifications(organizationData.notifications);
        if (organizationData.inventoryItems) setInventoryItems(organizationData.inventoryItems);
        if (organizationData.timeEntries) setTimeEntries(organizationData.timeEntries);
    }
    if (u.role === 'supervisor') setActiveTab('shifts');
    else if (u.role === 'laundry') setActiveTab('laundry');
    else setActiveTab('dashboard');
  };

  const handleDemoLogin = (role: UserRole = 'admin') => {
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    
    // DEMO DATA SETUP
    const demoClient: Client = { id: 'c-1', name: 'ELITE HOLIDAYS', contactEmail: 'ops@elite.com', phone: '+356 9900 1122', billingAddress: 'Valletta Waterfront, Malta', status: 'active' };
    
    const demoProperties: Property[] = [
      { id: 'p-1', name: 'SLIEMA PENTHOUSE 7', type: 'Penthouse', clientId: 'c-1', address: 'Tower Road, Sliema, Malta', lat: 35.912, lng: 14.504, keyboxCode: '1234', mainEntranceCode: '9900', accessNotes: 'Keybox behind the AC unit.', rooms: 3, bathrooms: 2, halfBaths: 1, doubleBeds: 2, singleBeds: 2, sofaBeds: 1, pillows: 8, hasBabyCot: true, capacity: 8, hasDishwasher: true, hasCoffeeMachine: true, clientPrice: 150, cleanerPrice: 45, status: 'active', specialRequests: [], entrancePhoto: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80' },
      { id: 'p-2', name: 'VALLETTA HERITAGE LOFT', type: 'Apartment', clientId: 'c-1', address: 'Republic Street, Valletta, Malta', lat: 35.898, lng: 14.512, keyboxCode: '5566', accessNotes: 'Green door next to the cafe.', rooms: 1, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 0, sofaBeds: 0, pillows: 4, capacity: 2, hasDishwasher: false, hasCoffeeMachine: true, clientPrice: 80, cleanerPrice: 25, status: 'active', specialRequests: [], entrancePhoto: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=400&q=80' },
      { id: 'p-3', name: 'ST JULIANS STUDIO 4', type: 'Studio', clientId: 'c-1', address: 'Paceville Ave, St Julians, Malta', lat: 35.923, lng: 14.491, keyboxCode: '7788', accessNotes: 'Level 4, buzzer 14.', rooms: 1, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 0, sofaBeds: 0, pillows: 2, capacity: 2, hasDishwasher: false, hasCoffeeMachine: false, clientPrice: 60, cleanerPrice: 20, status: 'active', specialRequests: [], entrancePhoto: 'https://images.unsplash.com/photo-1536376074432-bf12177d4f4f?auto=format&fit=crop&w=400&q=80' }
    ];

    const demoUsers: User[] = [
      { id: 'u-1', name: 'John Doe', role: 'admin', email: 'admin@reset.studio', status: 'active' },
      { id: 'u-2', name: 'Sarah Clean', role: 'cleaner', email: 'sarah@reset.studio', status: 'active', phone: '+356 7700 8899' },
      { id: 'u-3', name: 'Dave Driver', role: 'driver', email: 'dave@reset.studio', status: 'active', phone: '+356 9944 5566' },
      { id: 'u-4', name: 'Laura Laundry', role: 'laundry', email: 'laura@reset.studio', status: 'active' }
    ];

    const currentDemoUserId = role === 'admin' ? 'u-1' : role === 'cleaner' ? 'u-2' : role === 'driver' ? 'u-3' : 'u-4';
    const activeDemoUser = demoUsers.find(u => u.id === currentDemoUserId)!;

    const demoShifts: Shift[] = [
      { id: 's-1', propertyId: 'p-1', propertyName: 'SLIEMA PENTHOUSE 7', userIds: ['u-2'], date: todayStr, startTime: '10:00 AM', endTime: '02:00 PM', serviceType: 'Check out/check in', status: 'active', actualStartTime: Date.now() - 3600000, approvalStatus: 'pending', isPublished: true },
      { id: 's-2', propertyId: 'p-2', propertyName: 'VALLETTA HERITAGE LOFT', userIds: ['u-2'], date: todayStr, startTime: '02:30 PM', endTime: '04:30 PM', serviceType: 'Check out/check in', status: 'pending', approvalStatus: 'pending', isPublished: true },
      { id: 's-3', propertyId: 'p-3', propertyName: 'ST JULIANS STUDIO 4', userIds: ['u-2'], date: todayStr, startTime: '09:00 AM', endTime: '11:00 AM', serviceType: 'TO CHECK APARTMENT', status: 'completed', actualStartTime: Date.now() - 20000000, actualEndTime: Date.now() - 15000000, approvalStatus: 'pending', isPublished: true },
      { id: 's-4', propertyId: 'p-1', propertyName: 'SUPPLY DROP: SARAH CLEAN', userIds: ['u-3'], date: todayStr, startTime: '08:00 AM', endTime: '06:00 PM', serviceType: 'SUPPLY DELIVERY', status: 'pending', approvalStatus: 'pending', isPublished: true, notes: '2x Double Sheet, 4x Pillow Case, 10x Welcome Pack' }
    ];

    const demoInventory: SupplyItem[] = [
        { id: 'inv-1', name: 'DOUBLE SHEET', unit: 'PIECE', category: 'linen', type: 'laundry', explanation: 'Ensure ironed and folded properly.', photo: 'https://images.unsplash.com/photo-1629910276241-98c4d14322a3?auto=format&fit=crop&w=300&q=80' },
        { id: 'inv-2', name: 'WINDOW CLEANER (SPRAY)', unit: '750ML BOTTLE', category: 'spray', type: 'cleaning', explanation: 'Use only on glass surfaces.', photo: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80' }
    ];

    setIsDemoMode(true);
    localStorage.setItem('studio_is_demo', 'true');
    handleLogin(activeDemoUser, { 
        id: 'demo-org', 
        users: demoUsers,
        properties: demoProperties,
        shifts: demoShifts,
        clients: [demoClient],
        inventoryItems: demoInventory,
        settings: { id: 'demo-org', name: 'DEMO STUDIO', address: '123 Demo St, Valletta', email: 'demo@reset.studio', phone: '+356 000 000' } 
    });
    
    showToast(`LOGGED IN AS ${role.toUpperCase()}`, 'success');
  };

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    setIsDemoMode(false);
    localStorage.clear();
  };

  const onToggleLaundryPrepared = (shiftId: string) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s));
    showToast('LINEN PREPARATION STATUS UPDATED', 'success');
  };

  const renderContent = () => {
    if (!user) return null;
    if (activeTab === 'settings') {
      return (
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
        }} onUpdateUser={handleUpdateUser} initialSelectedShiftId={selectedAuditShiftId} onConsumedDeepLink={handleConsumedAuditDeepLink} />;
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
      case 'users': return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
      case 'reports': return <ReportsPortal auditReports={[]} users={users} shifts={shifts} userRole={currentRole} anomalyReports={anomalyReports} leaveRequests={leaveRequests} />;
      default: return null;
    }
  };

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} onDemoLogin={handleDemoLogin} />;

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden">
      {isLoading && shifts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-40 animate-pulse">
           <div className="w-12 h-12 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-teal-600">Synchronizing Session Core...</p>
        </div>
      ) : (
        <Layout 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentRole} 
          onLogout={handleLogout}
          notificationCount={notifications.length}
          onOpenNotifications={() => setShowActivityCenter(true)}
        >
          {isSyncing && (
             <div className="fixed top-4 right-10 z-[5000] animate-in slide-in-from-top-2">
                <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-full border border-teal-500/30 flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></div>
                   <span className="text-[7px] font-black uppercase tracking-widest">Cloud Syncing</span>
                </div>
             </div>
          )}
          {renderContent()}
        </Layout>
      )}

      {isDemoMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[3000] bg-slate-900 border border-teal-500/30 p-2 rounded-2xl flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-2">
           <div className="px-3 border-r border-slate-700">
              <p className="text-[7px] font-black text-teal-400 uppercase tracking-widest">Previewing</p>
              <p className="text-[9px] font-bold text-white uppercase">{user.role}</p>
           </div>
           <div className="flex gap-1">
              {[{ r: 'admin', i: '💼' }, { r: 'cleaner', i: '🧹' }, { r: 'driver', i: '🚚' }, { r: 'laundry', i: '🧺' }].map(item => (
                <button key={item.r} onClick={() => handleDemoLogin(item.r as UserRole)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${user.role === item.r ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{item.i}</button>
              ))}
           </div>
        </div>
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
