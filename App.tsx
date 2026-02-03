
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPortal from './components/AdminPortal';
import CleanerPortal from './components/CleanerPortal';
import DriverPortal from './components/DriverPortal';
import TutorialsHub from './components/TutorialsHub';
import Login from './components/Login';
import UserActivation from './components/UserActivation';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole } from './types';

const load = <T,>(k: string, f: T): T => {
  const s = localStorage.getItem(k);
  return s ? JSON.parse(s) : f;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [effectiveRole, setEffectiveRole] = useState<UserRole>(() => (load('current_user_obj', null)?.role) || 'cleaner');
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  
  // URL Activation Detection
  const [activationCode, setActivationCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) setActivationCode(code);
  }, []);

  // STATE
  const [users, setUsers] = useState<User[]>(() => load('studio_users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => load('studio_shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => load('studio_props', []));
  const [clients, setClients] = useState<Client[]>(() => load('studio_clients', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('studio_invoices', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('studio_time_entries', []));
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => load('studio_tutorials', []));
  
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string | null>(null);
  const [selectedPropertyIdToEdit, setSelectedPropertyIdToEdit] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('studio_users', JSON.stringify(users));
    localStorage.setItem('studio_shifts', JSON.stringify(shifts));
    localStorage.setItem('studio_props', JSON.stringify(properties));
    localStorage.setItem('studio_clients', JSON.stringify(clients));
    localStorage.setItem('studio_invoices', JSON.stringify(invoices));
    localStorage.setItem('studio_time_entries', JSON.stringify(timeEntries));
    localStorage.setItem('studio_tutorials', JSON.stringify(tutorials));
    localStorage.setItem('studio_active_tab', activeTab);
    if (user) {
        localStorage.setItem('current_user_obj', JSON.stringify(user));
    }
  }, [users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, user]);

  const handleInjectDemo = () => {
    const dClient: Client = { id: 'c1', name: 'Elite Realty Malta', contactEmail: 'ops@elite.com', phone: '+356 9900 1122', billingAddress: 'Sliema Front', status: 'active' };
    
    const dProp1: Property = { 
      id: 'p1', name: 'St. Julians Penthouse', clientId: 'c1', address: 'Spinola Bay, Level 5', 
      lat: 35.9189, lng: 14.4907,
      type: 'Penthouse', rooms: 3, bathrooms: 2, halfBaths: 1, doubleBeds: 2, singleBeds: 2, pillows: 8, 
      sofaBeds: 1, sofaBed: 'double', foldableBeds: 1, babyCots: 1, capacity: 8, hasDishwasher: true, 
      hasCoffeeMachine: true, coffeeMachineType: 'Nespresso Vertuo', keyboxCode: '5544', 
      entrancePhoto: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      accessNotes: 'Keybox behind the stone planter on the right of the main glass door.', 
      clientPrice: 180, cleanerPrice: 65, status: 'active', specialRequests: []
    };

    const dProp2: Property = { 
      id: 'p2', name: 'Sliema Seafront Loft', clientId: 'c1', address: 'Tower Road, Sliema', 
      lat: 35.9122, lng: 14.5041,
      type: 'Apartment', rooms: 2, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 2, pillows: 6, 
      sofaBeds: 1, sofaBed: 'double', foldableBeds: 0, babyCots: 0, capacity: 6, hasDishwasher: true, 
      hasCoffeeMachine: false, keyboxCode: '1234', 
      entrancePhoto: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
      accessNotes: 'Main door code 0011, key inside the black lockbox.', 
      clientPrice: 120, cleanerPrice: 45, status: 'active', specialRequests: []
    };

    const cleanerUser: User = { id: 'cl1', name: 'Elena Rossi', role: 'cleaner', email: 'elena@reset.studio', phone: '+356 9911 2233', status: 'active' };
    const housekeepingUser: User = { id: 'hk1', name: 'Sarah Borg', role: 'housekeeping', email: 'sarah@reset.studio', phone: '+356 9944 5566', status: 'active' };
    const supervisorUser: User = { id: 'sup1', name: 'Julian Galea', role: 'supervisor', email: 'julian@reset.studio', phone: '+356 9977 8899', status: 'active' };
    const driverUser: User = { id: 'd1', name: 'Marco Vella', role: 'driver', email: 'marco@reset.studio', phone: '+356 7712 3456', status: 'active' };

    const todayDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    const currentUserId = user?.id || 'u1';

    const demoShifts: Shift[] = [
      { 
        id: 's1', propertyId: 'p1', propertyName: 'St. Julians Penthouse', userIds: [currentUserId, 'd1'], 
        date: todayDateStr, startTime: '09:00 AM', serviceType: 'Check out/check in', status: 'pending', 
        approvalStatus: 'pending', isPublished: true, keysHandled: true 
      },
      { 
        id: 's2', propertyId: 'p2', propertyName: 'Sliema Seafront Loft', userIds: [currentUserId, 'cl1'], 
        date: todayDateStr, startTime: '11:00 AM', serviceType: 'Check out/check in', status: 'pending', 
        approvalStatus: 'pending', isPublished: true, keysHandled: false,
        messReport: {
          description: 'Unit in extreme state of disorder. Requires additional 1.5 hours of sanitation.',
          photos: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80'],
          status: 'pending'
        }
      },
      { 
        id: 's3', propertyId: 'p1', propertyName: 'St. Julians Penthouse', userIds: [currentUserId, 'sup1'], 
        date: todayDateStr, startTime: '15:00 PM', serviceType: 'TO CHECK APARTMENT', status: 'pending', 
        approvalStatus: 'pending', isPublished: true, keysHandled: false 
      }
    ];

    setClients([dClient]);
    setProperties([dProp1, dProp2]);
    setShifts(demoShifts);
    
    const adminUser = { id: currentUserId, name: user?.name || 'Director', role: 'admin' as const, email: user?.email || 'admin@studio.com', status: 'active' as const };
    setUsers([adminUser, cleanerUser, housekeepingUser, supervisorUser, driverUser]);
    
    alert("SIMULATOR READY: Demo shifts (including an Extra Time request) have been assigned to your User ID. Switch roles to test the different portals.");
    setActiveTab('dashboard');
  };

  const handleActivationComplete = (activatedUser: User) => {
    setUsers(prev => prev.map(u => u.email === activatedUser.email ? activatedUser : u));
    setUser(activatedUser);
    setEffectiveRole(activatedUser.role);
    setActivationCode(null);
    window.history.replaceState({}, document.title, "/");
  };

  const handleDashboardAlertClick = (userId: string) => {
    setTargetLogisticsUserId(userId);
    setActiveTab('logistics');
  };

  const handleLogin = (u: User) => {
    setUser(u);
    setEffectiveRole(u.role);
  };

  const renderContent = () => {
    if (!user) return null;
    
    // We use effectiveRole to decide what the dashboard or scheduling center looks like
    const mockUser = { ...user, role: effectiveRole };

    switch (activeTab) {
      case 'dashboard': return <Dashboard user={mockUser} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onInjectDemo={handleInjectDemo} onLogisticsAlertClick={handleDashboardAlertClick} />;
      case 'properties': return <AdminPortal user={mockUser} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} selectedPropertyIdToEdit={selectedPropertyIdToEdit} setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit} />;
      case 'clients': return <AdminPortal user={mockUser} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(effectiveRole)) return <AdminPortal user={mockUser} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
        return <CleanerPortal user={mockUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} />;
      case 'logistics': return <DriverPortal user={mockUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} />;
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={effectiveRole} />;
      case 'users': return <AdminPortal user={mockUser} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
      default: return <Dashboard user={mockUser} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onLogisticsAlertClick={handleDashboardAlertClick} />;
    }
  };

  if (activationCode) {
    return <UserActivation token={activationCode} onActivationComplete={handleActivationComplete} onCancel={() => setActivationCode(null)} />;
  }

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} effectiveRole={effectiveRole} onLogout={() => { setUser(null); localStorage.removeItem('current_user_obj'); }} onSimulateRole={(r) => setEffectiveRole(r)}>
      {renderContent()}
    </Layout>
  );
};

export default App;
