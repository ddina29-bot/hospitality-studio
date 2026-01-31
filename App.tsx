
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CleanerPortal from './components/CleanerPortal';
import AdminPortal from './components/AdminPortal';
import AISync from './components/AISync';
import Login from './components/Login';
import Signup from './components/Signup';
import DriverPortal from './components/DriverPortal';
import MaintenancePortal from './components/MaintenancePortal';
import ReportsPortal from './components/ReportsPortal';
import PersonnelProfile from './components/PersonnelProfile';
import TutorialsHub from './components/TutorialsHub';
import AddTaskModal from './components/management/AddTaskModal';
import StudioSettings from './components/management/StudioSettings';
import AppManual from './components/AppManual';
import { TabType, Shift, SupplyRequest, User, Client, Property, SupplyItem, Tutorial, LeaveRequest, ManualTask, OrganizationSettings, Invoice, TimeEntry, LeaveType } from './types';

// Role-specific Dashboards
import AdminDashboard from './components/dashboards/AdminDashboard';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import SupervisorDashboard from './components/dashboards/SupervisorDashboard';
import DriverDashboard from './components/dashboards/DriverDashboard';
import MaintenanceDashboard from './components/dashboards/MaintenanceDashboard';
import ClientDashboard from './components/dashboards/ClientDashboard';
import HousekeeperDashboard from './components/dashboards/HousekeeperDashboard';
import LaundryDashboard from './components/dashboards/LaundryDashboard';
import HRDashboard from './components/dashboards/HRDashboard';

// Helper: Smart Merge 
const smartMerge = <T extends { id: string }>(localList: T[], serverList: T[] | undefined): T[] => {
  if (!serverList || !Array.isArray(serverList)) return localList;
  
  const mergedMap = new Map<string, T>();

  // 1. Add all Local items first
  localList.forEach(item => mergedMap.set(item.id, item));

  // 2. Overlay Server items (Server Wins for updates)
  serverList.forEach(item => mergedMap.set(item.id, item));

  return Array.from(mergedMap.values());
};

// Helper: Lazy State Loader with Safety Check
const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem('studio_org_settings');
    if (saved) {
       const parsed = JSON.parse(saved);
       const val = parsed[key];
       // Only return if it's a valid value (array for lists)
       if (Array.isArray(fallback) && Array.isArray(val)) return val as unknown as T;
       if (val !== undefined) return val;
    }
  } catch(e) { 
    console.warn(`[State Load] Failed to load ${key}`, e); 
  }
  return fallback;
};

