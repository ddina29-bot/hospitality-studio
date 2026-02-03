
import React, { useState, useEffect, useRef } from 'react';
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
import Login from './components/Login';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport } from './types';

const load = <T,>(k: string, f: T): T => {
  if (typeof window === 'undefined') return f;
  const s = localStorage.getItem(k);
  if (!s) return f;
  try { return JSON.parse(s); } catch (e) { return f; }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [simulationRole, setSimulationRole] = useState<UserRole | null>(null);
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isHydrating = useRef(false);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  // PRODUCTION STATE - Initialized with safe defaults
  const [users, setUsers] = useState<User[]>(() => load('studio_users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => load('studio_shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => load('studio_props', []));
  const [clients, setClients] = useState<Client[]>(() => load('studio_clients', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('studio_invoices', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('studio_time_entries', []));
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => load('studio_tutorials', []));
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => load('studio_inventory', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => load('studio_supply_requests', []));
  const [anomalyReports, setAnomalyReports] = useState<AnomalyReport[]>(() => load('studio_anomalies', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: '', email: '', phone: '' }));
  
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string | null>(null);
  const [selectedPropertyIdToEdit, setSelectedPropertyIdToEdit] = useState<string | null>(null);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRole = simulationRole || user?.role || 'admin';

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // HYDRATE STATE FROM SERVER
  useEffect(() => {
    const hydrateState = async () => {
      if (!user || isHydrating.current) return;
      isHydrating.current = true;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/state?email=${encodeURIComponent(user.email)}`);
        if (response.status === 404) {
          setIsLoading(false);
          isHydrating.current = false;
          return;
        }
        if (!response.ok) throw new Error("Sync server connection interrupted.");
        const data = await response.json();
        if (data.success && data.organization) {
          const org = data.organization;
          setOrgId(org.id);
          localStorage.setItem('current_org_id', org.id);
          setUsers(org.users ?? []);
          setShifts(org.shifts ?? []);
          setProperties(org.properties ?? []);
          setClients(org.clients ?? []);
          setInvoices(org.invoices ?? []);
          setTimeEntries(org.timeEntries ?? []);
          setTutorials(org.tutorials ?? []);
          setInventoryItems(org.inventoryItems ?? []);
          setSupplyRequests(org.supplyRequests ?? []);
          setAnomalyReports(org.anomalyReports ?? []);
          if (org.settings) setOrganization(org.settings);
        }
      } catch (err) {
        console.error("Sync Negotiation Failed:", err);
      } finally {
        setIsLoading(false);
        setTimeout(() => { isHydrating.current = false; }, 500);
      }
    };
    hydrateState();
  }, [user?.email]);

  // AUTO-SYNC
  useEffect(() => {
    if (!user || !orgId || isHydrating.current) return;

    localStorage.setItem('studio_users', JSON.stringify(users));
    localStorage.setItem('studio_shifts', JSON.stringify(shifts));
    localStorage.setItem('studio_props', JSON.stringify(properties));
    localStorage.setItem('studio_clients', JSON.stringify(clients));
    localStorage.setItem('studio_invoices', JSON.stringify(invoices));
    localStorage.setItem('studio_time_entries', JSON.stringify(timeEntries));
    localStorage.setItem('studio_tutorials', JSON.stringify(tutorials));
    localStorage.setItem('studio_inventory', JSON.stringify(inventoryItems));
    localStorage.setItem('studio_supply_requests', JSON.stringify(supplyRequests));
    localStorage.setItem('studio_anomalies', JSON.stringify(anomalyReports));
    localStorage.setItem('studio_active_tab', activeTab);
    localStorage.setItem('studio_org_settings', JSON.stringify(organization));
    localStorage.setItem('current_user_obj', JSON.stringify(user));

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { users, shifts, properties, clients, invoices, timeEntries, tutorials, inventoryItems, supplyRequests, anomalyReports, settings: organization }
          })
        });
      } catch (err) { console.error("Sync error:", err); }
    }, 2000);

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, user, orgId, organization, inventoryItems, supplyRequests, anomalyReports]);

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleLogin = (u: User, organizationData?: any) => {
    setUser(u);
    if (organizationData) {
        setOrgId(organizationData.id);
        setUsers(organizationData.users ?? []);
        setShifts(organizationData.shifts ?? []);
        setProperties(organizationData.properties ?? []);
        setClients(organizationData.clients ?? []);
        setOrganization(organizationData.settings ?? organization);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSimulationRole(null);
    setOrgId(null);
    localStorage.clear();
  };

  const renderContent = () => {
    if (!user) return null;
    const effectiveUser = { ...user, role: currentRole };
    
    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard 
          user={effectiveUser} 
          users={users} 
          setActiveTab={setActiveTab} 
          shifts={shifts} 
          setShifts={setShifts} 
          invoices={invoices} 
          timeEntries={timeEntries} 
          supplyRequests={supplyRequests}
          setSupplyRequests={setSupplyRequests}
          onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} 
          onLogout={handleLogout} 
          onUpdateUser={handleUpdateUser} 
        />
      );
      case 'properties': return <AdminPortal user={effectiveUser} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} selectedPropertyIdToEdit={selectedPropertyIdToEdit} setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'clients': return <AdminPortal user={effectiveUser} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(currentRole)) return <AdminPortal user={effectiveUser} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
        return <CleanerPortal user={effectiveUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onUpdateUser={handleUpdateUser} />;
      case 'logistics': return <DriverPortal user={effectiveUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} />;
      case 'inventory_admin': return (
        <InventoryAdmin 
          inventoryItems={inventoryItems} 
          setInventoryItems={setInventoryItems} 
          supplyRequests={supplyRequests} 
          setSupplyRequests={setSupplyRequests} 
          shifts={shifts} 
          setShifts={setShifts} 
          showToast={showToast}
          setAnomalyReports={setAnomalyReports}
        />
      );
      case 'tutorials': return <TutorialsHub tutorials={tutorials} setTutorials={setTutorials} userRole={currentRole} showToast={showToast} />;
      case 'users': return <AdminPortal user={effectiveUser} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} />;
      case 'reports': return <ReportsPortal auditReports={[]} users={users} shifts={shifts} userRole={currentRole} anomalyReports={anomalyReports} />;
      case 'settings': return <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} />;
      default: return <Dashboard user={effectiveUser} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} invoices={invoices} timeEntries={timeEntries} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
    }
  };

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} />;

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden">
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-40 animate-pulse">
           <div className="w-12 h-12 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-teal-600">Synchronizing Session Core...</p>
        </div>
      ) : (
        <Layout 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentRole} 
          onLogout={handleLogout}
          onRoleChange={(r) => setSimulationRole(r)}
        >
          {renderContent()}
        </Layout>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300">
           <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
             toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' : 
             toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 
             'bg-slate-900 border-slate-800 text-white'
           }`}>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
