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
import LaundryDashboard from './components/dashboards/LaundryDashboard';
import PersonnelProfile from './components/PersonnelProfile';
import ActivityCenter from './components/ActivityCenter';
import Login from './components/Login';
import UserActivation from './components/UserActivation';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, LeaveType, AppNotification } from './types';

const load = <T,>(k: string, f: T): T => {
  if (typeof window === 'undefined') return f;
  const s = localStorage.getItem(k);
  if (!s) return f;
  try { return JSON.parse(s); } catch (e) { return f; }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [targetLogisticsUserId, setTargetLogisticsUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isHydrating = useRef(false);

  // Toast & Notification State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load('studio_notifications', []));
  const [showActivityCenter, setShowActivityCenter] = useState(false);

  // PRODUCTION STATE
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
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => load('studio_manual_tasks', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => load('studio_leave_requests', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'RESET STUDIO', address: '', email: '', phone: '' }));
  
  const [authorizedLaundryUserIds, setAuthorizedLaundryUserIds] = useState<string[]>(() => load('studio_auth_laundry_ids', []));
  
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string | null>(null);
  const [selectedPropertyIdToEdit, setSelectedPropertyIdToEdit] = useState<string | null>(null);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRole = user?.role || 'admin';

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addNotification = (notif: Partial<AppNotification>) => {
    const fullNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: notif.title || 'Notification',
      message: notif.message || '',
      type: notif.type || 'info',
      timestamp: Date.now(),
      linkTab: notif.linkTab,
      linkId: notif.linkId
    };
    setNotifications(prev => [fullNotif, ...prev]);
  };

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
    localStorage.setItem('studio_manual_tasks', JSON.stringify(manualTasks));
    localStorage.setItem('studio_leave_requests', JSON.stringify(leaveRequests));
    localStorage.setItem('studio_notifications', JSON.stringify(notifications));
    localStorage.setItem('studio_active_tab', activeTab);
    localStorage.setItem('studio_org_settings', JSON.stringify(organization));
    localStorage.setItem('current_user_obj', JSON.stringify(user));
    localStorage.setItem('studio_auth_laundry_ids', JSON.stringify(authorizedLaundryUserIds));

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, tutorials, activeTab, user, orgId, organization, inventoryItems, supplyRequests, anomalyReports, authorizedLaundryUserIds, manualTasks, leaveRequests, notifications]);

  const handleSupplyRequest = (batch: Record<string, number>) => {
    if (!user) return;
    const now = Date.now();
    const newRequests: SupplyRequest[] = Object.entries(batch).map(([itemId, qty]) => ({
        id: `sr-${now}-${itemId}`,
        itemId,
        itemName: inventoryItems.find(i => i.id === itemId)?.name || 'Unknown Item',
        quantity: qty,
        userId: user.id,
        userName: user.name,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
    }));
    setSupplyRequests(prev => [...prev, ...newRequests]);
    handleUpdateUser({ ...user, lastSupplyRequestDate: now });
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    const leave = leaveRequests.find(l => l.id === id);
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    
    if (leave) {
      addNotification({
        title: `Leave ${status.toUpperCase()}`,
        message: `Your request for ${leave.type} has been ${status}.`,
        type: status === 'approved' ? 'success' : 'alert',
        linkTab: 'settings'
      });
    }
    setNotifications(prev => prev.filter(n => n.linkId !== id));
    showToast(`LEAVE REQUEST ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'error');
  };

  const handleRequestLeave = (type: LeaveType, start: string, end: string) => {
    if (!user) return;
    const leaveId = `leave-${Date.now()}`;
    const newRequest: LeaveRequest = {
      id: leaveId,
      userId: user.id,
      userName: user.name,
      type,
      startDate: start,
      endDate: end,
      status: 'pending'
    };
    setLeaveRequests(prev => [...prev, newRequest]);

    addNotification({
      title: 'New Leave Request',
      message: `${user.name} requested ${type} (${start} to ${end})`,
      type: 'info',
      linkTab: 'dashboard',
      linkId: leaveId
    });
    showToast('LEAVE REQUEST SUBMITTED', 'info');
  };

  const handleLogin = (u: User, organizationData?: any) => {
    setUser(u);
    if (organizationData) {
        setOrgId(organizationData.id);
        if (organizationData.users) setUsers(organizationData.users);
        if (organizationData.shifts) setShifts(organizationData.shifts);
        if (organizationData.properties) setProperties(organizationData.properties);
        if (organizationData.clients) setClients(organizationData.clients);
        if (organizationData.settings) setOrganization(organizationData.settings);
        if (organizationData.manualTasks) setManualTasks(organizationData.manualTasks);
        if (organizationData.leaveRequests) setLeaveRequests(organizationData.leaveRequests);
        if (organizationData.authorizedLaundryUserIds) setAuthorizedLaundryUserIds(organizationData.authorizedLaundryUserIds);
        if (organizationData.notifications) setNotifications(organizationData.notifications);
    }
    if (u.role === 'supervisor') setActiveTab('shifts');
    else if (u.role === 'laundry') setActiveTab('laundry');
    else setActiveTab('dashboard');
  };

  const handleDemoLogin = () => {
    const demoUser: User = {
      id: 'demo-admin',
      name: 'Demo Administrator',
      email: 'demo@reset.studio',
      role: 'admin',
      status: 'active'
    };
    handleLogin(demoUser, { id: 'demo-org', settings: { id: 'demo-org', name: 'DEMO STUDIO', address: '123 Demo St', email: 'demo@reset.studio', phone: '+356 000 000' } });
  };

  const handleLogout = () => {
    setUser(null);
    setOrgId(null);
    localStorage.clear();
  };

  const onToggleLaundryPrepared = (shiftId: string) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, isLaundryPrepared: !s.isLaundryPrepared } : s));
    showToast('LINEN PREPARATION STATUS UPDATED', 'success');
  };

  const onToggleLaundryAuthority = (uid: string) => {
    setAuthorizedLaundryUserIds(prev => {
      const next = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      return next;
    });
  };

  const renderContent = () => {
    if (!user) return null;
    const effectiveUser = { ...user, role: currentRole };
    
    if (activeTab === 'settings') {
      return (
        <PersonnelProfile 
          user={effectiveUser} 
          leaveRequests={leaveRequests} 
          onRequestLeave={handleRequestLeave} 
          shifts={shifts} 
          properties={properties} 
          onUpdateUser={handleUpdateUser} 
          organization={organization}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard 
          user={effectiveUser} 
          users={users} 
          setActiveTab={setActiveTab} 
          shifts={shifts} 
          setShifts={setShifts} 
          properties={properties}
          invoices={invoices} 
          timeEntries={timeEntries} 
          supplyRequests={supplyRequests}
          setSupplyRequests={setSupplyRequests}
          manualTasks={manualTasks}
          setManualTasks={setManualTasks}
          leaveRequests={leaveRequests}
          onUpdateLeaveStatus={handleUpdateLeaveStatus}
          onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} 
          onLogout={handleLogout} 
          onUpdateUser={handleUpdateUser} 
        />
      );
      case 'properties': return <AdminPortal user={effectiveUser} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} selectedPropertyIdToEdit={selectedPropertyIdToEdit} setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'clients': return <AdminPortal user={effectiveUser} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} onSelectPropertyToEdit={(id) => { setSelectedPropertyIdToEdit(id); setActiveTab('properties'); }} />;
      case 'shifts': 
        if (['admin', 'housekeeping'].includes(currentRole)) return <AdminPortal user={effectiveUser} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={setSelectedClientIdFilter} leaveRequests={leaveRequests} />;
        return <CleanerPortal user={effectiveUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onAddSupplyRequest={handleSupplyRequest} onUpdateUser={handleUpdateUser} />;
      case 'logistics': return <DriverPortal user={effectiveUser} shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} timeEntries={timeEntries} setTimeEntries={setTimeEntries} initialOverrideId={targetLogisticsUserId} onResetOverrideId={() => setTargetLogisticsUserId(null)} manualTasks={manualTasks} setManualTasks={setManualTasks} />;
      case 'laundry': return (
        <LaundryDashboard 
          user={effectiveUser} 
          setActiveTab={setActiveTab} 
          onLogout={handleLogout} 
          shifts={shifts} 
          setShifts={setShifts} 
          users={users} 
          properties={properties} 
          onTogglePrepared={onToggleLaundryPrepared}
          authorizedLaundryUserIds={authorizedLaundryUserIds}
          onToggleAuthority={onToggleLaundryAuthority}
          timeEntries={timeEntries}
          setTimeEntries={setTimeEntries}
        />
      );
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
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} />;
      case 'reports': return <ReportsPortal auditReports={[]} users={users} shifts={shifts} userRole={currentRole} anomalyReports={anomalyReports} leaveRequests={leaveRequests} />;
      default: return <Dashboard user={effectiveUser} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} timeEntries={timeEntries} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onLogisticsAlertClick={(uid) => { setTargetLogisticsUserId(uid); setActiveTab('logistics'); }} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
    }
  };

  if (!user) return <Login onLogin={handleLogin} onSignupClick={() => {}} onDemoLogin={handleDemoLogin} />;

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden">
      {isLoading && properties.length === 0 ? (
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
          notificationCount={notifications.length}
          onOpenNotifications={() => setShowActivityCenter(true)}
        >
          {renderContent()}
        </Layout>
      )}

      {showActivityCenter && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <ActivityCenter 
            notifications={notifications} 
            onClose={() => setShowActivityCenter(false)} 
            onNavigate={(tab) => { setActiveTab(tab); setShowActivityCenter(false); }}
          />
        </div>
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
