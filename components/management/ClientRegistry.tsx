import React, { useState, useMemo } from 'react';
import { Client, Property, TabType } from '../../types';

interface ClientRegistryProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  properties: Property[];
  setActiveTab: (tab: TabType) => void;
  setSelectedClientIdFilter: (id: string | null) => void;
}

const ClientRegistry: React.FC<ClientRegistryProps> = ({ 
  clients, setClients, properties, setActiveTab, setSelectedClientIdFilter 
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ name: '', contactEmail: '', billingAddress: '', vatNumber: '', phone: '' });

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

  const labelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 text-left">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">STUDIO PARTNER REGISTRY</h2>
          <p className="text-[9px] font-bold text-[#8B6B2E] uppercase tracking-[0.3em] mt-1 opacity-60">Corporate Client Ledger</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="SEARCH CLIENTS..." 
              className="w-full bg-white border border-gray-300 rounded-full px-4 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20 pr-10" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <div className="absolute right-3 top-3 text-black/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
          <button 
            onClick={() => { setForm({ name: '', contactEmail: '', billingAddress: '', vatNumber: '', phone: '' }); setEditingId(null); setShowModal(true); }} 
            className="bg-[#C5A059] text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl whitespace-nowrap active:scale-95 transition-all"
          >
            NEW CLIENT
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(client => (
          <div key={client.id} className="bg-[#FDF8EE] p-5 md:p-6 rounded-[32px] border border-[#D4B476]/30 flex flex-col gap-6 shadow-md hover:border-[#C5A059]/40 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/5 border border-[#D4B476]/20 flex items-center justify-center font-serif-brand text-xl text-[#8B6B2E] shrink-0">
                {client.name.charAt(0)}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-serif-brand font-bold text-black uppercase truncate">{client.name}</h3>
                <p className="text-[#8B6B2E] font-black uppercase tracking-widest text-[8px] opacity-60 truncate">{client.contactEmail}</p>
                <p className="text-black/30 text-[7px] uppercase font-black tracking-widest truncate">{client.billingAddress}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch pt-2">
              <div className="bg-white/40 px-4 md:px-6 py-2 md:py-3 rounded-2xl border border-[#D4B476]/10 flex flex-col items-center justify-center min-w-[80px]">
                <p className="text-[7px] font-black text-[#8B6B2E] uppercase tracking-widest mb-0.5 leading-none">Assets</p>
                <p className="text-lg md:text-xl font-serif-brand font-bold text-black leading-none">
                  {properties.filter(p => p.clientId === client.id).length}
                </p>
              </div>
              <div className="flex-1 flex gap-2">
                <button 
                  onClick={() => { setForm(client); setEditingId(client.id); setShowModal(true); }} 
                  className="flex-1 bg-white border border-gray-300 text-black/60 font-black px-3 py-2.5 rounded-xl uppercase text-[8px] tracking-widest hover:bg-white/10 transition-all active:scale-95"
                >
                  Manage
                </button>
                <button 
                  onClick={() => { setSelectedClientIdFilter(client.id); setActiveTab('properties'); }} 
                  className="flex-1 bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#8B6B2E] font-black px-3 py-2.5 rounded-xl uppercase text-[8px] tracking-widest hover:bg-[#C5A059]/20 transition-all active:scale-95"
                >
                  View Units
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[32px] w-full max-w-md p-6 md:p-8 space-y-6 md:space-y-8 text-left shadow-2xl my-auto">
            <h2 className="text-xl md:text-2xl font-serif-brand font-bold text-black uppercase">{editingId ? 'Edit Ledger' : 'New Client'}</h2>
            <form onSubmit={handleSave} className="space-y-4 md:space-y-5">
              <div className="space-y-1">
                <label className={labelStyle}>Company Name</label>
                <input required className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>Email</label>
                <input required type="email" className={inputStyle} value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>Billing Address</label>
                <input required className={inputStyle} value={form.billingAddress} onChange={e => setForm({...form, billingAddress: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className={labelStyle}>VAT / Tax ID</label>
                <input className={inputStyle} value={form.vatNumber} onChange={e => setForm({...form, vatNumber: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-[#C5A059] text-black font-black py-4 rounded-xl uppercase tracking-[0.3em] text-[10px] shadow-lg active:scale-95 transition-all">Save</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border border-gray-300 text-black/40 font-black py-4 rounded-xl uppercase text-[10px] tracking-widest active:scale-95">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRegistry;