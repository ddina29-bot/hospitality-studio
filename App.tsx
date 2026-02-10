
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
import Login from './components/Login';
import Signup from './components/Signup';
import UserActivation from './components/UserActivation';
import ActivityCenter from './components/ActivityCenter';
import BuildModeOverlay from './components/BuildModeOverlay';
import InteractiveFeed from './components/InteractiveFeed';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, AppNotification, LeaveType, FeedItem } from './types';

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
  const [showMenu, setShowMenu] = useState(false);
  const [showBuildConsole, setShowBuildConsole] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' | 'alert', id: number } | null>(null);

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
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'STUDIO', address: '', email: '', phone: '' }));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track seen IDs locally to prevent duplicate notifications during a session
  const processedEventIds = useRef<Set<string>>(new Set());

  // Browser Notification Permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const triggerAlert = useCallback((title: string, message: string, type: AppNotification['type'] = 'info', linkTab?: TabType, linkId?: string, imageUrl?: string) => {
    const newId = `notif-${Date.now()}`;
    const newNotif: AppNotification = { id: newId, title, message, type, timestamp: Date.now(), linkTab, linkId, imageUrl };
    
    setNotifications(prev => [newNotif, ...prev].slice(0, 100));
    showToast(message, type);

    // Native Browser Push (if tab is active or permitted)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: message, icon: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png' });
    }

    // Play Alert Sound (optional, standard across OOS tools)
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.3;
      audio.play();
    } catch (e) { /* ignore sound errors */ }
  }, []);

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

  // --- AUTOMATED OPERATIONAL INTELLIGENCE & NOTIFICATIONS ---
  useEffect(() => {
    if (!hasHydrated || !user) return;

    // 1. Shift Completed -> Notify Managers
    if (['admin', 'housekeeping', 'supervisor'].includes(user.role)) {
      const newlyCompleted = shifts.filter(s => s.status === 'completed' && s.approvalStatus === 'pending');
      newlyCompleted.forEach(s => {
        const eventId = `comp-${s.id}`;
        if (!processedEventIds.current.has(eventId)) {
          triggerAlert('New Audit Required', `${s.propertyName} cleaning completed. Awaiting quality verification.`, 'alert', 'shifts', s.id);
          processedEventIds.current.add(eventId);
          
          // Also add to social feed
          const staffNames = s.userIds.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).join(' & ');
          const newFeedItem: FeedItem = {
            id: `feed-comp-${s.id}-${Date.now()}`,
            userId: 'system',
            userName: staffNames || 'Field Staff',
            type: 'update',
            title: 'Deployment Completed',
            content: `${staffNames} finished cleaning at ${s.propertyName}. Unit awaiting quality audit.`,
            timestamp: Date.now(),
            likes: [],
            linkTab: 'shifts',
            linkId: s.id
          };
          setFeedItems(prev => [newFeedItem, ...prev].slice(0, 50));
        }
      });
    }

    // 2. Audit Finalized -> Notify Cleaner
    const myFinishedShifts = shifts.filter(s => s.userIds.includes(user.id) && s.approvalStatus !== 'pending');
    myFinishedShifts.forEach(s => {
      const eventId = `audit-${s.id}-${s.approvalStatus}`;
      if (!processedEventIds.current.has(eventId)) {
        const isApproved = s.approvalStatus === 'approved';
        triggerAlert(
          isApproved ? 'Shift Approved ✓' : 'Remedial Action Required !',
          isApproved ? `Great work at ${s.propertyName}. Standard verified.` : `Quality issues reported at ${s.propertyName}. See notes.`,
          isApproved ? 'success' : 'alert',
          'worksheet'
        );
        processedEventIds.current.add(eventId);
        
        if (isApproved) {
            const newFeedItem: FeedItem = {
              id: `feed-audit-${s.id}-${Date.now()}`,
              userId: 'system',
              userName: 'Management',
              type: 'milestone',
              title: 'Unit Ready for Check-in',
              content: `${s.propertyName} passed quality audit and is officially ready for the next guest.`,
              timestamp: Date.now(),
              likes: [],
              linkTab: 'reports',
              linkId: s.id,
              imageUrl: s.tasks?.[0]?.photos?.[0]?.url
            };
            setFeedItems(prev => [newFeedItem, ...prev].slice(0, 50));
        }
      }
    });

    // 3. New Supply Request -> Notify Admin
    if (user.role === 'admin') {
      const pendingReqs = supplyRequests.filter(r => r.status === 'pending');
      pendingReqs.forEach(r => {
        const eventId = `sup-${r.id}`;
        if (!processedEventIds.current.has(eventId)) {
          triggerAlert('New Supply Request', `${r.userName} requested ${r.quantity}x ${r.itemName}.`, 'warning', 'dashboard');
          processedEventIds.current.add(eventId);
        }
      });
    }

    // 4. Leave Request Status -> Notify User
    const myLeaves = leaveRequests.filter(l => l.userId === user.id && l.status !== 'pending');
    myLeaves.forEach(l => {
      const eventId = `leave-${l.id}-${l.status}`;
      if (!processedEventIds.current.has(eventId)) {
        triggerAlert(
          `Leave ${l.status.toUpperCase()}`,
          `Your ${l.type} request for ${l.startDate} has been ${l.status}.`,
          l.status === 'approved' ? 'success' : 'alert',
          'settings'
        );
        processedEventIds.current.add(eventId);
      }
    });

  }, [shifts, hasHydrated, users, user, supplyRequests, leaveRequests, triggerAlert]);

  // Persistence Sync
  useEffect(() => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      if (shifts.length === 0 && load('studio_shifts', []).length > 0) return;

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
      setNotifications(organizationData.notifications || []);
      setFeedItems(organizationData.feedItems || []);
      setTutorials(organizationData.tutorials || []);
      setHasHydrated(true);
    }

    setUser(u);
    safeSave('current_user_obj', u);
    setActiveTab('dashboard');
    triggerAlert('Session Initialized', `Welcome back to the Studio terminal, ${u.name.split(' ')[0]}.`, 'success');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActiveTab('dashboard');
    setShowMenu(false);
  };

  const handleImpersonate = (role: UserRole) => {
    const mockUser: User = {
      id: `mock-${role}`,
      name: `Studio ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      email: 'build@reset.studio',
      role,
      status: 'active'
    };
    
    if (properties.length === 0) {
      const mockProp: Property = {
        id: 'prop-1',
        name: 'Sliema Seafront Penthouse',
        address: 'Tower Road, Sliema',
        type: 'Penthouse',
        clientId: 'c-1',
        keyboxCode: '1234',
        rooms: 2,
        halfBaths: 0,
        bathrooms: 2,
        capacity: 4,
        status: 'active',
        entrancePhoto: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80',
        kitchenPhoto: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
        livingRoomPhoto: 'https://images.unsplash.com/photo-1583847268964-b28dc2f51ac9?auto=format&fit=crop&w=600&q=80',
        roomPhotos: ['https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&w=600&q=80'],
        welcomePackPhoto: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
        accessNotes: 'Keybox located behind main gate pillars.',
        doubleBeds: 1, singleBeds: 2, sofaBeds: 0, pillows: 6, hasDishwasher: true, hasCoffeeMachine: true, clientPrice: 150, cleanerPrice: 40, specialRequests: []
      };
      setProperties([mockProp]);
      
      const mockShift: Shift = {
        id: 'shift-1',
        propertyId: mockProp.id,
        propertyName: mockProp.name,
        userIds: [mockUser.id],
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
        startTime: '10:00 AM',
        serviceType: 'Check out/check in',
        status: role === 'cleaner' ? 'active' : 'pending',
        approvalStatus: 'pending',
        isPublished: true,
        actualStartTime: Date.now()
      };
      setShifts([mockShift]);
      
      if (role === 'cleaner') {
        localStorage.setItem('cleaner_active_shift_id', mockShift.id);
      }
    }

    setUser(mockUser);
    setOrgId('org-build');
    setHasHydrated(true);
    setShowBuildConsole(false);
    setActiveTab('dashboard');
    showToast(`SWITCHED TO ${role.toUpperCase()} MODE`, 'info');
  };

  const handleLikeFeedItem = (id: string) => {
    if (!user) return;
    setFeedItems(prev => prev.map(item => {
      if (item.id === id) {
        const liked = item.likes.includes(user.id);
        return {
          ...item,
          likes: liked ? item.likes.filter(uid => uid !== user.id) : [...item.likes, user.id]
        };
      }
      return item;
    }));
  };

  const handlePostManualFeed = (post: Partial<FeedItem>) => {
    if (!user) return;
    const newItem: FeedItem = {
      ...post,
      id: `manual-feed-${Date.now()}`,
      likes: []
    } as FeedItem;
    setFeedItems(prev => [newItem, ...prev].slice(0, 50));
    showToast('POST PUBLISHED TO PULSE', 'success');
  };

  const handleRequestLeave = (type: LeaveType, start: string, end: string) => {
    if (!user) return;
    const newRequest: LeaveRequest = {
      id: `lr-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      type,
      startDate: start,
      endDate: end,
      status: 'pending'
    };
    setLeaveRequests(prev => [newRequest, ...prev]);
    triggerAlert('Leave Request Logged', `Your ${type} request has been submitted for review.`, 'info', 'settings');
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    showToast(`Leave request ${status}`, status === 'approved' ? 'success' : 'info');
  };

  const handleAuditDeepLink = (shiftId: string) => {
    setDeepLinkShiftId(shiftId);
    setActiveTab('shifts');
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
      case 'dashboard': return <Dashboard user={user!} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onUpdateUser={setUser} onAuditDeepLink={handleAuditDeepLink} feedItems={feedItems} onLikeFeedItem={handleLikeFeedItem} onPostFeedItem={handlePostManualFeed} />;
      case 'shifts': 
        if (['admin', 'hr', 'housekeeping', 'supervisor'].includes(user!.role)) return <AdminPortal user={user!} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} leaveRequests={leaveRequests} initialSelectedShiftId={deepLinkShiftId} onConsumedDeepLink={() => setDeepLinkShiftId(null)} />;
        return <CleanerPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onAddSupplyRequest={() => {}} onUpdateUser={setUser} />;
      case 'logistics': return <DriverPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'laundry': return <LaundryDashboard user={user!} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} onTogglePrepared={() => {}} timeEntries={timeEntries} setTimeEntries={setTimeEntries} organization={organization} />;
      case 'properties': return <AdminPortal user={user!} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients': return <AdminPortal user={user!} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={setUser} leaveRequests={leaveRequests} />;
      case 'users': return <AdminPortal user={user!} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} leaveRequests={leaveRequests} tutorials={tutorials} shifts={shifts} />;
      case 'settings': 
        return <PersonnelProfile user={user} leaveRequests={leaveRequests} onRequestLeave={handleRequestLeave} shifts={shifts} properties={properties} organization={organization} onUpdateUser={setUser} tutorials={tutorials} setActiveTab={setActiveTab} />;
      case 'worksheet': return <EmployeeWorksheet user={user!} shifts={shifts} properties={properties} />;
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} currentUser={user} onUpdateUser={setUser} showToast={showToast} />;
      case 'pulse': return (
        <div className="max-w-2xl mx-auto py-10 px-4">
           <header className="mb-10 text-left">
              <h2 className="text-3xl font-brand font-black uppercase text-slate-900 tracking-tighter">Studio Pulse</h2>
              <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em] mt-2">Operational Live Stream</p>
           </header>
           <InteractiveFeed 
             items={feedItems} 
             currentUser={user!} 
             onLike={handleLikeFeedItem} 
             onNavigate={setActiveTab} 
             onPostManual={handlePostManualFeed}
             maxHeight="none" 
           />
        </div>
      );
      default: return <div className="p-20 text-center opacity-20 uppercase font-black tracking-widest">Module Under Construction</div>;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: '📊', roles: ['admin', 'driver', 'housekeeping', 'hr', 'finance', 'client', 'supervisor', 'cleaner'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'worksheet', label: 'Worksheet', icon: '📄', roles: ['cleaner', 'supervisor', 'laundry'] },
    { id: 'logistics', label: 'Deliveries', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'Laundry', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'properties', label: 'Portfolio', icon: '🏠', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'Partners', icon: '🏢', roles: ['admin'] },
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'tutorials', label: 'Academy', icon: '🎓', roles: ['admin', 'housekeeping', 'supervisor', 'cleaner'] },
    { id: 'pulse', label: 'Pulse', icon: '📡', roles: ['admin', 'housekeeping', 'supervisor', 'cleaner', 'driver'] },
    { id: 'settings', label: user?.role === 'admin' ? 'Studio' : 'My Profile', icon: user?.role === 'admin' ? '⚙️' : '👤', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'laundry', 'maintenance'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role || 'admin'));

  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden w-full selection:bg-teal-100 selection:text-teal-900">
      
      {user && (
        <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none truncate max-w-[180px]">
                  {organization?.name.split(' ')[0] || 'STUDIO'}
                </h1>
                {organization?.name.split(' ').slice(1).join(' ') && (
                  <p className="text-[9px] font-bold text-teal-400 uppercase tracking-[0.25em] mt-2 truncate">
                    {organization.name.split(' ').slice(1).join(' ')}
                  </p>
                )}
              </div>
              <button onClick={() => setShowBuildConsole(true)} className="p-2 bg-white/10 rounded-lg hover:bg-amber-500/20 hover:text-amber-500 transition-all">🛠️</button>
            </div>

            <div className={`px-4 py-2 rounded-xl border transition-all duration-500 flex items-center gap-3 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-[#0D9488] animate-ping' : 'bg-slate-50'}`}></div>
              <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-[#0D9488]' : 'text-slate-50'}`}>
                {isSyncing ? 'Syncing...' : 'Cloud Verified'}
              </span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 custom-scrollbar mt-4">
            {visibleItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                  activeTab === item.id ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-2">
            <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 text-xs font-bold uppercase hover:bg-white/5 rounded-2xl transition-colors hover:text-white">
              <span>🚪</span>
              <span>Log out</span>
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0 relative w-full overflow-hidden">
        {user && (
          <header className="md:hidden bg-white border-b border-gray-100 px-5 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
            <div className="flex flex-col">
                <h2 className="font-brand font-bold text-[#1E293B] text-lg leading-none tracking-tighter truncate max-w-[150px]">
                  {(organization?.name || 'STUDIO').toUpperCase()}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'SYNCING' : 'VERIFIED'}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowBuildConsole(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">🛠️</button>
              <button onClick={() => setShowActivityCenter(true)} className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-lg">🔔</span>
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">{notifications.length}</span>}
              </button>
              <button onClick={() => setShowMenu(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-50 text-[#0D9488] border border-teal-100">
                <span className="text-xl">☰</span>
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 overflow-y-auto ${user ? 'p-4 md:p-10' : ''} custom-scrollbar w-full ${user ? 'pb-24 md:pb-10' : ''}`}>
          <div className="w-full max-w-[1400px] mx-auto">
            {renderTab()}
          </div>
        </div>

        {showMenu && (
          <div className="fixed inset-0 bg-black/40 z-[200] md:hidden animate-in fade-in" onClick={() => setShowMenu(false)}>
            <div className="absolute top-0 right-0 bottom-0 w-4/5 bg-white shadow-2xl p-8 space-y-8 animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Navigation</h3>
                    <p className="text-[8px] font-bold text-teal-600 uppercase tracking-[0.3em]">Studio Terminal</p>
                  </div>
                  <button onClick={() => setShowMenu(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 text-2xl">&times;</button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-3">
                  {visibleItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id as TabType); setShowMenu(false); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${activeTab === item.id ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
               </div>

               <div className="pt-6 border-t border-slate-100">
                  <button onClick={handleLogout} className="w-full py-4 bg-rose-50 text-rose-600 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-rose-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <span>🚪</span>
                    <span>Exit Session</span>
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>

      {showActivityCenter && (
        <ActivityCenter 
          notifications={notifications} 
          onClose={() => setShowActivityCenter(false)} 
          onNavigate={setActiveTab} 
          userRole={user?.role || 'admin'}
          currentUserId={user?.id || ''}
        />
      )}

      {showBuildConsole && (
        <BuildModeOverlay 
          currentUser={user}
          onSwitchUser={handleImpersonate}
          onToggleTab={setActiveTab}
          onClose={() => setShowBuildConsole(false)}
          stats={{
            users: users.length,
            properties: properties.length,
            shifts: shifts.length
          }}
        />
      )}

      {toast && (
        <div key={toast.id} className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
          <div className={`px-8 py-4 rounded-[2rem] shadow-2xl text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-4 ${
            toast.type === 'error' || toast.type === 'alert' ? 'bg-rose-600' : 
            toast.type === 'success' ? 'bg-[#0D9488]' : 
            toast.type === 'warning' ? 'bg-amber-500' : 'bg-slate-900'
          }`}>
            <span className="text-lg">
                {toast.type === 'success' ? '✓' : toast.type === 'error' || toast.type === 'alert' ? '!' : 'ℹ'}
            </span>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
