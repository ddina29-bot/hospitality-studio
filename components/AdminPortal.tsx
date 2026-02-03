
import React from 'react';
import PropertyPortfolio from './management/PropertyPortfolio';
import ClientRegistry from './management/ClientRegistry';
import StaffHub from './management/StaffHub';
import SchedulingCenter from './management/SchedulingCenter';
import { Property, Client, User, Shift, TabType } from '../types';

interface AdminPortalProps {
  user: User;
  view: string;
  properties?: Property[];
  setProperties?: React.Dispatch<React.SetStateAction<Property[]>>;
  clients?: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  users?: User[];
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  shifts?: Shift[];
  setShifts?: React.Dispatch<React.SetStateAction<Shift[]>>;
  setActiveTab: (tab: TabType) => void;
  setSelectedClientIdFilter: (id: string | null) => void;
  selectedPropertyIdToEdit?: string | null;
  setSelectedPropertyIdToEdit?: (id: string | null) => void;
  onSelectPropertyToEdit?: (id: string) => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ 
  user, view, properties = [], setProperties, clients = [], setClients, 
  users = [], setUsers, shifts = [], setShifts,
  setActiveTab, setSelectedClientIdFilter,
  selectedPropertyIdToEdit, setSelectedPropertyIdToEdit, onSelectPropertyToEdit
}) => {
  if (view === 'properties' && setProperties && setClients) return (
    <PropertyPortfolio 
      properties={properties} 
      setProperties={setProperties} 
      clients={clients} 
      setClients={setClients}
      user={user}
      selectedPropertyIdToEdit={selectedPropertyIdToEdit}
      setSelectedPropertyIdToEdit={setSelectedPropertyIdToEdit}
    />
  );
  if (view === 'clients' && setClients) return (
    <ClientRegistry 
      clients={clients} 
      setClients={setClients} 
      properties={properties} 
      setActiveTab={setActiveTab} 
      setSelectedClientIdFilter={setSelectedClientIdFilter} 
      onSelectPropertyToEdit={onSelectPropertyToEdit}
    />
  );
  if (view === 'users' && setUsers) return <StaffHub users={users} setUsers={setUsers} />;
  if (view === 'scheduling' && setShifts) return <SchedulingCenter shifts={shifts} setShifts={setShifts} properties={properties} users={users} setActiveTab={setActiveTab} />;
  
  return <div className="p-20 text-center opacity-10 font-black uppercase tracking-[0.5em]">Module Initializing...</div>;
};

export default AdminPortal;
