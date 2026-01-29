
import React, { useState, useEffect, useRef } from 'react';
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
import { TabType, Shift, SupplyRequest, User, Client, Property, SupplyItem, AuditReport, Tutorial, LeaveRequest, ManualTask, OrganizationSettings, Invoice, TimeEntry } from './types';

import AdminDashboard from './components/dashboards/AdminDashboard';
import HRDashboard from './components/dashboards/HRDashboard';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import SupervisorDashboard from './components/dashboards/SupervisorDashboard';
import DriverDashboard from './components/dashboards/DriverDashboard';
import MaintenanceDashboard from './components/dashboards/MaintenanceDashboard';
import ClientDashboard from './components/dashboards/ClientDashboard';
import HousekeeperDashboard from './components/dashboards/HousekeeperDashboard';
import LaundryDashboard from './components/dashboards/LaundryDashboard';

// CRITICAL FIX: "Local-First" Merge Strategy
// This ensures that if you have a piece of data locally (e.g., a new Property or Shift),
// it is NOT overwritten by the server's older version on refresh.
// We only accept items from the server that we completely lack.
const smartMerge = <T extends { id: string }>(localList: T[], serverList: T[] | undefined): T[] => {
  if (!serverList || serverList.length === 0) return localList;
  if (!localList || localList.length === 0) return serverList;

  // Create a map of local items for fast lookup
  const localMap = new Map(localList.map(i => [i.id, i]));
  
  // Start with our local truth
  const merged = [...localList];
  
  // Only add server items if we don't have them
  serverList.forEach(serverItem => {
    if (!localMap.has(serverItem.id)) {
      merged.push(serverItem);
    }
  });
  
  return merged;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [organization, setOrganization] = useState<OrganizationSettings>({
    name: '', legalEntity: '', taxId: '', address: '', email: '', phone: '', website: ''
  });
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>([]);
  const [authorizedInspectorIds, setAuthorizedInspectorIds] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [deepLinkShiftId, setDeepLinkShiftId] = useState<string | null>(null);
  const [savedTaskNames, setSavedTaskNames] = useState<string[]>(['Extra Towels', 'Deep Clean Fridge', 'Balcony Sweep']);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user_obj');
    const savedOrgSettings = localStorage.getItem('studio_org_settings');
    
    if (savedUser && savedOrgSettings) {
      try {
        const u = JSON.parse(savedUser);
        const o = JSON.parse(savedOrgSettings);
        
        setUser(u);
        setOrgId(o.id);
        setOrganization(o.settings || o);
        
        // 1. Immediate Hydration from Local Storage (Fast Load)
        const localUsers = o.users || [];
        const localShifts = o.shifts || [];
        const localProperties = o.properties || [];
        const localClients = o.clients || [];
        const localInventory = o.inventoryItems || [];
        const localTasks = o.manualTasks || [];
        const localSupplies = o.supplyRequests || [];
        const localInvoices = o.invoices || [];
        const localTime = o.timeEntries || [];
        const localLeaves = o.leaveRequests || [];
        const localTutorials = o.tutorials || [];

        setUsers(localUsers);
        setShifts(localShifts);
        setProperties(localProperties);
        setClients(localClients);
        setInventoryItems(localInventory);
        setManualTasks(localTasks);
        setSupplyRequests(localSupplies);
        setInvoices(localInvoices);
        setTimeEntries(localTime);
        setLeaveRequests(localLeaves);
        setTutorials(localTutorials);

        setIsLoaded(true);

        // 2. Background Sync with Server (Safe Merge)
        if (o.id) {
            fetch(`/api/organization/${o.id}`)
              .then(res => res.json())
              .then(serverOrg => {
                 if(serverOrg.error) {
                    console.error("Server fetch error:", serverOrg.error);
                    return;
                 }
                 
                 // Handle Factory Reset Case: If server has explicitly cleared data (empty arrays),
                 // but local still has data, we trust the server ONLY if the local data seems stale.
                 // However, for safety, we rely on the smartMerge to keep local data unless user hit "Reset".
                 
                 // Apply Smart Merge to ALL data types
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
                 
                 if (serverOrg.settings) setOrganization(serverOrg.settings);
                 
                 // 3. Persist the Merged State Immediately to prevent data loss on next reload
                 const finalState = {
                    ...serverOrg,
                    users: smartMerge(localUsers, serverOrg.users),
                    properties: smartMerge(localProperties, serverOrg.properties),
                    clients: smartMerge(localClients, serverOrg.clients),
                    shifts: smartMerge(localShifts, serverOrg.shifts),
                    manualTasks: smartMerge(localTasks, serverOrg.manualTasks),
                    supplyRequests: smartMerge(localSupplies, serverOrg.supplyRequests),
                    invoices: smartMerge(localInvoices, serverOrg.invoices),
                    timeEntries: smartMerge(localTime, serverOrg.timeEntries),
                    leaveRequests: smartMerge(localLeaves, serverOrg.leaveRequests),
                    tutorials: smartMerge(localTutorials, serverOrg.tutorials)
                 };
                 localStorage.setItem('studio_org_settings', JSON.stringify(finalState));
              })
              .catch(err => console.error("Background sync failed:", err));
        }
        
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    } else {
        setIsLoaded(true);
    }
  }, []);

  const handleLogin = (u: User, orgData: any) => {
    setUser(u);
    setOrgId(orgData.id);
    setUsers(orgData.users || []);
    setShifts(orgData.shifts || []);
    setProperties(orgData.properties || []);
    setClients(orgData.clients || []);
    setInventoryItems(orgData.inventoryItems || []);
    setManualTasks(orgData.manualTasks || []);
    setSupplyRequests(orgData.supplyRequests || []);
    setLeaveRequests(orgData.leaveRequests || []);
    setTutorials(orgData.tutorials || []);
    setOrganization(orgData.settings || {});
    setInvoices(orgData.invoices || []);
    setTimeEntries(orgData.timeEntries || []);
    setIsLoaded(true);
    setActiveTab('dashboard');
  };

  const handleSignupComplete = (u: User, orgData: any) => {
    handleLogin(u, orgData);
  };

  // --- AUTO SYNC ---
  useEffect(() => {
    if (!user || !orgId || !isLoaded) return; 

    const payload: any = {
        id: orgId,
        users, 
        shifts, 
        properties,
        clients,
        supplyRequests, 
        inventoryItems,
        manualTasks, 
        timeEntries,
        leaveRequests,
        tutorials,
        settings: organization, 
        invoices
    };

    // Save to LocalStorage immediately
    localStorage.setItem('studio_org_settings', JSON.stringify(payload));

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
        console.error("Sync Failed", e);
      } finally {
        setIsSyncing(false);
      }
    }, 1500); 

    return () => clearTimeout(timeout);
  }, [users, shifts, properties, clients, supplyRequests, inventoryItems, manualTasks, organization, invoices, timeEntries, leaveRequests, tutorials, user, orgId, isLoaded]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSyncing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSyncing]);

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    setAuthMode('login');
    setUsers([]);
    setShifts([]);
    setProperties([]);
    setClients([]); 
    setTimeEntries([]);
    setIsLoaded(false);
    localStorage.removeItem('current_user_obj');
    localStorage.removeItem('studio_org_settings');
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
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

  if (!user) {
    if (authMode === 'signup') {
      return <Signup onSignupComplete={handleSignupComplete} onBackToLogin={() => setAuthMode('login')} />;
    }
    return <Login onLogin={handleLogin} onSignupClick={() => setAuthMode('signup')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (user.role === 'admin') return <AdminDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
        if (user.role === 'housekeeping') return <HousekeeperDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
        if (user.role === 'hr') return <AdminPortal view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} />;
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
            />
          );
        }
        return <CleanerPortal shifts={shifts} setShifts={setShifts} properties={properties} users={users} initialSelectedShiftId={deepLinkShiftId} onConsumedDeepLink={() => setDeepLinkShiftId(null)} authorizedInspectorIds={authorizedInspectorIds} onClosePortal={() => setActiveTab('dashboard')} />;
      
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
        return <ReportsPortal users={users} shifts={shifts} userRole={user.role} />;
      case 'finance':
        return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
      case 'personnel_profile':
        return <PersonnelProfile user={user} shifts={shifts} properties={properties} onUpdateUser={(updated) => setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))} organization={organization} />;
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
