
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
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) setActivationCode(code);
  }, []);

  // PRODUCTION STATE
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

  const handleActivationComplete = (activatedUser: User) => {
    setUsers(prev => prev.map(u => u.email === activatedUser.email ? activatedUser : u));
    setUser(activatedUser);
    setActivationCode(null);
    window.history.replaceState({}, document.title, "/");
  };

  const handleDashboardAlertClick = (userId: string) => {
    setTargetLogisticsUserId(userId);
    setActiveTab('logistics');
  };

  const handleLogin = (u: User, organizationData?: any) => {
    setUser(u);
    if (organizationData) {
        // Sync database state to local state upon login
        if (organizationData.users) setUsers(organizationData.users);
        if (organizationData.shifts) setShifts(organizationData.shifts);
        if (organizationData.properties) setProperties(organizationData.properties);
        if (organizationData.clients) setClients(organizationData.clients);
        if (organizationData.invoices) setInvoices(organizationData.invoices);
        if (organizationData.timeEntries) setTimeEntries(organizationData.timeEntries);
        if (organizationData.tutorials) setTutorials(organizationData.tutorials);
    }
  };

  const renderContent = () => {
    if (!user) return null;
    const role = user.role;

    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onLogisticsAlertClick={handleDashboardAlertClick} onLogout={() => setUser(null)} />;
      case 'properties': return <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} selectedPropertyIdToEdit={selectedPropertyIdToEdit} setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit} />;
      case 'clients': return <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(role)) return <AdminPortal user={user} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
        return <CleanerPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} />;
      case 'logistics': return <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} />;
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={role} />;
      case 'users': return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
      default: return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onLogisticsAlertClick={handleDashboardAlertClick} onLogout={() => setUser(null)} />;
    }
  };

  if (activationCode) {
    return <UserActivation token={activationCode} onActivationComplete={handleActivationComplete} onCancel={() => setActivationCode(null)} />;
  }

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} onLogout={() => { setUser(null); localStorage.removeItem('current_user_obj'); }}>
      {renderContent()}
    </Layout>
  );
};

export default App;
