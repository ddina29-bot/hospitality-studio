
import React, { useState, useEffect } from 'react';
import { User, TabType, Shift, Property, Invoice, Client, OrganizationSettings, ManualTask, TimeEntry, SupplyItem, LeaveRequest, AppNotification, AnomalyReport, Tutorial } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CleanerPortal from './components/CleanerPortal';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import PersonnelProfile from './components/PersonnelProfile';
import EmployeeWorksheet from './components/EmployeeWorksheet';
import StudioSettings from './components/management/StudioSettings';
import Login from './components/Login';
import Signup from './components/Signup';
import UserActivation from './components/UserActivation';
import ActivityCenter from './components/ActivityCenter';
import AdminPortal from './components/AdminPortal';
import InventoryAdmin from './components/management/InventoryAdmin';
import TutorialsHub from './components/TutorialsHub';
import HumanCapitalStudio from './components/management/HumanCapitalStudio';
import ReportsPortal from './components/ReportsPortal';
import BuildModeOverlay from './components/BuildModeOverlay';

const App: React.FC = () => {
  // --- AUTH & CORE STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [isSignedUp, setIsSignedUp] = useState(true);
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // --- DATA STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [organization, setOrganization] = useState<OrganizationSettings>({} as OrganizationSettings);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [anomalyReports, setAnomalyReports] = useState<AnomalyReport[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  
  // --- UI STATE ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBuildMode, setShowBuildMode] = useState(false);
  const [activeCleanerShiftId, setActiveCleanerShiftId] = useState<string | null>(null);
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string | null>(null);
  const [selectedPropertyIdToEdit, setSelectedPropertyIdToEdit] = useState<string | null>(null);

  // Detect Activation Token or Restore Session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setActivationToken(code);
    } else {
      const savedUser = localStorage.getItem('current_user_obj');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          // Trigger initial data fetch
          fetchState(parsedUser.email);
        } catch (e) {
          console.error("Failed to parse saved user session");
        }
      }
    }
  }, []);

  const fetchState = async (email: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/state?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.success && data.organization) {
        const org = data.organization;
        setUsers(org.users || []);
        setShifts(org.shifts || []);
        setProperties(org.properties || []);
        setClients(org.clients || []);
        setInvoices(org.invoices || []);
        setManualTasks(org.manualTasks || []);
        setTimeEntries(org.timeEntries || []);
        setInventoryItems(org.inventoryItems || []);
        setLeaveRequests(org.leaveRequests || []);
        setTutorials(org.tutorials || []);
        setOrganization(org.settings || {});
        localStorage.setItem('current_org_id', org.id);
      }
    } catch (e) {
      console.error("Cloud state fetch failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = (loggedUser: User, orgData?: any) => {
    setUser(loggedUser);
    localStorage.setItem('current_user_obj', JSON.stringify(loggedUser));
    if (orgData) {
       setUsers(orgData.users || []);
       setShifts(orgData.shifts || []);
       setProperties(orgData.properties || []);
       setClients(orgData.clients || []);
       setOrganization(orgData.settings || {});
       localStorage.setItem('current_org_id', orgData.id);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('current_user_obj');
    localStorage.removeItem('current_org_id');
    window.location.href = '/'; 
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  // Switch impersonation for Build Mode
  const handleSwitchUserRole = (role: any) => {
    if (!user) return;
    const updated = { ...user, role };
    setUser(updated);
    localStorage.setItem('current_user_obj', JSON.stringify(updated));
    setShowBuildMode(false);
  };

  if (activationToken) {
    return <UserActivation token={activationToken} onActivationComplete={handleLogin} onCancel={() => setActivationToken(null)} />;
  }

  if (!user) {
    if (!isSignedUp) {
      return <Signup onSignupComplete={handleLogin} onBackToLogin={() => setIsSignedUp(true)} />;
    }
    return (
      <div className="min-h-screen bg-[#F0FDFA]">
        <Login onLogin={handleLogin} />
        <div className="fixed bottom-8 w-full text-center">
          <button onClick={() => setIsSignedUp(false)} className="text-[10px] font-black text-teal-600 uppercase tracking-widest hover:underline">
            Register New Studio Environment
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            users={users} 
            shifts={shifts} 
            setShifts={setShifts} 
            properties={properties} 
            invoices={invoices} 
            timeEntries={timeEntries} 
            manualTasks={manualTasks} 
            setManualTasks={setManualTasks} 
            setActiveTab={setActiveTab} 
            onUpdateUser={handleUpdateUser} 
            leaveRequests={leaveRequests}
            onUpdateLeaveStatus={(id, status) => setLeaveRequests(prev => prev.map(l => l.id === id ? {...l, status} : l))}
            onAuditDeepLink={(id) => { setActiveCleanerShiftId(id); setActiveTab('shifts'); }}
          />
        );
      case 'finance':
        return (
          <FinanceDashboard 
            setActiveTab={setActiveTab} 
            onLogout={handleLogout} 
            shifts={shifts} 
            setShifts={setShifts}
            users={users} 
            properties={properties} 
            invoices={invoices} 
            setInvoices={setInvoices} 
            clients={clients} 
            organization={organization} 
            manualTasks={manualTasks} 
            onUpdateUser={handleUpdateUser}
            timeEntries={timeEntries}
          />
        );
      case 'properties':
        return (
          <AdminPortal 
            user={user} 
            view="properties" 
            properties={properties} 
            setProperties={setProperties} 
            clients={clients} 
            setClients={setClients} 
            setActiveTab={setActiveTab} 
            setSelectedClientIdFilter={setSelectedClientIdFilter}
            selectedPropertyIdToEdit={selectedPropertyIdToEdit}
            setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit}
          />
        );
      case 'clients':
        return (
          <AdminPortal 
            user={user} 
            view="clients" 
            properties={properties} 
            clients={clients} 
            setClients={setClients} 
            setActiveTab={setActiveTab} 
            setSelectedClientIdFilter={setSelectedClientIdFilter}
            onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }}
          />
        );
      case 'users':
        return (
          <HumanCapitalStudio 
            users={users} 
            setUsers={setUsers} 
            leaveRequests={leaveRequests} 
            onUpdateLeaveStatus={(id, status) => setLeaveRequests(prev => prev.map(l => l.id === id ? {...l, status} : l))}
            showToast={(m) => console.log(m)}
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
            setSelectedClientIdFilter={setSelectedClientIdFilter}
            leaveRequests={leaveRequests}
            initialSelectedShiftId={activeCleanerShiftId}
            onConsumedDeepLink={() => setActiveCleanerShiftId(null)}
          />
        );
      case 'inventory_admin':
        return (
          <InventoryAdmin 
            inventoryItems={inventoryItems} 
            setInventoryItems={setInventoryItems} 
            supplyRequests={[]} 
            setSupplyRequests={() => {}} 
            shifts={shifts} 
            setShifts={setShifts} 
            setAnomalyReports={setAnomalyReports}
          />
        );
      case 'tutorials':
        return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={user.role} />;
      case 'reports':
        return <ReportsPortal users={users} shifts={shifts} leaveRequests={leaveRequests} userRole={user.role} anomalyReports={anomalyReports} />;
      case 'settings':
        return (
          <div className="space-y-8">
            {user.role === 'admin' && <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={null} />}
            <PersonnelProfile user={user} shifts={shifts} properties={properties} organization={organization} onUpdateUser={handleUpdateUser} timeEntries={timeEntries} />
          </div>
        );
      case 'worksheet':
        return <EmployeeWorksheet user={user} shifts={shifts} properties={properties} timeEntries={timeEntries} />;
      default:
        // CLEANER / SUPERVISOR MOBILE EXPERIENCE
        if (user.role === 'cleaner' || user.role === 'supervisor') {
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
        return <div className="py-20 text-center opacity-30 uppercase font-black tracking-widest text-xs">Module Standby...</div>;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      role={user.role} 
      onLogout={handleLogout} 
      isSyncing={isSyncing} 
      notificationCount={notifications.length}
      onOpenNotifications={() => setShowNotifications(true)}
      onBuildModeToggle={() => setShowBuildMode(true)}
    >
      {renderContent()}
      
      {showNotifications && <ActivityCenter notifications={notifications} onClose={() => setShowNotifications(false)} onNavigate={(tab) => setActiveTab(tab)} />}
      
      {showBuildMode && (
        <BuildModeOverlay 
          currentUser={user} 
          onSwitchUser={handleSwitchUserRole} 
          onToggleTab={setActiveTab} 
          stats={{ users: users.length, properties: properties.length, shifts: shifts.length }} 
          onClose={() => setShowBuildMode(false)} 
        />
      )}
    </Layout>
  );
};

export default App;
