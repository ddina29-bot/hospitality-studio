
import React, { useState, useMemo } from 'react';
import { Client, Property, TabType } from '../../types';

interface ClientRegistryProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  properties: Property[];
  setActiveTab: (tab: TabType) => void;
  setSelectedClientIdFilter: (id: string | null) => void;
  onSelectPropertyToEdit?: (id: string) => void;
}

const ClientRegistry: React.FC<ClientRegistryProps> = ({ 
  clients = [], setClients, properties = [], setActiveTab, onSelectPropertyToEdit
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => 
    (clients ?? []).filter(c => 
      c?.name?.toLowerCase().includes(search.toLowerCase()) || 
      c?.contactEmail?.toLowerCase().includes(search.toLowerCase())
    ), 
    [clients, search]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight leading-none">STUDIO PARTNER REGISTRY</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2">Database of property owners and corporate partners.</p>
        </div>
        <div className="relative w-full md:w-64">
          <input type="text" placeholder="SEARCH..." className="w-full bg-slate-50 border border-slate-100 rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center opacity-10 uppercase italic font-black text-[11px]">No partners recorded in registry</div>
        ) : filtered.map(client => (
          <div key={client.id} className="bg-white border border-teal-100 rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-sm hover:shadow-xl transition-all">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[1.5rem] bg-white border border-teal-50 flex items-center justify-center font-bold text-3xl text-[#0D9488] shrink-0 shadow-sm">
                {client.name?.charAt(0).toUpperCase() ?? 'P'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-slate-900 uppercase truncate leading-tight tracking-tight">{client.name ?? 'Unnamed Partner'}</h3>
                <p className="text-[#0D9488] font-bold uppercase tracking-widest text-[11px] truncate mt-1">{client.contactEmail ?? 'no email'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="bg-white px-6 py-4 rounded-3xl border border-teal-100 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">Assets</p>
                <p className="text-2xl font-bold text-slate-900 leading-none">
                  {(properties ?? []).filter(p => p?.clientId === client?.id).length}
                </p>
              </div>
              <div className="flex-1 flex gap-3 h-16">
                <button className="flex-1 bg-[#0D9488] text-white font-black px-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-lg active:scale-95">View Profile</button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default ClientRegistry;
