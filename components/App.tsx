
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
import { TabType, Shift, SupplyRequest, User, Client, Property, SupplyItem, AuditReport, Tutorial, LeaveRequest, ManualTask, OrganizationSettings, Invoice } from './types';

// Role-specific Dashboards
import AdminDashboard from './components/dashboards/AdminDashboard';
import HRDashboard from './components/dashboards/HRDashboard';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import SupervisorDashboard from './components/dashboards/SupervisorDashboard';
import DriverDashboard from './components/dashboards/DriverDashboard';
import MaintenanceDashboard from './components/dashboards/MaintenanceDashboard';
import ClientDashboard from './components/dashboards/ClientDashboard';
import HousekeeperDashboard from './components/dashboards/HousekeeperDashboard';
import LaundryDashboard from './components/dashboards/LaundryDashboard';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // --- APP DATA STATE (Starts Empty - Loaded from Server) ---
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

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // --- UI STATE ---
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>([]);
  const [authorizedInspectorIds, setAuthorizedInspectorIds] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [deepLinkShiftId, setDeepLinkShiftId] = useState<string | null>(null);
  const [savedTaskNames, setSavedTaskNames] = useState<string[]>(['Extra Towels', 'Deep Clean Fridge', 'Balcony Sweep']);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- 0. INITIAL LOAD (Restore Session) ---
  useEffect(() => {
    const savedUser = localStorage.getItem('current_user_obj');
    const savedOrgSettings = localStorage.getItem('studio_org_settings');
    
    if (savedUser && savedOrgSettings) {
      try {
        const u = JSON.parse(savedUser);
        const o = JSON.parse(savedOrgSettings);
        
        setUser(u);
        setOrgId(o.id);
        setOrganization(o.settings || o); // Handle structure variation
        
        // Note: Ideally we would fetch fresh data from API here using the OrgID.
        // For now, we rely on the user being logged in to access the UI.
        // If the array data (shifts, users) is missing from local state, 
        // it will be empty until a sync/fetch occurs or re-login.
        // To fix empty data on refresh without a backend fetch endpoint implemented:
        // We recommend the user logs out and logs back in to re-hydrate the full state from the /login response.
        
      } catch (e) {
        console.error("Failed to restore session", e);
        localStorage.clear();
      }
    }
  }, []);

  // --- 1. LOGIN HANDLER ---
  const handleLogin = (u: User, orgData: any) => {
    setUser(u);
    setOrgId(orgData.id);
    
    // Hydrate State from the Organization Data (Database)
    setUsers(orgData.users || []);
    setShifts(orgData.shifts || []);
    setProperties(orgData.properties || []);
    setClients(orgData.clients || []);
    setInventoryItems(orgData.inventoryItems || []);
    setManualTasks(orgData.manualTasks || []);
    setSupplyRequests(orgData.supplyRequests || []);
    setOrganization(orgData.settings || {});
    
    setActiveTab('dashboard');
  };

  // --- 2. SIGNUP HANDLER ---
  const handleSignupComplete = (u: User, orgData: any) => {
    handleLogin(u, orgData);
  };

  // --- 3. SYNC TO CLOUD (Auto-Save) ---
  useEffect(() => {
    if (!user || !orgId) return;

    const timeout = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: {
              users, shifts, properties, clients, supplyRequests, inventoryItems, manualTasks, organization
            }
          })
        });
      } catch (e) {
        console.error("Sync Failed", e);
      } finally {
        setIsSyncing(false);
      }
    }, 2000); // Debounce saves

    return () => clearTimeout(timeout);
  }, [users, shifts, properties, clients, supplyRequests, inventoryItems, manualTasks, organization]);

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    setAuthMode('login');
    // Clear local state
    setUsers([]);
    setShifts([]);
    setProperties([]);
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
        if (user.role === 'admin') return <AdminDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} />;
        if (user.role === 'housekeeping') return <HousekeeperDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
        if (user.role === 'hr') return <AdminPortal view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} />;
        if (user.role === 'finance') return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
        if (user.role === 'supervisor') return <SupervisorDashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} onLogout={handleLogout} manualTasks={manualTasks} setManualTasks={setManualTasks} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} onAuditDeepLink={handleAuditDeepLink} authorizedInspectorIds={authorizedInspectorIds} setAuthorizedInspectorIds={setAuthorizedInspectorIds} />;
        if (user.role === 'driver') return <DriverDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} properties={properties} onResolveLogistics={handleResolveLogistics} onTogglePickedUp={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPickedUp: !s.isLaundryPickedUp } : s))} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} />;
        if (user.role === 'maintenance' || user.role === 'outsourced_maintenance') return <MaintenancePortal users={users} userRole={user.role} shifts={shifts} setShifts={setShifts} setActiveTab={setActiveTab} onLogout={handleLogout} />;
        if (user.role === 'client') return <ClientDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} invoices={invoices} />;
        if (user.role === 'laundry') return <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} authorizedLaundryUserIds={authorizedLaundryUserIds} onToggleAuthority={(id) => setAuthorizedLaundryUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />;
        return <Dashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} shifts={shifts} supplyRequests={supplyRequests} properties={properties} inventoryItems={inventoryItems} onAddSupplyRequest={handleAddSupplyRequest} onUpdateSupplyStatus={(id, status) => setSupplyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))} />;
      
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
        return <LaundryDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} onTogglePrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} authorizedLaundryUserIds={authorizedLaundryUserIds} onToggleAuthority={(id) => setAuthorizedLaundryUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />;
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
        return <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} />;
      case 'ai':
        return <AISync />;
      case 'manual':
        return <AppManual />;
      default:
        return <Dashboard user={user} onLogout={handleLogout} setActiveTab={setActiveTab} shifts={shifts} supplyRequests={supplyRequests} properties={properties} inventoryItems={inventoryItems} onAddSupplyRequest={handleAddSupplyRequest} onUpdateSupplyStatus={(id, status) => setSupplyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} onLogout={handleLogout} currentUserId={user.id} authorizedLaundryUserIds={authorizedLaundryUserIds}>
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 bg-black text-[#C5A059] px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 animate-pulse">
           <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full"></div> Syncing...
        </div>
      )}
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
