
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

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({ name: '', contactEmail: '', billingAddress: '', vatNumber: '' });

  const [specialRequestCatalog, setSpecialRequestCatalog] = useState<string[]>(() => {
    const saved = localStorage.getItem('studio_special_requests');
    return saved ? JSON.parse(saved) : ['Nespresso Vertuo', 'Late Check-out', 'Extra Linen'];
  });
  const [packCatalog, setPackCatalog] = useState<string[]>(() => {
    const saved = localStorage.getItem('studio_pack_catalog');
    return saved ? JSON.parse(saved) : ['Basic Starter', 'Luxury Welcome', 'Beach Bundle'];
  });

  const initialForm: Partial<Property> = {
    name: '', type: 'Apartment', clientId: '', address: '', apartmentNumber: '', floorNumber: '',
    lat: undefined, lng: undefined,
    entrancePhoto: '', keyboxPhoto: '', kitchenPhoto: '', livingRoomPhoto: '', welcomePackPhoto: '',
    roomPhotos: [], bathroomPhotos: [], keyboxCode: '', mainEntranceCode: '',
    accessNotes: '', rooms: 1, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 0, sofaBeds: 0,
    pillows: 2, hasBabyCot: false, capacity: 2,
    hasDishwasher: false, hasCoffeeMachine: false, coffeeMachineType: '', 
    clientPrice: 0, clientRefreshPrice: 0, clientMidStayPrice: 0,
    cleanerPrice: 0, cleanerRefreshPrice: 0, cleanerMidStayPrice: 0,
    cleanerAuditPrice: 0, cleanerCommonAreaPrice: 0, cleanerBedsOnlyPrice: 0,
    status: 'active', specialRequests: [], packType: '', packNotes: ''
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
    
    if (isHousekeeping && editingId) {
      // Housekeeping can ONLY update these specific fields
      setProperties(prev => prev.map(p => p.id === editingId ? { 
        ...p, 
        mainEntranceCode: form.mainEntranceCode,
        apartmentNumber: form.apartmentNumber,
        keyboxCode: form.keyboxCode
      } as Property : p));
    } else if (!isHousekeeping) {
      if (form.packType && !packCatalog.includes(form.packType)) {
        const newCat = [...packCatalog, form.packType];
        setPackCatalog(newCat);
        localStorage.setItem('studio_pack_catalog', JSON.stringify(newCat));
      }

      if (editingId) {
        setProperties(prev => prev.map(p => p.id === editingId ? { ...p, ...form } as Property : p));
      } else {
        setProperties(prev => [{ ...form, id: `p-${Date.now()}` } as Property, ...prev]);
      }
    }
    
    setShowModal(false);
    setForm(initialForm);
    setEditingId(null);
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.contactEmail) return;
    const newClient: Client = { ...clientForm, id: `c-${Date.now()}`, status: 'active', phone: '' } as Client;
    setClients(prev => [...prev, newClient]);
    setForm({ ...form, clientId: newClient.id });
    setShowClientModal(false);
    setClientForm({ name: '', contactEmail: '', billingAddress: '', vatNumber: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string, index?: number) => {
    if (isHousekeeping) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    
    if (field === 'roomPhotos' && index !== undefined) {
      const newPhotos = [...(form.roomPhotos || [])];
      newPhotos[index] = url;
      setForm({ ...form, roomPhotos: newPhotos });
    } else if (field === 'bathroomPhotos' && index !== undefined) {
      const newPhotos = [...(form.bathroomPhotos || [])];
      newPhotos[index] = url;
      setForm({ ...form, bathroomPhotos: newPhotos });
    } else {
      setForm({ ...form, [field]: url });
    }
  };

  const openMap = (type: 'google' | 'apple') => {
    if (!form.address) return;
    const encoded = encodeURIComponent(form.address);
    if (type === 'google') window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    else window.open(`http://maps.apple.com/?q=${encoded}`, '_blank');
  };

  const labelStyle = "text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-semibold outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-teal-50 transition-all placeholder:text-slate-300 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";
  const sectionHeader = "text-[10px] font-black text-[#0D9488] uppercase tracking-[0.3em] border-b border-teal-50 pb-3 mb-6 flex justify-between items-center";

  const renderTabContent = () => {
    switch(activeTab) {
      case 'general': return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={sectionHeader}>
            <span>1. Unit Designation</span>
            {isHousekeeping && <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">READ ONLY</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className={labelStyle}>Apartment Name</label>
              <input required className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.G. SPINOLA LUXURY LOFT" disabled={isHousekeeping} />
            </div>
            <div>
              <label className={labelStyle}>Apartment Type</label>
              <select className={inputStyle} value={form.type} onChange={e => setForm({...form, type: e.target.value as any})} disabled={isHousekeeping}>
                <option>Apartment</option>
                <option>Penthouse</option>
                <option>Villa</option>
                <option>Studio</option>
                <option>Townhouse</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelStyle}>Assigned Client</label>
              <div className="flex gap-3">
                <select required className={`${inputStyle} flex-1`} value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} disabled={isHousekeeping}>
                  <option value="">SELECT PARTNER...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!isHousekeeping && (
                  <button type="button" onClick={() => setShowClientModal(true)} className="w-14 h-14 bg-teal-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg active:scale-95 transition-all">+</button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
      case 'access': return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={sectionHeader}>
            <span>2. Logistics & Access Protocol</span>
          </div>
          <div className="space-y-6">
            <div>
              <label className={labelStyle}>Physical Address {isHousekeeping && <span className="text-[8px] text-amber-600 ml-2">(LOCKED)</span>}</label>
              <input className={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="STREET, TOWN, MALTA" disabled={isHousekeeping} />
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => openMap('google')} className="bg-blue-50 text-blue-600 text-[9px] font-black px-4 py-1.5 rounded-lg border border-blue-100 uppercase">G-Maps</button>
                <button type="button" onClick={() => openMap('apple')} className="bg-slate-50 text-slate-600 text-[9px] font-black px-4 py-1.5 rounded-lg border border-slate-100 uppercase">iOS Maps</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Latitude (GPS)</label>
                <input type="number" step="0.000001" className={inputStyle} value={form.lat || ''} onChange={e => setForm({...form, lat: parseFloat(e.target.value) || undefined})} placeholder="35.xxxx" disabled={isHousekeeping} />
              </div>
              <div>
                <label className={labelStyle}>Longitude (GPS)</label>
                <input type="number" step="0.000001" className={inputStyle} value={form.lng || ''} onChange={e => setForm({...form, lng: parseFloat(e.target.value) || undefined})} placeholder="14.xxxx" disabled={isHousekeeping} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className={labelStyle}>Apt # <span className="text-teal-400 font-black">EDITABLE</span></label><input className={`${inputStyle} !opacity-100 !bg-white border-teal-200`} value={form.apartmentNumber} onChange={e => setForm({...form, apartmentNumber: e.target.value})} /></div>
              <div><label className={labelStyle}>Floor</label><input className={inputStyle} value={form.floorNumber} onChange={e => setForm({...form, floorNumber: e.target.value})} disabled={isHousekeeping} /></div>
              <div><label className={labelStyle}>Ent. Code <span className="text-teal-400 font-black">EDITABLE</span></label><input className={`${inputStyle} !opacity-100 !bg-white border-teal-200`} value={form.mainEntranceCode} onChange={e => setForm({...form, mainEntranceCode: e.target.value})} /></div>
              <div><label className={labelStyle}>Keybox Code <span className="text-teal-400 font-black">EDITABLE</span></label><input className={`${inputStyle} !opacity-100 !bg-white border-teal-200`} value={form.keyboxCode} onChange={e => setForm({...form, keyboxCode: e.target.value})} /></div>
            </div>
            <div>
              <label className={labelStyle}>Handover Instructions</label>
              <textarea className={`${inputStyle} h-32 py-4 resize-none`} value={form.accessNotes} onChange={e => setForm({...form, accessNotes: e.target.value})} placeholder="Personnel logistics notes..." disabled={isHousekeeping} />
            </div>
          </div>
        </div>
      );
      case 'inventory': return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className={sectionHeader}>
            <span>3. Inventory Specification</span>
            {isHousekeeping && <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">READ ONLY</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Structure</p>
              <div><label className={labelStyle}>Rooms</label><input type="number" className={inputStyle} value={form.rooms} onChange={e => setForm({...form, rooms: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
              <div><label className={labelStyle}>Full Baths</label><input type="number" className={inputStyle} value={form.bathrooms} onChange={e => setForm({...form, bathrooms: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
              <div><label className={labelStyle}>Half Baths</label><input type="number" className={inputStyle} value={form.halfBaths} onChange={e => setForm({...form, halfBaths: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
            </div>
            <div className="space-y-6">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sleeping</p>
              <div><label className={labelStyle}>Double Beds</label><input type="number" className={inputStyle} value={form.doubleBeds} onChange={e => setForm({...form, doubleBeds: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
              <div><label className={labelStyle}>Single Beds</label><input type="number" className={inputStyle} value={form.singleBeds} onChange={e => setForm({...form, singleBeds: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
              <div><label className={labelStyle}>Sofa Beds</label><input type="number" className={inputStyle} value={form.sofaBeds} onChange={e => setForm({...form, sofaBeds: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
            </div>
            <div className="space-y-6">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Essentials</p>
              <div><label className={labelStyle}>Pillows</label><input type="number" className={inputStyle} value={form.pillows} onChange={e => setForm({...form, pillows: parseInt(e.target.value)})} disabled={isHousekeeping} /></div>
              <div className="flex flex-col gap-4">
                <label className={`flex items-center gap-3 ${isHousekeeping ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><input type="checkbox" className="w-5 h-5 accent-[#0D9488]" checked={form.hasBabyCot} onChange={e => setForm({...form, hasBabyCot: e.target.checked})} disabled={isHousekeeping} /><span className="text-xs font-bold text-slate-600">Baby Cot</span></label>
                <label className={`flex items-center gap-3 ${isHousekeeping ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><input type="checkbox" className="w-5 h-5 accent-[#0D9488]" checked={form.hasDishwasher} onChange={e => setForm({...form, hasDishwasher: e.target.checked})} disabled={isHousekeeping} /><span className="text-xs font-bold text-slate-600">Dishwasher</span></label>
                <label className={`flex items-center gap-3 ${isHousekeeping ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><input type="checkbox" className="w-5 h-5 accent-[#0D9488]" checked={form.hasCoffeeMachine} onChange={e => setForm({...form, hasCoffeeMachine: e.target.checked})} disabled={isHousekeeping} /><span className="text-xs font-bold text-slate-600">Coffee Hub</span></label>
                {form.hasCoffeeMachine && <input className={inputStyle} value={form.coffeeMachineType} onChange={e => setForm({...form, coffeeMachineType: e.target.value})} placeholder="Machine Model..." disabled={isHousekeeping} />}
              </div>
            </div>
          </div>
        </div>
      );
      case 'media': return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
           <div className={sectionHeader}>
             <span>5. Reference Library</span>
             {isHousekeeping && <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">READ ONLY</span>}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { field: 'entrancePhoto', label: 'Entrance' },
                { field: 'keyboxPhoto', label: 'Keybox' },
                { field: 'kitchenPhoto', label: 'Kitchen' },
                { field: 'livingRoomPhoto', label: 'Living Room' },
                { field: 'welcomePackPhoto', label: 'Welcome Pack' }
              ].map(pic => (
                <div key={pic.field} className="space-y-2">
                   <label className={labelStyle}>{pic.label}</label>
                   <div className={`w-full h-32 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative ${!isHousekeeping ? 'cursor-pointer hover:border-teal-400 transition-all' : ''}`} onClick={() => !isHousekeeping && document.getElementById(pic.field)?.click()}>
                      {(form as any)[pic.field] ? <img src={(form as any)[pic.field]} className="w-full h-full object-cover" /> : <span className="text-2xl text-slate-200">+</span>}
                      <input type="file" id={pic.field} className="hidden" onChange={e => handleFileUpload(e, pic.field)} disabled={isHousekeeping} />
                   </div>
                </div>
              ))}
           </div>
        </div>
      );
      default: return null;
    }
  };

  const tabs: ModalTab[] = ['general', 'access', 'inventory', 'media'];
  // Finance is completely omitted from the array for housekeeping
  if (!isHousekeeping) tabs.push('finance');

  return (
    <div className="space-y-10 text-left animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Portfolio</h2>
          <p className="text-sm text-slate-400 font-medium mt-1 uppercase tracking-widest">{properties.length} Active Unit Records</p>
        </div>
        {!isHousekeeping && (
          <button onClick={() => { setForm(initialForm); setEditingId(null); setShowModal(true); setActiveTab('general'); }} className="btn-teal px-8 py-3.5 shadow-xl shadow-teal-900/10 flex items-center gap-3">
            <span className="text-xl leading-none">+</span>
            <span className="uppercase text-[11px] tracking-widest font-black">Register Unit</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties.map(p => (
          <div key={p.id} className="soft-card overflow-hidden group flex flex-col hover:shadow-2xl hover:border-teal-300 transition-all duration-500 bg-white/50">
             <div className="h-64 relative bg-slate-100 overflow-hidden">
                <img src={p.entrancePhoto || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute top-4 left-4 bg-teal-600 px-4 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20 shadow-lg">{p.type}</div>
             </div>
             <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                <div>
                   <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight leading-tight group-hover:text-teal-700 transition-colors">{p.name}</h3>
                   <p className="text-[10px] text-slate-400 font-bold mt-1.5 truncate uppercase tracking-widest">{p.address}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 border-y border-teal-50 py-6 text-center">
                   <div><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Rooms</p><p className="font-bold text-slate-700">{p.rooms}</p></div>
                   <div className="border-x border-teal-50"><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Beds</p><p className="font-bold text-slate-700">{p.doubleBeds + p.singleBeds}</p></div>
                   <div><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Cap.</p><p className="font-bold text-slate-700">{p.capacity}</p></div>
                </div>
                <button onClick={() => { setForm(p); setEditingId(p.id); setShowModal(true); setActiveTab('general'); }} className="w-full py-3.5 bg-teal-50 border border-teal-100 text-teal-700 font-black text-[9px] uppercase tracking-widest rounded-2xl hover:bg-teal-100 transition-all">
                  {isHousekeeping ? 'UPDATE CODES' : 'CONFIGURE'}
                </button>
             </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[3.5rem] w-full max-6xl h-fit min-h-[80vh] shadow-2xl relative my-auto animate-in zoom-in-95 flex flex-col md:flex-row overflow-hidden">
             <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-8 space-y-2 shrink-0">
                <div className="mb-10"><h2 className="text-xl font-bold text-slate-900 tracking-tight uppercase">{editingId ? (isHousekeeping ? 'Access Hub' : 'Edit Asset') : 'Register Unit'}</h2><p className="text-[9px] text-teal-600 font-bold mt-2 uppercase tracking-widest">Ops Protocol v4.0</p></div>
                {tabs.map(tab => (
                   <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-teal-700 shadow-xl shadow-teal-900/5 translate-x-2' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}>{tab}</button>
                ))}
                <div className="pt-20"><button onClick={() => setShowModal(false)} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">Close</button></div>
             </div>
             <div className="flex-1 flex flex-col min-h-0 bg-white">
                <form onSubmit={handleSave} className="flex-1 flex flex-col p-10 md:p-14">
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">{renderTabContent()}</div>
                   <div className="pt-10 border-t border-slate-100 flex justify-end mt-auto">
                      <button type="submit" className="bg-[#0D9488] text-white px-12 py-5 rounded-3xl shadow-2xl shadow-teal-900/20 text-xs font-black uppercase tracking-[0.4em] active:scale-95 transition-all hover:bg-teal-700">
                        {editingId ? 'Save Changes' : 'Register Asset'}
                      </button>
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
