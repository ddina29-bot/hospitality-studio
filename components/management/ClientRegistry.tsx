
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
  clients, setClients, properties, setActiveTab, setSelectedClientIdFilter, onSelectPropertyToEdit
}) => {
  const [search, setSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ name: '', contactEmail: '', billingAddress: '', vatNumber: '', phone: '' });
  
  // Sub-view state for properties list
  const [viewingClientProperties, setViewingClientProperties] = useState<Client | null>(null);

  const filtered = useMemo(() => 
    clients.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.contactEmail.toLowerCase().includes(search.toLowerCase())
    ), 
    [clients, search]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setClients(prev => prev.map(c => c.id === editingId ? { ...c, ...form } as Client : c));
    } else {
      setClients(prev => [...prev, { ...form, id: `c-${Date.now()}`, propertyIds: [], status: 'active' } as Client]);
    }
    setShowModal(false);
    setEditingId(null);
  };

  const navigateToPropertyEdit = (propertyId: string) => {
    if (onSelectPropertyToEdit) {
      onSelectPropertyToEdit(propertyId);
    } else {
      setActiveTab('properties');
    }
  };

  const labelStyle = "text-[7px] font-black text-teal-600 uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all placeholder:text-slate-300";

  // RENDER: Properties List View for a selected client
  if (viewingClientProperties) {
    const clientProps = properties.filter(p => p.clientId === viewingClientProperties.id);
    const filteredClientProps = clientProps.filter(p => 
      p.name.toLowerCase().includes(propertySearch.toLowerCase()) || 
      p.address.toLowerCase().includes(propertySearch.toLowerCase())
    );
    
    return (
      <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 text-left pb-24">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex-1">
            <button 
              onClick={() => { setViewingClientProperties(null); setPropertySearch(''); }}
              className="flex items-center gap-2 text-teal-600 hover:text-teal-700 transition-colors mb-4 group"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:-translate-x-1 transition-transform">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Registry</span>
            </button>
            <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight leading-none">{viewingClientProperties.name}</h2>
            <p className="text-[9px] font-bold text-teal-600 uppercase tracking-[0.3em] mt-2 opacity-80">Portfolio: {clientProps.length} Asset Units</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="SEARCH APARTMENTS..." 
              className="w-full bg-slate-50 border border-slate-100 rounded-full px-5 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-teal-400 transition-all placeholder:text-slate-300 pr-10 shadow-sm" 
              value={propertySearch} 
              onChange={e => setPropertySearch(e.target.value)} 
            />
            <div className="absolute right-4 top-3.5 text-slate-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
        </header>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-teal-50/50 border-b border-teal-100">
                <tr>
                  <th className="px-10 py-6 text-[10px] font-black text-teal-700 uppercase tracking-widest">Property Designation</th>
                  <th className="px-10 py-6 text-[10px] font-black text-teal-700 uppercase tracking-widest">Location / Address</th>
                  <th className="px-10 py-6 text-[10px] font-black text-teal-700 uppercase tracking-widest text-right">Inventory Spec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredClientProps.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-10 py-32 text-center text-slate-300 italic text-[11px] uppercase font-black tracking-widest">
                      {clientProps.length === 0 ? "No properties assigned to this client yet." : "No apartments match your search criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredClientProps.map(prop => (
                    <tr 
                      key={prop.id} 
                      onClick={() => navigateToPropertyEdit(prop.id)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-all group"
                    >
                      <td className="px-10 py-8">
                        <span className="text-base font-bold text-slate-900 uppercase group-hover:text-teal-700 transition-colors block">{prop.name}</span>
                        <div className="text-[9px] font-black text-teal-500 uppercase tracking-widest mt-1.5 opacity-70">{prop.type}</div>
                      </td>
                      <td className="px-10 py-8">
                        <span className="text-xs font-semibold text-slate-500 uppercase leading-relaxed max-w-xs block">{prop.address}</span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="inline-flex gap-2">
                           <span className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-tighter shadow-sm group-hover:bg-white transition-colors">
                            {prop.rooms} Rooms • {prop.bathrooms} Baths • {prop.capacity} Cap
                           </span>
                           <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                           </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Main Client Registry Grid
  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight leading-none">STUDIO PARTNER REGISTRY</h2>
          <p className="text-[9px] font-bold text-teal-600 uppercase tracking-[0.4em] mt-2 opacity-80">Corporate Client Ledger</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="SEARCH CLIENTS..." 
              className="w-full bg-slate-50 border border-slate-100 rounded-full px-5 py-2.5 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-teal-400 transition-all placeholder:text-slate-300 pr-10" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <div className="absolute right-4 top-3 text-slate-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
          <button 
            onClick={() => { setForm({ name: '', contactEmail: '', billingAddress: '', vatNumber: '', phone: '' }); setEditingId(null); setShowModal(true); }} 
            className="btn-teal px-8 py-2.5 shadow-xl shadow-teal-900/10 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap"
          >
            ADD CLIENT
          </button>
        </div>
      </header>

      {/* Changed lg:grid-cols-3 to lg:grid-cols-2 as requested */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {filtered.map(client => (
          <div key={client.id} className="bg-white border border-teal-100 rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            {/* Header Content Section */}
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[1.5rem] bg-white border border-teal-50 flex items-center justify-center font-bold text-3xl text-[#0D9488] shrink-0 shadow-sm transition-transform group-hover:scale-105">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-slate-900 uppercase truncate leading-tight tracking-tight">{client.name}</h3>
                <p className="text-[#0D9488] font-bold uppercase tracking-widest text-[11px] truncate mt-1">{client.contactEmail}</p>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest truncate mt-1">{client.billingAddress}</p>
              </div>
            </div>

            {/* Actions & Asset Count Block */}
            <div className="flex items-center gap-4 pt-2">
              {/* Assets Counter Box - Restyled to match screenshot */}
              <div className="bg-white px-6 py-4 rounded-3xl border border-teal-100 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">Assets</p>
                <p className="text-2xl font-bold text-slate-900 leading-none">
                  {properties.filter(p => p.clientId === client.id).length}
                </p>
              </div>

              {/* Action Buttons Row - Labels simplified as requested */}
              <div className="flex-1 flex gap-3 h-16">
                <button 
                  onClick={() => { setForm(client); setEditingId(client.id); setShowModal(true); }} 
                  className="flex-1 bg-white border border-slate-100 text-slate-400 font-black px-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  Manage
                </button>
                <button 
                  onClick={() => { setViewingClientProperties(client); }} 
                  className="flex-1 bg-[#0D9488] text-white font-black px-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-teal-700 transition-all shadow-lg active:scale-95"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 space-y-8 text-left shadow-2xl my-auto animate-in zoom-in-95">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                 <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{editingId ? 'Refine Partner' : 'New Client Registry'}</h2>
                 <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.4em]">Corporate Ledger Access</p>
               </div>
               <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-900 transition-colors text-2xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1">
                <label className={labelStyle}>Partner Name</label>
                <input required className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.G. ELITE REALTY" />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>Official Email</label>
                <input required type="email" className={inputStyle} value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} placeholder="OPS@COMPANY.COM" />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>Billing Address</label>
                <input required className={inputStyle} value={form.billingAddress} onChange={e => setForm({...form, billingAddress: e.target.value})} placeholder="STREET, TOWN" />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>VAT / Tax Identity</label>
                <input className={inputStyle} value={form.vatNumber} onChange={e => setForm({...form, vatNumber: e.target.value})} placeholder="MT 00000000" />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="submit" className="flex-[2] btn-teal py-4 shadow-xl shadow-teal-900/10 uppercase tracking-[0.2em] text-[10px] font-black">SAVE PARTNER FILE</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-50 border border-slate-100 text-slate-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRegistry;
