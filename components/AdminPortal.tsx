
import React from 'react';
import { User, Client, Property, UserRole, Shift, TabType, SupplyItem, SupplyRequest, AuditReport, LeaveRequest } from '../types';
import ClientRegistry from './management/ClientRegistry';
import PropertyPortfolio from './management/PropertyPortfolio';
import HumanCapitalStudio from './management/HumanCapitalStudio';
import SchedulingCenter from './management/SchedulingCenter';
import InventoryAdmin from './management/InventoryAdmin';

interface AdminPortalProps {
  view: 'scheduling' | 'finance' | 'properties' | 'users' | 'inventory' | 'clients';
  role?: UserRole;
  users?: User[];
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  clients?: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  properties?: Property[];
  setProperties?: React.Dispatch<React.SetStateAction<Property[]>>;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  inventoryItems?: SupplyItem[];
  setInventoryItems?: React.Dispatch<React.SetStateAction<SupplyItem[]>>;
  supplyRequests?: SupplyRequest[];
  setSupplyRequests?: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  setActiveTab?: (tab: TabType) => void;
  selectedClientIdFilter?: string | null;
  setSelectedClientIdFilter?: (id: string | null) => void;
  onPreviewActivation?: (user: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  setAuditReports?: React.Dispatch<React.SetStateAction<AuditReport[]>>;
  leaveRequests?: LeaveRequest[];
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => void;
  initialSelectedShiftId?: string | null;
  onShiftSelected?: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  view, 
  users = [], 
  setUsers = (_) => {}, 
  clients = [], 
  setClients = (_) => {}, 
  properties = [], 
  setProperties = (_) => {}, 
  shifts = [],
  setShifts = (_) => {},
  inventoryItems = [],
  setInventoryItems = (_) => {},
  supplyRequests = [],
  setSupplyRequests = (_) => {},
  setActiveTab,
  selectedClientIdFilter,
  setSelectedClientIdFilter,
  onPreviewActivation,
  showToast,
  setAuditReports,
  leaveRequests = [],
  onUpdateLeaveStatus,
  initialSelectedShiftId,
  onShiftSelected
}) => {
  if (view === 'clients') {
    return (
      <ClientRegistry 
        clients={clients} 
        setClients={setClients} 
        properties={properties} 
        setActiveTab={setActiveTab || (() => {})} 
        setSelectedClientIdFilter={setSelectedClientIdFilter || (() => {})} 
      />
    );
  }

  if (view === 'properties') {
    return (
      <PropertyPortfolio 
        properties={properties} 
        setProperties={setProperties} 
        clients={clients} 
        setClients={setClients}
        selectedClientIdFilter={selectedClientIdFilter || null} 
        setSelectedClientIdFilter={setSelectedClientIdFilter || (() => {})} 
      />
    );
  }

  if (view === 'users') {
    return (
      <HumanCapitalStudio 
        users={users} 
        setUsers={setUsers} 
        leaveRequests={leaveRequests}
        onUpdateLeaveStatus={onUpdateLeaveStatus}
        onPreviewActivation={onPreviewActivation}
        showToast={showToast}
      />
    );
  }

  if (view === 'scheduling') {
    return (
      <SchedulingCenter 
        shifts={shifts} 
        setShifts={setShifts} 
        properties={properties} 
        users={users} 
        showToast={showToast}
        setAuditReports={setAuditReports}
        leaveRequests={leaveRequests}
        initialSelectedShiftId={initialSelectedShiftId}
        onConsumedDeepLink={onShiftSelected}
        setActiveTab={setActiveTab}
      />
    );
  }

  if (view === 'inventory') {
    return (
      <InventoryAdmin 
        inventoryItems={inventoryItems}
        setInventoryItems={setInventoryItems}
        supplyRequests={supplyRequests}
        setSupplyRequests={setSupplyRequests}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="p-20 text-center opacity-10 italic text-[10px] tracking-[0.5em]">
       TELEMETRY SYNCHRONIZED. MODULE {view.toUpperCase()} ACTIVE.
    </div>
  );
};

export default AdminPortal;
