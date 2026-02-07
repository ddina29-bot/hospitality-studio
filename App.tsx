
import React, { useState } from 'react';
import { User, TabType, Shift, Property, Invoice, Client, OrganizationSettings, ManualTask, TimeEntry, SupplyItem } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CleanerPortal from './components/CleanerPortal';
import FinanceDashboard from './components/dashboards/FinanceDashboard';
import PersonnelProfile from './components/PersonnelProfile';
import EmployeeWorksheet from './components/EmployeeWorksheet';
import StudioSettings from './components/management/StudioSettings';

// Fix: Defining the main App component and its state to resolve "Cannot find name 'activeTab'" errors on lines 45 and 49.
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [organization, setOrganization] = useState<OrganizationSettings>({} as OrganizationSettings);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [inventoryItems, setInventoryItems] = useState<SupplyItem[]>([]);
  const [activeCleanerShiftId, setActiveCleanerShiftId] = useState<string | null>(null);
  const [orgId] = useState<string | null>(null);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('current_user_obj');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const renderContent = () => {
    if (!user) return <div className="p-20 text-center uppercase font-black text-xs opacity-20">Secure Authentication Required...</div>;

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} users={users} shifts={shifts} setShifts={setShifts} properties={properties} invoices={invoices} timeEntries={timeEntries} manualTasks={manualTasks} setManualTasks={setManualTasks} setActiveTab={setActiveTab} onUpdateUser={handleUpdateUser} />;
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
      case 'settings':
        return (
          <div className="space-y-8">
            {user.role === 'admin' && <StudioSettings organization={organization} setOrganization={setOrganization} userCount={users.length} propertyCount={properties.length} currentOrgId={orgId} />}
            <PersonnelProfile user={user} shifts={shifts} properties={properties} organization={organization} onUpdateUser={handleUpdateUser} timeEntries={timeEntries} />
          </div>
        );
      case 'worksheet':
        return <EmployeeWorksheet user={user} shifts={shifts} properties={properties} timeEntries={timeEntries} />;
      default:
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
        return <div className="py-20 text-center opacity-30 uppercase font-black tracking-widest text-xs">Module standby...</div>;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} role={user?.role || 'cleaner'} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
};

// Fix: Adding default export to resolve "Module './App' has no default export" error in index.tsx
export default App;