const App: React.FC = () => {
  // --- AUTH STATE (Lazy Load for Immediate Access) ---
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('current_user_obj');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch { return null; }
  });

  const [orgId, setOrgId] = useState<string | null>(() => {
    try {
      const savedSettings = localStorage.getItem('studio_org_settings');
      return savedSettings ? JSON.parse(savedSettings).id : null;
    } catch { return null; }
  });

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // --- APP DATA STATE (Initialize from LocalStorage to prevent flicker/empty state) ---
  const [users, setUsers] = useState<User[]>(() => loadState('users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => loadState('shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => loadState('properties', []));
  const [clients, setClients] = useState<Client[]>(() => loadState('clients', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => loadState('supplyRequests', []));
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => loadState('inventoryItems', []));
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => loadState('manualTasks', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => loadState('leaveRequests', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadState('invoices', []));
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => loadState('tutorials', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => loadState('timeEntries', []));
  
  const [organization, setOrganization] = useState<OrganizationSettings>(() => {
      try {
        const saved = localStorage.getItem('studio_org_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.settings || parsed.organization || parsed; 
        }
      } catch {}
      return { name: '', legalEntity: '', taxId: '', address: '', email: '', phone: '', website: '' };
  });

  // --- NAVIGATION STATE (Persistent) ---
  const [activeTab, setActiveTab] = useState<TabType>(() => {
      const savedTab = localStorage.getItem('studio_active_tab');
      return (savedTab as TabType) || 'dashboard';
  });

  // Persist Active Tab changes immediately
  useEffect(() => {
    if (user) {
        localStorage.setItem('studio_active_tab', activeTab);
    }
  }, [activeTab, user]);

  // --- UI STATE ---
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>([]);
  const [authorizedInspectorIds, setAuthorizedInspectorIds] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [deepLinkShiftId, setDeepLinkShiftId] = useState<string | null>(null);
  const [savedTaskNames, setSavedTaskNames] = useState<string[]>(['Extra Towels', 'Deep Clean Fridge', 'Balcony Sweep']);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // FAIL-SAFE: Prevent auto-save until we confirm we have data from server or local restore
  const [hasFetchedServer, setHasFetchedServer] = useState(false);

  // --- 1. LOGIN HANDLER ---
  const handleLogin = (u: User, orgData: any) => {
    setUser(u);
    setOrgId(orgData.id);
    
    // Explicitly force the logged-in user to be updated in the users list
    setUsers(prev => {
        const merged = smartMerge(prev, orgData.users || []);
        return merged.map(existing => existing.id === u.id ? u : existing);
    });

    setShifts(prev => smartMerge(prev, orgData.shifts || []));
    setProperties(prev => smartMerge(prev, orgData.properties || []));
    setClients(prev => smartMerge(prev, orgData.clients || []));
    setInventoryItems(prev => smartMerge(prev, orgData.inventoryItems || []));
    setManualTasks(prev => smartMerge(prev, orgData.manualTasks || []));
    setSupplyRequests(prev => smartMerge(prev, orgData.supplyRequests || []));
    setOrganization(orgData.settings || orgData.organization || {});
    setInvoices(prev => smartMerge(prev, orgData.invoices || []));
    setTimeEntries(prev => smartMerge(prev, orgData.timeEntries || []));
    setLeaveRequests(prev => smartMerge(prev, orgData.leaveRequests || []));
    
    setHasFetchedServer(true);
    setActiveTab('dashboard');
  };

  const handleSignupComplete = (u: User, orgData: any) => {
    handleLogin(u, orgData);
  };

  // --- 2. BACKGROUND SYNC & RESTORE LOGIC ---
  useEffect(() => {
    if (user && orgId) {
        // Fetch server state
        fetch(`/api/organization/${orgId}`)
          .then(res => res.json())
          .then(serverOrg => {
             if(serverOrg.error) return;

             // Normal Sync: Merge server updates into local
             setUsers(prev => smartMerge(prev, serverOrg.users));
             setProperties(prev => smartMerge(prev, serverOrg.properties));
             setClients(prev => smartMerge(prev, serverOrg.clients));
             setShifts(prev => smartMerge(prev, serverOrg.shifts));
             setInventoryItems(prev => smartMerge(prev, serverOrg.inventoryItems));
             setManualTasks(prev => smartMerge(prev, serverOrg.manualTasks));
             setSupplyRequests(prev => smartMerge(prev, serverOrg.supplyRequests));
             setInvoices(prev => smartMerge(prev, serverOrg.invoices));
             setTimeEntries(prev => smartMerge(prev, serverOrg.timeEntries));
             setLeaveRequests(prev => smartMerge(prev, serverOrg.leaveRequests));
             setTutorials(prev => smartMerge(prev, serverOrg.tutorials));
             
             // Settings are overwritten here initially to ensure latest data
             if (serverOrg.settings) setOrganization(serverOrg.settings);
          })
          .catch(err => {
              console.error("Background sync failed - Running in Offline Mode", err);
          })
          .finally(() => {
              setHasFetchedServer(true);
          });
    }
  }, [user, orgId]);

  // --- 3. POLLING FOR REAL-TIME UPDATES ---
  useEffect(() => {
    if (!user || !orgId || isSyncing) return; // Don't poll while saving to avoid conflicts

    const pollInterval = setInterval(() => {
        fetch(`/api/organization/${orgId}`)
          .then(res => res.json())
          .then(serverOrg => {
             if(serverOrg.error) return;
             
             // Merge updates for dynamic data
             // NOTE: We DO NOT poll settings here to prevent reverting local edits while typing.
             setShifts(prev => smartMerge(prev, serverOrg.shifts));
             setSupplyRequests(prev => smartMerge(prev, serverOrg.supplyRequests));
             setLeaveRequests(prev => smartMerge(prev, serverOrg.leaveRequests));
             setManualTasks(prev => smartMerge(prev, serverOrg.manualTasks));
             setUsers(prev => smartMerge(prev, serverOrg.users));
             setTimeEntries(prev => smartMerge(prev, serverOrg.timeEntries));
          })
          .catch(err => console.error("Poll failed", err));
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [user, orgId, isSyncing]);

  // --- 4. AUTO SAVE LOOP (The "Master" Sync) ---
  useEffect(() => {
    if (!user || !orgId) return;

    const payload: any = {
        id: orgId,
        users, shifts, properties, clients, supplyRequests, inventoryItems, manualTasks, 
        timeEntries, leaveRequests, tutorials, settings: organization, invoices
    };

    // 1. Instant Local Persistence (The "Safe" Copy)
    try {
      localStorage.setItem('studio_org_settings', JSON.stringify(payload));
    } catch (e) {
      console.error("Local Storage Quota Exceeded.", e);
    }

    // 2. Cloud Sync
    if (hasFetchedServer) {
        const timeout = setTimeout(async () => {
          setIsSyncing(true);
          try {
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orgId,
                data: payload
              })
            });
          } catch (e) {
            console.error("Cloud Sync Failed", e);
          } finally {
            setIsSyncing(false);
          }
        }, 2000); // 2s Debounce for network

        return () => clearTimeout(timeout);
    }
  }, [users, shifts, properties, clients, supplyRequests, inventoryItems, manualTasks, organization, invoices, timeEntries, leaveRequests, tutorials, user, orgId, hasFetchedServer]);

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    setAuthMode('login');
    // Clear local state variables
    setUsers([]);
    setShifts([]);
    setProperties([]);
    setTimeEntries([]);
    // Clear persistence
    localStorage.removeItem('current_user_obj');
    localStorage.removeItem('studio_org_settings');
    localStorage.removeItem('studio_active_tab');
    setHasFetchedServer(false);
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const handleRequestLeave = (type: LeaveType, startDate: string, endDate: string) => {
    if (!user) return;
    const newLeave: LeaveRequest = {
      id: `leave-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      type,
      startDate,
      endDate,
      status: 'pending'
    };
    setLeaveRequests(prev => [...prev, newLeave]);
  };

  const handleAddSupplyRequest = (items: Record<string, number>) => {
    const newRequests = Object.entries(items).filter(([_, qty]) => qty > 0).map(([id, qty]) => {
      const item = inventoryItems.find(i => i.id === id);
      return {
        id: `sr-${Date.now()}-${id}`,
        userId: user?.id || 'unknown',
        userName: user?.name || 'Unknown',
        itemId: id,
        itemName: item?.name || 'Unknown',
        quantity: qty,
        date: new Date().toISOString(),
        status: 'pending' as const
      };
    });
    setSupplyRequests(prev => [...prev, ...newRequests]);
  };

  const handleResolveLogistics = (shiftId: string, field: 'isDelivered' | 'isCollected' | 'keysAtOffice', reason?: string) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, [field]: true, keyLocationReason: reason || s.keyLocationReason } : s));
  };

  const handleAuditDeepLink = (shiftId: string) => {
    setDeepLinkShiftId(shiftId);
    setActiveTab('shifts');
  };

  const handleSaveManualTask = (task: Partial<ManualTask>) => {
    const newTask: ManualTask = {
      ...task,
      id: `mt-${Date.now()}`,
      date: new Date().toISOString(),
      status: 'pending'
    } as ManualTask;
    setManualTasks(prev => [...prev, newTask]);
    setShowTaskModal(false);
  };

  const handleToggleTimeClock = () => {
    if (!user) return;
    const myEntries = timeEntries.filter(e => e.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const isClockedIn = myEntries.length > 0 && myEntries[0].type === 'in';
    const newType = isClockedIn ? 'out' : 'in';
    const newEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      userId: user.id,
      type: newType,
      timestamp: new Date().toISOString()
    };
    setTimeEntries(prev => [...prev, newEntry]);
  };

  // --- RENDER ---

  if (!user) {
    if (authMode === 'signup') {
      return <Signup onSignupComplete={handleSignupComplete} onBackToLogin={() => setAuthMode('login')} />;
    }
    return <Login onLogin={handleLogin} onSignupClick={() => setAuthMode('signup')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (user.role === 'admin') return <AdminDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} authorizedLaundryUserIds={authorizedLaundryUserIds} onToggleLaundryAuthority={(id) => setAuthorizedLaundryUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />;
        if (user.role === 'housekeeping') return <HousekeeperDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
        if (user.role === 'hr') return <HRDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} users={users} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} />;
        if (user.role === 'finance') return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
        if (user.role === 'supervisor') return <SupervisorDashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} onLogout={handleLogout} manualTasks={manualTasks} setManualTasks={setManualTasks} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} onAuditDeepLink={handleAuditDeepLink} authorizedInspectorIds={authorizedInspectorIds} setAuthorizedInspectorIds={setAuthorizedInspectorIds} />;
        if (user.role === 'driver') return <DriverDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} properties={properties} onResolveLogistics={handleResolveLogistics} onTogglePickedUp={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPickedUp: !s.isLaundryPickedUp } : s))} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} />;
        if (user.role === 'maintenance' || user.role === 'outsourced_maintenance') return <MaintenancePortal users={users} userRole={user.role} shifts={shifts} setShifts={setShifts} setActiveTab={setActiveTab} onLogout={handleLogout} />;
        if (user.role === 'client') return <ClientDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} invoices={invoices} />;
        if (user.role === 'laundry') return <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} authorizedLaundryUserIds={authorizedLaundryUserIds} onToggleAuthority={(id) => setAuthorizedLaundryUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
        return <Dashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} shifts={shifts} supplyRequests={supplyRequests} properties={properties} inventoryItems={inventoryItems} onAddSupplyRequest={handleAddSupplyRequest} onUpdateSupplyStatus={(id, status) => setSupplyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))} timeEntries={timeEntries} onToggleClock={handleToggleTimeClock} />;
      
      case 'shifts':
        if (['admin', 'housekeeping', 'hr'].includes(user.role)) {
          return (
            <AdminPortal 
              view="scheduling" 
              shifts={shifts} 
              setShifts={setShifts} 
              properties={properties} 
              users={users} 
              initialSelectedShiftId={deepLinkShiftId}
              onShiftSelected={() => setDeepLinkShiftId(null)}
              setActiveTab={setActiveTab}
              leaveRequests={leaveRequests}
            />
          );
        }
        return <CleanerPortal shifts={shifts} setShifts={setShifts} properties={properties} users={users} initialSelectedShiftId={deepLinkShiftId} onConsumedDeepLink={() => setDeepLinkShiftId(null)} authorizedInspectorIds={authorizedInspectorIds} onClosePortal={() => setActiveTab('dashboard')} inventoryItems={inventoryItems} onAddSupplyRequest={handleAddSupplyRequest} />;
      
      case 'laundry':
        return <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} authorizedLaundryUserIds={authorizedLaundryUserIds} onToggleAuthority={(id) => setAuthorizedLaundryUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'logistics':
        return <DriverPortal supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} />;
      case 'supervisor_portal':
        return <SupervisorDashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} onLogout={handleLogout} manualTasks={manualTasks} setManualTasks={setManualTasks} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} onAuditDeepLink={handleAuditDeepLink} authorizedInspectorIds={authorizedInspectorIds} setAuthorizedInspectorIds={setAuthorizedInspectorIds} />;
      case 'properties':
        return <AdminPortal view="properties" users={users} setUsers={setUsers} properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} />;
      case 'clients':
        return <AdminPortal view="clients" users={users} properties={properties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} />;
      case 'tutorials':
        return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} />;
      case 'inventory_admin':
        return <AdminPortal view="inventory" inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} />;
      case 'maintenance':
        return <MaintenancePortal users={users} userRole={user.role} shifts={shifts} setShifts={setShifts} setActiveTab={setActiveTab} onLogout={handleLogout} />;
      case 'reports':
        return <ReportsPortal users={users} shifts={shifts} userRole={user.role} leaveRequests={leaveRequests} />;
      case 'finance':
        return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
      case 'personnel_profile':
        return <PersonnelProfile user={user} shifts={shifts} properties={properties} onUpdateUser={(updated) => setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))} organization={organization} leaveRequests={leaveRequests} onRequestLeave={handleRequestLeave} />;
      case 'users':
        return <AdminPortal view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} />;
      case 'settings':
        return <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} />;
      case 'ai':
        return <AISync />;
      case 'manual':
        return <AppManual />;
      default:
        return <Dashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} shifts={shifts} supplyRequests={supplyRequests} properties={properties} inventoryItems={inventoryItems} onAddSupplyRequest={handleAddSupplyRequest} onUpdateSupplyStatus={(id, status) => setSupplyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))} timeEntries={timeEntries} onToggleClock={handleToggleTimeClock} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} onLogout={handleLogout} currentUserId={user.id} authorizedLaundryUserIds={authorizedLaundryUserIds}>
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {isSyncing ? (
          <div className="bg-black text-[#C5A059] px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 animate-pulse">
             <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full"></div> Syncing...
          </div>
        ) : (
          <div className="bg-black/5 text-black/20 px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Saved
          </div>
        )}
      </div>
      {renderContent()}
      {showTaskModal && (
        <AddTaskModal 
          onClose={() => setShowTaskModal(false)} 
          onSave={handleSaveManualTask} 
          properties={properties} 
          users={users} 
          savedTaskNames={savedTaskNames}
          onAddNewTaskName={(name) => setSavedTaskNames(prev => [...prev, name])}
        />
      )}
    </Layout>
  );
};

export default App;
