
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPortal from './components/AdminPortal';
import CleanerPortal from './components/CleanerPortal';
import DriverPortal from './components/DriverPortal';
import TutorialsHub from './components/TutorialsHub';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import ReportsPortal from './components/ReportsPortal';
import PersonnelProfile from './components/PersonnelProfile';
import EmployeeWorksheet from './components/EmployeeWorksheet';
import Login from './components/Login';
import UserActivation from './components/UserActivation';
import ActivityCenter from './components/ActivityCenter';
import BuildModeOverlay from './components/BuildModeOverlay';
// Fix: Added missing import for InteractiveFeed to resolve 'Cannot find name' error
import InteractiveFeed from './components/InteractiveFeed';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, ManualTask, LeaveRequest, AppNotification, LeaveType, FeedItem } from './types';

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
  
  const [deepLinkShiftId, setDeepLinkShiftId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showActivityCenter, setShowActivityCenter] = useState(false);
  const [showBuildConsole, setShowBuildConsole] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' | 'alert', id: number } | null>(null);

  // DATA STATE
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
  const [feedItems, setFeedItems] = useState<FeedItem[]>(() => load('studio_feed', []));
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => load('studio_tutorials', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: 'Central Operations HQ', email: 'ops@reset.studio', phone: '+356 9900 1122' }));
  
  const processedEventIds = useRef<Set<string>>(new Set());

  // --- SEED DEMO DATA FOR AI VISIBILITY ---
  useEffect(() => {
    if (users.length === 0) {
      // 1. Seed Staff
      const seedUsers: User[] = [
        { id: 'u-1', name: 'Marco Cleaner', role: 'cleaner', email: 'marco@reset.studio', status: 'active', payRate: 7, paymentType: 'Per Clean' },
        { id: 'u-2', name: 'Sarah Supervisor', role: 'supervisor', email: 'sarah@reset.studio', status: 'active', payRate: 9, paymentType: 'Per Hour' },
        { id: 'u-3', name: 'Dave Driver', role: 'driver', email: 'dave@reset.studio', status: 'active', payRate: 8, paymentType: 'Per Hour' }
      ];
      setUsers(seedUsers);

      // 2. Seed Properties
      const seedProps: Property[] = [
        { 
          id: 'p-1', name: 'Sliema Seafront Penthouse', type: 'Penthouse', clientId: 'c-1', address: 'Tower Road, Sliema', 
          status: 'active', keyboxCode: '5566', rooms: 3, bathrooms: 2, doubleBeds: 2, singleBeds: 2, capacity: 6,
          entrancePhoto: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800',
          accessNotes: 'Balcony door has a special double-lock mechanism.', pillows: 8, halfBaths: 0, sofaBeds: 0, hasDishwasher: true, hasCoffeeMachine: true, clientPrice: 150, cleanerPrice: 45, specialRequests: []
        },
        { 
          id: 'p-2', name: 'Valletta Heritage Loft', type: 'Apartment', clientId: 'c-1', address: 'Merchant St, Valletta', 
          status: 'active', keyboxCode: '1212', rooms: 1, bathrooms: 1, doubleBeds: 1, singleBeds: 0, capacity: 2,
          entrancePhoto: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800',
          accessNotes: 'Master switch is located behind the entrance painting.', pillows: 4, halfBaths: 0, sofaBeds: 1, hasDishwasher: false, hasCoffeeMachine: true, clientPrice: 100, cleanerPrice: 35, specialRequests: []
        },
        { 
          id: 'p-3', name: 'St. Julians Modern Studio', type: 'Studio', clientId: 'c-2', address: 'Spinola Bay, St. Julians', 
          status: 'active', keyboxCode: '9988', rooms: 0, bathrooms: 1, doubleBeds: 1, singleBeds: 0, capacity: 2,
          entrancePhoto: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800',
          accessNotes: 'Keybox is on the left side of the black gate.', pillows: 2, halfBaths: 0, sofaBeds: 0, hasDishwasher: false, hasCoffeeMachine: true, clientPrice: 80, cleanerPrice: 25, specialRequests: []
        }
      ];
      setProperties(seedProps);

      // 3. Seed Shifts (Populated for Marco)
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
      const seedShifts: Shift[] = [
        // 08:00 AM - Completed successfully
        { 
          id: 's-1', propertyId: 'p-3', propertyName: 'St. Julians Modern Studio', userIds: ['u-1'], date: today, startTime: '08:00 AM', 
          serviceType: 'Check out/check in', status: 'completed', approvalStatus: 'approved', isPublished: true,
          actualStartTime: Date.now() - 28800000, actualEndTime: Date.now() - 21600000, decidedBy: 'AI Auditor'
        },
        // 10:00 AM - Reported issues (Forces report visibility)
        { 
          id: 's-2', propertyId: 'p-2', propertyName: 'Valletta Heritage Loft', userIds: ['u-1'], date: today, startTime: '10:00 AM', 
          serviceType: 'Check out/check in', status: 'completed', approvalStatus: 'rejected', isPublished: true,
          actualStartTime: Date.now() - 18000000, actualEndTime: Date.now() - 10800000, 
          approvalComment: 'Linen found with stains in master bedroom. Remedial required.', wasRejected: true
        },
        // 01:00 PM - LIVE/ACTIVE Shift
        { 
          id: 's-3', propertyId: 'p-1', propertyName: 'Sliema Seafront Penthouse', userIds: ['u-1'], date: today, startTime: '01:00 PM', 
          serviceType: 'Check out/check in', status: 'active', approvalStatus: 'pending', isPublished: true,
          actualStartTime: Date.now() - 3600000
        },
        // 04:00 PM - Pending
        { 
          id: 's-4', propertyId: 'p-3', propertyName: 'St. Julians Modern Studio', userIds: ['u-1'], date: today, startTime: '04:00 PM', 
          serviceType: 'REFRESH', status: 'pending', approvalStatus: 'pending', isPublished: true
        },
        // 06:00 PM - Pending
        { 
          id: 's-5', propertyId: 'p-1', propertyName: 'Sliema Seafront Penthouse', userIds: ['u-1'], date: today, startTime: '06:00 PM', 
          serviceType: 'Common Area', status: 'pending', approvalStatus: 'pending', isPublished: true
        }
      ];
      setShifts(seedShifts);

      // 4. Seed Supply Requests
      const seedSupplies: SupplyRequest[] = [
        { id: 'sr-1', itemId: 'i-1', itemName: 'All-Purpose Spray', quantity: 3, userId: 'u-1', userName: 'Marco Cleaner', date: today, status: 'pending' }
      ];
      setSupplyRequests(seedSupplies);
      
      // 5. Seed Feed Items (Manual Pulse example)
      const seedFeed: FeedItem[] = [
        { id: 'f-1', userId: 'admin-1', userName: 'Studio HQ', type: 'update', title: 'Operational Update', content: 'Linen delivery for Sliema sector is running 20 mins behind schedule. Please adjust start times accordingly.', timestamp: Date.now() - 1800000, likes: [] },
        { id: 'f-2', userId: 'admin-1', userName: 'Studio HQ', type: 'milestone', title: 'Quality Alert', content: 'Fantastic job by the Valletta team this morning! All audits passed with 100% scores.', timestamp: Date.now() - 7200000, likes: ['u-1'] }
      ];
      setFeedItems(seedFeed);

      setHasHydrated(true);
    }
  }, [users.length]);

  const triggerAlert = useCallback((title: string, message: string, type: AppNotification['type'] = 'info', linkTab?: TabType, linkId?: string, imageUrl?: string) => {
    const newId = `notif-${Date.now()}`;
    const newNotif: AppNotification = { id: newId, title, message, type, timestamp: Date.now(), linkTab, linkId, imageUrl };
    setNotifications(prev => [newNotif, ...prev].slice(0, 100));
    showToast(message, type);
  }, []);

  const handlePostFeedItem = (post: Partial<FeedItem>) => {
    const newItem: FeedItem = {
      id: `f-${Date.now()}`,
      userId: user?.id || 'sys',
      userName: user?.name || 'Studio Ops',
      likes: [],
      ...post
    } as FeedItem;
    setFeedItems(prev => [newItem, ...prev]);
  };

  const handleLikeFeedItem = (id: string) => {
    if (!user) return;
    setFeedItems(prev => prev.map(item => {
      if (item.id === id) {
        const hasLiked = item.likes.includes(user.id);
        return {
          ...item,
          likes: hasLiked ? item.likes.filter(uid => uid !== user.id) : [...item.likes, user.id]
        };
      }
      return item;
    }));
  };

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
        if (org.notifications) setNotifications(org.notifications);
        if (org.feedItems) setFeedItems(org.feedItems);
        if (org.tutorials) setTutorials(org.tutorials);
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

  // Sync Logic
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, settings: organization, notifications, feedItems, tutorials }
          })
        });
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
        safeSave('studio_notifications', notifications);
        safeSave('studio_feed', feedItems);
        safeSave('studio_tutorials', tutorials);
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
    }, 1500);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, organization, notifications, user, orgId, hasHydrated, feedItems, tutorials]);

  const handleLogin = (u: User, organizationData?: any) => {
    if (organizationData) {
      setOrgId(organizationData.id);
      localStorage.setItem('current_org_id', organizationData.id);
      setUsers(organizationData.users || []);
      setClients(organizationData.clients || []);
      setProperties(organizationData.properties || []);
      setShifts(organizationData.shifts || []);
      setOrganization(organizationData.settings || organization);
      setNotifications(organizationData.notifications || []);
      setFeedItems(organizationData.feedItems || []);
      setTutorials(organizationData.tutorials || []);
      setHasHydrated(true);
    }
    setUser(u);
    safeSave('current_user_obj', u);
    setActiveTab('dashboard');
    triggerAlert('Session Initialized', `Welcome back, ${u.name.split(' ')[0]}.`, 'success');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActiveTab('dashboard');
  };

  const handleImpersonate = (role: UserRole) => {
    const mockUser: User = { id: `mock-${role}`, name: `Studio ${role}`, email: 'build@reset.studio', role, status: 'active' };
    setUser(mockUser);
    setOrgId('org-build');
    setHasHydrated(true);
    setShowBuildConsole(false);
    setActiveTab('dashboard');
    showToast(`SWITCHED TO ${role.toUpperCase()} MODE`, 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' | 'alert') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 4500);
  };

  if (activationToken && !user) {
    return <UserActivation token={activationToken} onActivationComplete={handleLogin} onCancel={() => setActivationToken(null)} />;
  }

  const renderTab = () => {
    if (!user) return <Login onLogin={handleLogin} onOpenConsole={() => setShowBuildConsole(true)} />;
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateUser={setUser} feedItems={feedItems} onLikeFeedItem={handleLikeFeedItem} onPostFeedItem={handlePostFeedItem} />;
      case 'shifts': 
        if (['admin', 'hr', 'housekeeping'].includes(user.role)) return <AdminPortal user={user} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} leaveRequests={leaveRequests} initialSelectedShiftId={deepLinkShiftId} onConsumedDeepLink={() => setDeepLinkShiftId(null)} />;
        return <CleanerPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onUpdateUser={setUser} />;
      case 'logistics': return <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'properties': return <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients': return <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={setUser} leaveRequests={leaveRequests} />;
      case 'users': return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} leaveRequests={leaveRequests} tutorials={tutorials} shifts={shifts} />;
      case 'settings': return <PersonnelProfile user={user} leaveRequests={leaveRequests} shifts={shifts} properties={properties} organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} onUpdateUser={setUser} tutorials={tutorials} setActiveTab={setActiveTab} />;
      case 'worksheet': return <EmployeeWorksheet user={user} shifts={shifts} properties={properties} />;
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} currentUser={user} onUpdateUser={setUser} showToast={showToast} />;
      case 'pulse': return <div className="max-w-2xl mx-auto py-10 px-4"><h2 className="text-3xl font-brand font-black uppercase mb-10">Studio Pulse</h2><InteractiveFeed items={feedItems} currentUser={user} onLike={handleLikeFeedItem} onNavigate={setActiveTab} onPostManual={handlePostFeedItem} /></div>;
      default: return <div className="p-20 text-center opacity-20 uppercase font-black">Module Pending</div>;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user?.role || 'cleaner'} onLogout={handleLogout} notificationCount={notifications.length} onOpenNotifications={() => setShowActivityCenter(true)} isSyncing={isSyncing} organization={organization}>
      {renderTab()}
      {showActivityCenter && <ActivityCenter notifications={notifications} onClose={() => setShowActivityCenter(false)} onNavigate={(tab) => setActiveTab(tab)} userRole={user?.role || 'cleaner'} currentUserId={user?.id || ''} />}
      {showBuildConsole && <BuildModeOverlay currentUser={user} onSwitchUser={handleImpersonate} onToggleTab={setActiveTab} stats={{ users: users.length, properties: properties.length, shifts: shifts.length }} onClose={() => setShowBuildConsole(false)} />}
      {toast && (
        <div className="fixed top-24 right-10 z-[3000] animate-in slide-in-from-right duration-500">
           <div className={`px-8 py-4 rounded-2xl shadow-2xl border-l-4 flex items-center gap-4 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : toast.type === 'error' ? 'bg-rose-50 border-rose-500 text-rose-900' : 'bg-slate-900 border-teal-500 text-white'}`}>
             <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
