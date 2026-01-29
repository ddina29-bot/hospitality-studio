
import React, { useState, useEffect, useMemo } from 'react';
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
import { TabType, UserRole, Shift, SupplyRequest, User, Client, Property, Announcement, SupplyItem, AuditReport, Tutorial, LeaveRequest, LeaveType, ManualTask, OrganizationSettings, Invoice } from './types';

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

const INITIAL_SUPPLY_CATALOG: SupplyItem[] = [
  { id: 'sup-1', name: 'Premium Glass Spray', photo: 'https://images.unsplash.com/photo-1584622781564-1d9876a3e75a?auto=format&fit=crop&w=300&q=80', category: 'spray', type: 'cleaning', explanation: 'Use on all mirrors and glass surfaces. Spray 20cm away and wipe with blue microfiber cloth in circular motions.', unit: '750ml Bottle' },
  { id: 'sup-2', name: 'Degreaser Spray', photo: 'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?auto=format&fit=crop&w=300&q=80', category: 'spray', type: 'cleaning', explanation: 'Essential for kitchen hobs and extractor fans. Leave for 2 minutes before wiping. DO NOT use on marble.', unit: '750ml Bottle' },
  { id: 'sup-3', name: 'Floor Sanitizer', photo: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=300&q=80', category: 'basic', type: 'cleaning', explanation: 'Dilute 1 cap per 5L of water. Mandatory for every check-out clean. Ensure floor is dry before leaving.', unit: '1L Bottle' },
  { id: 'sup-4', name: 'Toilet Deep Cleaner', photo: 'https://images.unsplash.com/photo-1621643194015-77983679c656?auto=format&fit=crop&w=300&q=80', category: 'basic', type: 'cleaning', explanation: 'Apply under the rim and leave for 100 minutes. Scrub thoroughly. Use only with designated toilet brush.', unit: '750ml Bottle' },
  { id: 'sup-5', name: 'Welcome Pack (Standard)', photo: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=300&q=80', category: 'pack', type: 'welcome pack', explanation: 'Place on the kitchen island. Includes 2x local snacks, 2x water, and Studio welcome letter.', unit: 'Unit' },
  { id: 'sup-6', name: 'Linen Set (King)', photo: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80', category: 'linen', type: 'laundry', explanation: '1x Bottom sheet,  duve cover, 4x Pillowcases. Ensure no creases.', unit: 'Set' },
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('current_user_obj');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('studio_master_users_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('studio_shifts_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('studio_clients_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = localStorage.getItem('studio_properties_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => {
    const saved = localStorage.getItem('studio_supply_requests_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => {
    const saved = localStorage.getItem('studio_inventory_v2');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLY_CATALOG;
  });

  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => {
    const saved = localStorage.getItem('studio_manual_tasks_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('studio_leave_requests_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('studio_invoices_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [tutorials, setTutorials] = useState<Tutorial[]>(() => {
    const saved = localStorage.getItem('studio_tutorials_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [organization, setOrganization] = useState<OrganizationSettings>(() => {
    const saved = localStorage.getItem('studio_org_settings');
    const defaults: OrganizationSettings = {
      name: 'RESET HOSPITALITY STUDIO',
      legalEntity: '',
      regNumber: '',
      taxId: '',
      peNumber: '',
      address: '',
      email: '',
      phone: '',
      website: ''
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>([]);
  const [authorizedInspectorIds, setAuthorizedInspectorIds] = useState<string[]>([]);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [deepLinkShiftId, setDeepLinkShiftId] = useState<string | null>(null);
  const [savedTaskNames, setSavedTaskNames] = useState<string[]>(['Extra Towels', 'Deep Clean Fridge', 'Balcony Sweep']);
  const [activationUser, setActivationUser] = useState<User | null>(null);
  
  // New State for Auth Flow
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Persistence Effects
  useEffect(() => { localStorage.setItem('studio_master_users_v2', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('studio_shifts_v2', JSON.stringify(shifts)); }, [shifts]);
  useEffect(() => { localStorage.setItem('studio_clients_v2', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('studio_properties_v2', JSON.stringify(properties)); }, [properties]);
  useEffect(() => { localStorage.setItem('studio_supply_requests_v2', JSON.stringify(supplyRequests)); }, [supplyRequests]);
  useEffect(() => { localStorage.setItem('studio_inventory_v2', JSON.stringify(inventoryItems)); }, [inventoryItems]);
  useEffect(() => { localStorage.setItem('studio_manual_tasks_v2', JSON.stringify(manualTasks)); }, [manualTasks]);
  useEffect(() => { localStorage.setItem('studio_leave_requests_v2', JSON.stringify(leaveRequests)); }, [leaveRequests]);
  useEffect(() => { localStorage.setItem('studio_invoices_v2', JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem('studio_tutorials_v2', JSON.stringify(tutorials)); }, [tutorials]);
  useEffect(() => { localStorage.setItem('studio_org_settings', JSON.stringify(organization)); }, [organization]);

  const handleLogin = (u: User) => {
    if (u.status === 'active') {
      setUsers(prev => prev.map(existing => existing.id === u.id ? { ...existing, ...u, status: 'active' as const } : existing));
    }
    setUser(u);
    setActiveTab('dashboard');
    setActivationUser(null);
    localStorage.setItem('current_user_obj', JSON.stringify(u));
  };

  const handleSignupComplete = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    setUser(newUser);
    setActiveTab('dashboard');
    setAuthMode('login');
    localStorage.setItem('current_user_obj', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('dashboard');
    setActivationUser(null);
    setAuthMode('login');
    localStorage.removeItem('current_user_obj');
  };

  const handlePreviewActivation = (u: User) => {
    setActivationUser(u);
    setUser(null);
    localStorage.removeItem('current_user_obj');
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

  if (!user) {
    if (authMode === 'signup') {
      return (
        <Signup 
          onSignupComplete={handleSignupComplete}
          onBackToLogin={() => setAuthMode('login')}
        />
      );
    }
    
    return (
      <Login 
        onLogin={handleLogin} 
        users={users} 
        setUsers={setUsers} 
        initialActivationUser={activationUser}
        onSignupClick={() => setAuthMode('signup')}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (user.role === 'admin') return <AdminDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} onToggleLaundryPrepared={(id) => setShifts(prev => prev.map(s => s.id === id ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s))} />;
        if (user.role === 'housekeeping') return <HousekeeperDashboard user={user} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} setShifts={setShifts} users={users} properties={properties} supplyRequests={supplyRequests} leaveRequests={leaveRequests} onResolveLogistics={handleResolveLogistics} onAuditDeepLink={handleAuditDeepLink} onOpenManualTask={() => setShowTaskModal(true)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
        if (user.role === 'hr') return <AdminPortal view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onPreviewActivation={handlePreviewActivation} />;
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
        return <CleanerPortal shifts={shifts} setShifts={setShifts} properties={properties} users={users} initialSelectedShiftId={deepLinkShiftId} onConsumedDeepLink={() => setDeepLinkShiftId(null)} authorizedInspectorIds={authorizedInspectorIds} />;
      
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
        return <AdminPortal view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onPreviewActivation={handlePreviewActivation} />;
      case 'settings':
        return (
          <StudioSettings 
            organization={organization}
            setOrganization={setOrganization}
            userCount={users.length}
            propertyCount={properties.length}
          />
        );
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
