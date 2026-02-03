
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPortal from './components/AdminPortal';
import CleanerPortal from './components/CleanerPortal';
import DriverPortal from './components/DriverPortal';
import TutorialsHub from './components/TutorialsHub';
import Login from './components/Login';
import UserActivation from './components/UserActivation';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial } from './types';

const load = <T,>(k: string, f: T): T => {
  const s = localStorage.getItem(k);
  return s ? JSON.parse(s) : f;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. HYDRATE STATE FROM SERVER ON MOUNT
  useEffect(() => {
    const hydrateState = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/state?email=${encodeURIComponent(user.email)}`);
        const data = await response.json();
        if (data.success && data.organization) {
          const org = data.organization;
          setOrgId(org.id);
          localStorage.setItem('current_org_id', org.id);
          if (org.users) setUsers(org.users);
          if (org.shifts) setShifts(org.shifts);
          if (org.properties) setProperties(org.properties);
          if (org.clients) setClients(org.clients);
          if (org.invoices) setInvoices(org.invoices);
          if (org.timeEntries) setTimeEntries(org.timeEntries);
          if (org.tutorials) setTutorials(org.tutorials);
        }
      } catch (err) {
        console.error("Failed to hydrate from server:", err);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateState();
  }, [user?.email]);

  // 2. AUTO-SYNC TO SERVER ON CHANGE (DEBOUNCED)
  useEffect(() => {
    if (!user || !orgId) return;

    // Local Storage Backup
    localStorage.setItem('studio_users', JSON.stringify(users));
    localStorage.setItem('studio_shifts', JSON.stringify(shifts));
    localStorage.setItem('studio_props', JSON.stringify(properties));
    localStorage.setItem('studio_clients', JSON.stringify(clients));
    localStorage.setItem('studio_invoices', JSON.stringify(invoices));
    localStorage.setItem('studio_time_entries', JSON.stringify(timeEntries));
    localStorage.setItem('studio_tutorials', JSON.stringify(tutorials));
    localStorage.setItem('studio_active_tab', activeTab);
    localStorage.setItem('current_user_obj', JSON.stringify(user));

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { users, shifts, properties, clients, invoices, timeEntries, tutorials }
          })
        });
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }, 2000); // Wait 2 seconds of inactivity before pushing to server

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, user, orgId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) setActivationCode(code);
  }, []);

  const handleLogin = (u: User, organizationData?: any) => {
    setUser(u);
    if (organizationData) {
        setOrgId(organizationData.id);
        localStorage.setItem('current_org_id', organizationData.id);
        if (organizationData.users) setUsers(organizationData.users);
        if (organizationData.shifts) setShifts(organizationData.shifts);
        if (organizationData.properties) setProperties(organizationData.properties);
        if (organizationData.clients) setClients(organizationData.clients);
        if (organizationData.invoices) setInvoices(organizationData.invoices);
        if (organizationData.timeEntries) setTimeEntries(organizationData.timeEntries);
        if (organizationData.tutorials) setTutorials(organizationData.tutorials);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    localStorage.clear();
  };

  const renderContent = () => {
    if (!user) return null;
    const role = user.role;

    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} onLogout={handleLogout} />;
      case 'properties': return <AdminPortal user={user} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} selectedPropertyIdToEdit={selectedPropertyIdToEdit} setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit} />;
      case 'clients': return <AdminPortal user={user} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(role)) return <AdminPortal user={user} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
        return <CleanerPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} />;
      case 'logistics': return <DriverPortal user={user} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} />;
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={role} />;
      case 'users': return <AdminPortal user={user} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
      default: return <Dashboard user={user} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} onLogout={handleLogout} />;
    }
  };

  if (activationCode) {
    return <UserActivation token={activationCode} onActivationComplete={(activated) => { setUsers(prev => prev.map(u => u.email === activated.email ? activated : u)); setUser(activated); setActivationCode(null); }} onCancel={() => setActivationCode(null)} />;
  }

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user.role} onLogout={handleLogout}>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 animate-pulse opacity-20">
           <span className="text-4xl">🔄</span>
           <p className="text-[10px] font-black uppercase tracking-widest mt-4">Hydrating Workspace...</p>
        </div>
      ) : renderContent()}
    </Layout>
  );
};

export default App;
