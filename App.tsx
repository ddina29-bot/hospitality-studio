
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import EmployeeWorksheet from './components/EmployeeWorksheet';
import Login from './components/Login';
import Signup from './components/Signup';
import UserActivation from './components/UserActivation';
import ActivityCenter from './components/ActivityCenter';
import { TabType, Shift, User, Client, Property, Invoice, TimeEntry, Tutorial, UserRole, OrganizationSettings, SupplyItem, SupplyRequest, AnomalyReport, ManualTask, LeaveRequest, AppNotification, LeaveType } from './types';

const load = <T,>(k: string, f: T): T => {
  if (typeof window === 'undefined') return f;
  const s = localStorage.getItem(k);
  if (!s) return f;
  try { return JSON.parse(s); } catch (e) { return f; }
};

const safeSave = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Storage limit reached for ${key}`);
  }
};

const App: React.FC = () => {
  const [activationToken, setActivationToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('code');
  });

  const [user, setUser] = useState<User | null>(() => load('current_user_obj', null));
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('current_org_id'));
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('studio_active_tab') as TabType) || 'dashboard');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showActivityCenter, setShowActivityCenter] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const [users, setUsers] = useState<User[]>(() => load('studio_users', []));
  const [shifts, setShifts] = useState<Shift[]>(() => load('studio_shifts', []));
  const [properties, setProperties] = useState<Property[]>(() => load('studio_props', []));
  const [clients, setClients] = useState<Client[]>(() => load('studio_clients', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('studio_invoices', []));
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => load('studio_time_entries', []));
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>(() => load('studio_inventory', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(() => load('studio_supply_requests', []));
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(() => load('studio_manual_tasks', []));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => load('studio_leave_requests', []));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => load('studio_notifications', []));
  const [organization, setOrganization] = useState<OrganizationSettings>(() => load('studio_org_settings', { id: 'org-1', name: 'STUDIO', address: '', email: '', phone: '' }));
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateState = useCallback(async (email: string) => {
    if (!email || email === 'build@reset.studio') return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/state?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success && data.organization) {
        const org = data.organization;
        setOrgId(org.id);
        if (org.users) setUsers(org.users);
        if (org.shifts) setShifts(org.shifts);
        if (org.properties) setProperties(org.properties);
        if (org.clients) setClients(org.clients);
        if (org.invoices) setInvoices(org.invoices);
        if (org.settings) setOrganization(org.settings);
        if (org.manualTasks) setManualTasks(org.manualTasks);
        if (org.leaveRequests) setLeaveRequests(org.leaveRequests);
        if (org.inventoryItems) setInventoryItems(org.inventoryItems);
        if (org.timeEntries) setTimeEntries(org.timeEntries);
        localStorage.setItem('current_org_id', org.id);
        setHasHydrated(true);
      }
    } catch (err) {
      console.warn("Hydration failed, using local fallback.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !hasHydrated && !activationToken) {
      hydrateState(user.email);
    }
  }, [user, hydrateState, hasHydrated, activationToken]);

  useEffect(() => {
    localStorage.setItem('studio_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!user || !orgId || !hasHydrated || user.email === 'build@reset.studio') return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      if (shifts.length === 0 && load('studio_shifts', []).length > 0) return;

      setIsSyncing(true);
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            data: { users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, settings: organization, notifications }
          })
        });
        safeSave('studio_users', users);
        safeSave('studio_shifts', shifts);
        safeSave('studio_props', properties);
        safeSave('studio_clients', clients);
        safeSave('studio_invoices', invoices);
        safeSave('studio_time_entries', timeEntries);
        safeSave('studio_inventory', inventoryItems);
        safeSave('studio_supply_requests', supplyRequests);
        safeSave('studio_manual_tasks', manualTasks);
        safeSave('studio_leave_requests', leaveRequests);
        safeSave('studio_org_settings', organization);
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
    }, 1500);

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [users, shifts, properties, clients, invoices, timeEntries, inventoryItems, supplyRequests, manualTasks, leaveRequests, organization, notifications, user, orgId, hasHydrated]);

  const handleLogin = (u: User, organizationData?: any) => {
    localStorage.removeItem('current_user_obj');
    localStorage.removeItem('cleaner_active_shift_id');
    
    if (organizationData) {
      setOrgId(organizationData.id);
      localStorage.setItem('current_org_id', organizationData.id);
      setUsers(organizationData.users || []);
      setClients(organizationData.clients || []);
      setProperties(organizationData.properties || []);
      setShifts(organizationData.shifts || []);
      setOrganization(organizationData.settings || organization);
      setHasHydrated(true);
    }

    setUser(u);
    safeSave('current_user_obj', u);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setOrgId(null);
    setHasHydrated(false);
    setActiveTab('dashboard');
    setShowMenu(false);
  };

  const handleRequestLeave = (type: LeaveType, start: string, end: string) => {
    if (!user) return;
    const newRequest: LeaveRequest = {
      id: `lr-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      type,
      startDate: start,
      endDate: end,
      status: 'pending'
    };
    setLeaveRequests(prev => [newRequest, ...prev]);
    showToast('Leave request submitted', 'success');
  };

  const handleUpdateLeaveStatus = (id: string, status: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    showToast(`Leave request ${status}`, status === 'approved' ? 'success' : 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (activationToken && !user) {
    return <UserActivation token={activationToken} onActivationComplete={handleLogin} onCancel={() => setActivationToken(null)} />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: '📊', roles: ['admin', 'driver', 'housekeeping', 'hr', 'finance', 'client', 'supervisor', 'cleaner'] },
    { id: 'shifts', label: 'Schedule', icon: '🗓️', roles: ['admin', 'cleaner', 'housekeeping', 'supervisor'] },
    { id: 'worksheet', label: 'Worksheet', icon: '📄', roles: ['cleaner', 'supervisor', 'driver', 'laundry'] },
    { id: 'logistics', label: 'Deliveries', icon: '🚚', roles: ['admin', 'driver', 'housekeeping'] },
    { id: 'laundry', label: 'Laundry', icon: '🧺', roles: ['admin', 'laundry', 'housekeeping'] },
    { id: 'properties', label: 'Portfolio', icon: '🏠', roles: ['admin', 'housekeeping', 'driver'] },
    { id: 'clients', label: 'Partners', icon: '🏢', roles: ['admin'] },
    { id: 'users', label: 'Team', icon: '👥', roles: ['admin', 'hr'] },
    { id: 'finance', label: 'Finance', icon: '💳', roles: ['admin', 'finance'] },
    { id: 'settings', label: user?.role === 'admin' ? 'Studio' : 'My Profile', icon: user?.role === 'admin' ? '⚙️' : '👤', roles: ['admin', 'cleaner', 'driver', 'housekeeping', 'supervisor', 'laundry', 'maintenance'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role || 'admin'));

  const renderTab = () => {
    if (!user) return <Login onLogin={handleLogin} />;
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user!} users={users} setActiveTab={setActiveTab} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} supplyRequests={supplyRequests} setSupplyRequests={setSupplyRequests} manualTasks={manualTasks} setManualTasks={setManualTasks} leaveRequests={leaveRequests} onUpdateLeaveStatus={handleUpdateLeaveStatus} onUpdateUser={setUser} />;
      case 'shifts': 
        if (['admin', 'hr', 'housekeeping'].includes(user!.role)) return <AdminPortal user={user!} view="scheduling" shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} leaveRequests={leaveRequests} />;
        return <CleanerPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} inventoryItems={inventoryItems} onAddSupplyRequest={() => {}} onUpdateUser={setUser} />;
      case 'logistics': return <DriverPortal user={user!} shifts={shifts} setShifts={setShifts} properties={properties} users={users} timeEntries={timeEntries} setTimeEntries={setTimeEntries} />;
      case 'laundry': return <LaundryDashboard user={user!} setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} onTogglePrepared={() => {}} timeEntries={timeEntries} setTimeEntries={setTimeEntries} organization={organization} />;
      case 'properties': return <AdminPortal user={user!} view="properties" properties={properties} setProperties={setProperties} clients={clients} setClients={setClients} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'clients': return <AdminPortal user={user!} view="clients" clients={clients} setClients={setClients} properties={properties} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} />;
      case 'finance': return <FinanceDashboard setActiveTab={setActiveTab} onLogout={handleLogout} shifts={shifts} users={users} properties={properties} invoices={invoices} setInvoices={setInvoices} clients={clients} organization={organization} manualTasks={manualTasks} onUpdateUser={setUser} leaveRequests={leaveRequests} />;
      case 'users': return <AdminPortal user={user!} view="users" users={users} setUsers={setUsers} setActiveTab={setActiveTab} setSelectedClientIdFilter={() => {}} orgId={orgId} leaveRequests={leaveRequests} />;
      case 'settings': 
        return <PersonnelProfile user={user} leaveRequests={leaveRequests} onRequestLeave={handleRequestLeave} shifts={shifts} properties={properties} organization={organization} onUpdateUser={setUser} />;
      case 'worksheet': return <EmployeeWorksheet user={user!} shifts={shifts} properties={properties} />;
      default: return <div className="p-20 text-center opacity-20 uppercase font-black tracking-widest">Module Under Construction</div>;
    }
  };

  return (
    <div className="flex h-screen bg-[#F0FDFA] overflow-hidden w-full selection:bg-teal-100 selection:text-teal-900">
      
      <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-white shrink-0 shadow-2xl relative z-50">
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="font-brand text-2xl text-white tracking-tighter uppercase leading-none truncate max-w-[180px]">
                {organization?.name.split(' ')[0] || 'STUDIO'}
              </h1>
              {organization?.name.split(' ').slice(1).join(' ') && (
                <p className="text-[9px] font-bold text-teal-400 uppercase tracking-[0.25em] mt-2 truncate">
                  {organization.name.split(' ').slice(1).join(' ')}
                </p>
              )}
            </div>
          </div>

          <div className={`px-4 py-2 rounded-xl border transition-all duration-500 flex items-center gap-3 ${isSyncing ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-teal-400 animate-ping' : 'bg-slate-500'}`}></div>
            <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-teal-400' : 'text-slate-50'}`}>
               {isSyncing ? 'Syncing...' : 'Cloud Verified'}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 custom-scrollbar mt-4">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === item.id ? 'bg-[#0D9488] text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 text-xs font-bold uppercase hover:bg-white/5 rounded-2xl transition-colors hover:text-white">
             <span>🚪</span>
             <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative w-full overflow-hidden">
        <header className="md:hidden bg-white border-b border-teal-100 px-5 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
           <div className="flex flex-col">
              <h2 className="font-brand font-bold text-[#1E293B] text-lg leading-none tracking-tighter truncate max-w-[150px]">
                {(organization?.name || 'STUDIO').toUpperCase()}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'SYNCING' : 'VERIFIED'}</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => setShowActivityCenter(true)} className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
               <span className="text-lg">🔔</span>
               {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black">{notifications.length}</span>}
             </button>
             <button onClick={() => setShowMenu(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
               <span className="text-xl">☰</span>
             </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar w-full pb-24 md:pb-10">
          <div className="w-full max-w-[1400px] mx-auto">
            {renderTab()}
          </div>
        </div>

        {showMenu && (
          <div className="fixed inset-0 bg-black/40 z-[200] md:hidden animate-in fade-in" onClick={() => setShowMenu(false)}>
            <div className="absolute top-0 right-0 bottom-0 w-4/5 bg-white shadow-2xl p-8 space-y-8 animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Navigation</h3>
                    <p className="text-[8px] font-bold text-teal-600 uppercase tracking-[0.3em]">Studio Terminal</p>
                  </div>
                  <button onClick={() => setShowMenu(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 text-2xl">&times;</button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-3">
                  {visibleItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id as TabType); setShowMenu(false); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${activeTab === item.id ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
               </div>

               <div className="pt-6 border-t border-slate-100">
                  <button onClick={handleLogout} className="w-full py-4 bg-rose-50 text-rose-600 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-rose-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <span>🚪</span>
                    <span>Exit Session</span>
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>

      {showActivityCenter && (
        <ActivityCenter 
          notifications={notifications} 
          onClose={() => setShowActivityCenter(false)} 
          onNavigate={setActiveTab} 
          userRole={user?.role || 'admin'}
          currentUserId={user?.id || ''}
        />
      )}

      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
          <div className={`px-8 py-3 rounded-2xl shadow-2xl text-white font-black uppercase text-[10px] tracking-widest ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'success' ? 'bg-teal-600' : 'bg-slate-900'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
