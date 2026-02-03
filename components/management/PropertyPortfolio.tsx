
import React, { useState, useEffect } from 'react';
import { Property, Client, User } from '../../types';
import { uploadFile } from '../../services/storageService';

interface PropertyPortfolioProps {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  user: User;
  selectedPropertyIdToEdit?: string | null;
  setSelectedPropertyIdToEdit?: (id: string | null) => void;
}

type ModalTab = 'general' | 'access' | 'inventory' | 'finance' | 'media';

const PropertyPortfolio: React.FC<PropertyPortfolioProps> = ({ 
  properties, setProperties, clients, setClients, user, selectedPropertyIdToEdit, setSelectedPropertyIdToEdit 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('general');
  
  const isHousekeeping = user.role === 'housekeeping';
  const isAdmin = user.role === 'admin';

  const initialForm: Partial<Property> = {
    name: '', type: 'Apartment', clientId: '', address: '', apartmentNumber: '', floorNumber: '',
    lat: undefined, lng: undefined,
    entrancePhoto: '', keyboxPhoto: '', kitchenPhoto: '', livingRoomPhoto: '', welcomePackPhoto: '',
    roomPhotos: [], bathroomPhotos: [], keyboxCode: '', mainEntranceCode: '',
    accessNotes: '', rooms: 1, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 0, sofaBeds: 0,
    pillows: 2, hasBabyCot: false, capacity: 2,
    hasDishwasher: false, hasCoffeeMachine: false, coffeeMachineType: '', 
    clientPrice: 0, cleanerPrice: 0, status: 'active', specialRequests: []
  };

  const [form, setForm] = useState<Partial<Property>>(initialForm);

  useEffect(() => {
    if (selectedPropertyIdToEdit) {
      const prop = properties.find(p => p.id === selectedPropertyIdToEdit);
      if (prop) {
        setForm(prop);
        setEditingId(prop.id);
        setShowModal(true);
        setActiveTab('general');
      }
      if (setSelectedPropertyIdToEdit) setSelectedPropertyIdToEdit(null);
    }
  }, [selectedPropertyIdToEdit, properties, setSelectedPropertyIdToEdit]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setProperties(prev => prev.map(p => {
        if (p.id === editingId) {
          if (isHousekeeping) {
            // Housekeeping can ONLY update these specific fields
            return { 
              ...p, 
              mainEntranceCode: form.mainEntranceCode,
              apartmentNumber: form.apartmentNumber,
              keyboxCode: form.keyboxCode 
            };
          }
          return { ...p, ...form };
        }
        return p;
      }));
    } else if (!isHousekeeping) {
      setProperties(prev => [{ ...form, id: `p-${Date.now()}` } as Property, ...prev]);
    }
    setShowModal(false);
    setEditingId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (isHousekeeping) return; // Prevent upload for housekeeping
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm({ ...form, [field]: url });
  };

  const labelStyle = "text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-semibold outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-teal-50 transition-all disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";

  const renderTabContent = () => {
    switch(activeTab) {
      case 'general': return (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className={labelStyle}>Apartment Name</label>
              <input className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isHousekeeping} />
            </div>
            <div>
              <label className={labelStyle}>Apartment Type</label>
              <select className={inputStyle} value={form.type} onChange={e => setForm({...form, type: e.target.value as any})} disabled={isHousekeeping}>
                <option>Apartment</option><option>Penthouse</option><option>Villa</option><option>Studio</option>
              </select>
            </div>
          </div>
        </div>
      );
      case 'access': return (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={labelStyle}>Apt # (Editable)</label><input className={`${inputStyle} !bg-white border-teal-300`} value={form.apartmentNumber} onChange={e => setForm({...form, apartmentNumber: e.target.value})} /></div>
            <div><label className={labelStyle}>Floor</label><input className={inputStyle} value={form.floorNumber} onChange={e => setForm({...form, floorNumber: e.target.value})} disabled={isHousekeeping} /></div>
            <div><label className={labelStyle}>Ent. Code (Editable)</label><input className={`${inputStyle} !bg-white border-teal-300`} value={form.mainEntranceCode} onChange={e => setForm({...form, mainEntranceCode: e.target.value})} /></div>
            <div><label className={labelStyle}>Keybox Code (Editable)</label><input className={`${inputStyle} !bg-white border-teal-300`} value={form.keyboxCode} onChange={e => setForm({...form, keyboxCode: e.target.value})} /></div>
          </div>
          <div>
            <label className={labelStyle}>Full Address</label>
            <input className={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} disabled={isHousekeeping} />
          </div>
        </div>
      );
      case 'inventory': return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
          <div><label className={labelStyle}>Rooms</label><input type="number" className={inputStyle} value={form.rooms} onChange={e => setForm({...form, rooms: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
          <div><label className={labelStyle}>Baths</label><input type="number" className={inputStyle} value={form.bathrooms} onChange={e => setForm({...form, bathrooms: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
        </div>
      );
      case 'media': return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {['entrancePhoto', 'kitchenPhoto', 'livingRoomPhoto'].map(pic => (
            <div key={pic} className="space-y-2">
              <label className={labelStyle}>{pic.replace('Photo', '')}</label>
              <div className={`w-full h-32 bg-slate-100 rounded-2xl overflow-hidden border border-dashed border-slate-300 flex items-center justify-center ${!isHousekeeping ? 'cursor-pointer hover:border-teal-500 transition-all' : ''}`} onClick={() => !isHousekeeping && document.getElementById(pic)?.click()}>
                {(form as any)[pic] ? <img src={(form as any)[pic]} className="w-full h-full object-cover" /> : <span className="text-xl text-slate-300">+</span>}
                <input type="file" id={pic} className="hidden" onChange={e => handleFileUpload(e, pic)} disabled={isHousekeeping} />
              </div>
            </div>
          ))}
        </div>
      );
      case 'finance': return (
        <div className="p-10 text-center bg-red-50 rounded-3xl border border-red-100">
          <p className="text-xs font-black text-red-600 uppercase tracking-widest">Confidential Financial Data: Access Denied</p>
        </div>
      );
      default: return null;
    }
  };

  const tabs: ModalTab[] = ['general', 'access', 'inventory', 'media'];
  if (!isHousekeeping) tabs.push('finance');

  return (
    <div className="space-y-8 text-left pb-24 animate-in fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Portfolio</h2>
          <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest mt-1">Registry Monitor</p>
        </div>
        {!isHousekeeping && (
          <button onClick={() => { setForm(initialForm); setEditingId(null); setShowModal(true); }} className="btn-teal px-8 py-3.5 shadow-xl shadow-teal-900/10 uppercase text-[11px] font-black tracking-widest">+ Register</button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.map(p => (
          <div key={p.id} className="soft-card overflow-hidden group hover:shadow-2xl transition-all duration-500 bg-white border border-slate-100 p-8 space-y-6">
             <div className="h-48 bg-slate-100 rounded-2xl overflow-hidden relative">
                <img src={p.entrancePhoto || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80'} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 bg-teal-600 px-3 py-1 rounded-full text-[8px] font-black text-white uppercase">{p.type}</div>
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase truncate">{p.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase truncate">{p.address}</p>
             </div>
             <button onClick={() => { setForm(p); setEditingId(p.id); setShowModal(true); setActiveTab('general'); }} className="w-full py-3.5 bg-teal-50 border border-teal-100 text-teal-700 font-black text-[9px] uppercase tracking-widest rounded-2xl hover:bg-teal-100 transition-all">
                {isHousekeeping ? 'Update Access' : 'Configure Unit'}
             </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-5xl h-fit min-h-[70vh] shadow-2xl relative my-auto animate-in zoom-in-95 flex flex-col md:flex-row overflow-hidden border border-slate-100">
             <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-8 space-y-2 shrink-0">
                <div className="mb-10"><h2 className="text-xl font-bold text-slate-900 uppercase">Unit Ops</h2><p className="text-[9px] text-teal-600 font-bold uppercase">Protocol v4.0</p></div>
                {tabs.map(tab => (
                   <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-teal-700 shadow-lg translate-x-2' : 'text-slate-400 hover:text-slate-600'}`}>{tab}</button>
                ))}
             </div>
             <div className="flex-1 flex flex-col min-h-0 bg-white">
                <form onSubmit={handleSave} className="flex-1 flex flex-col p-10 md:p-14">
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">{renderTabContent()}</div>
                   <div className="pt-10 border-t border-slate-100 flex justify-end gap-3">
                      <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Close</button>
                      <button type="submit" className="bg-[#0D9488] text-white px-12 py-4 rounded-2xl shadow-xl text-xs font-black uppercase tracking-[0.2em] active:scale-95 transition-all hover:bg-teal-700">Save Protocol</button>
                   </div>
                </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyPortfolio;
