
import React, { useState, useEffect, useMemo } from 'react';
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

type ModalTab = 'general' | 'access' | 'rooms' | 'media' | 'finance';

const PropertyPortfolio: React.FC<PropertyPortfolioProps> = ({ 
  properties, setProperties, clients, setClients, user, selectedPropertyIdToEdit, setSelectedPropertyIdToEdit 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('general');
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isHousekeeping = user.role === 'housekeeping';
  const isDriver = user.role === 'driver';
  const isAdmin = user.role === 'admin';

  const initialForm: Partial<Property> = {
    name: '', type: 'Apartment', clientId: '', address: '', apartmentNumber: '', floorNumber: '',
    lat: undefined, lng: undefined,
    entrancePhoto: '', keyboxPhoto: '', kitchenPhoto: '', livingRoomPhoto: '', welcomePackPhoto: '',
    roomPhotos: [], bathroomPhotos: [],
    keyboxCode: '', mainEntranceCode: '',
    accessNotes: '', rooms: 1, bathrooms: 1, halfBaths: 0, doubleBeds: 1, singleBeds: 0, sofaBeds: 0,
    pillows: 2, hasBabyCot: false, capacity: 2,
    hasDishwasher: false, hasCoffeeMachine: false, coffeeMachineType: '', 
    clientPrice: 0, clientRefreshPrice: 0, clientMidStayPrice: 0,
    cleanerPrice: 0, cleanerRefreshPrice: 0, cleanerMidStayPrice: 0, 
    cleanerAuditPrice: 0, cleanerCommonAreaPrice: 0, cleanerBedsOnlyPrice: 0,
    status: 'active', specialRequests: [],
    packType: '', packNotes: ''
  };

  const [form, setForm] = useState<Partial<Property>>(initialForm);
  const [newClientForm, setNewClientForm] = useState({ name: '', email: '' });

  const filteredProperties = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return properties.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.address.toLowerCase().includes(query)
    );
  }, [properties, searchQuery]);

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
          if (isDriver) {
            return { 
              ...p, 
              lat: form.lat,
              lng: form.lng
            };
          }
          return { ...p, ...form };
        }
        return p;
      }));
    } else {
      setProperties(prev => [{ ...form, id: `p-${Date.now()}` } as Property, ...prev]);
    }
    setShowModal(false);
    setEditingId(null);
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }
    
    setIsLocating(true);
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000, 
      maximumAge: 0
    };

    const successCallback = (position: GeolocationPosition) => {
      setForm(prev => ({
        ...prev,
        lat: parseFloat(position.coords.latitude.toFixed(6)),
        lng: parseFloat(position.coords.longitude.toFixed(6))
      }));
      setIsLocating(false);
      alert("GPS Coordinates Captured Successfully.");
    };

    const errorCallback = (error: GeolocationPositionError) => {
      console.error("GPS Error:", error);
      setIsLocating(false);
      
      let msg = "Geolocation failed. ";
      if (error.code === error.PERMISSION_DENIED) {
        msg += "Permission denied. Please enable 'Location Access' for this site in your phone's browser settings.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg += "Location unavailable. Please ensure your GPS/Location is turned ON in your phone's menu.";
      } else if (error.code === error.TIMEOUT) {
        msg += "Request timed out. Retrying with standard accuracy...";
        navigator.geolocation.getCurrentPosition(successCallback, (err2) => {
          alert("Coarse location also failed. Please check your internet signal.");
        }, { enableHighAccuracy: false, timeout: 10000 });
        return;
      }
      alert(msg);
    };

    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, geoOptions);
  };

  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#1E293B] outline-none focus:border-[#0D9488] transition-all disabled:opacity-50 disabled:bg-slate-50 shadow-sm";

  return (
    <div className="space-y-10 text-left pb-32 animate-in fade-in max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="flex-1">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[10px]">Operations Registry</p>
          <h2 className="text-4xl font-bold text-[#1E293B] tracking-tight uppercase leading-none">Portfolio</h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="SEARCH APARTMENTS..." 
              className="w-full bg-white border border-slate-200 rounded-full px-12 py-3.5 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-400 transition-all shadow-sm" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          {(!isHousekeeping && !isDriver) && (
            <button onClick={() => { setForm(initialForm); setEditingId(null); setShowModal(true); setActiveTab('general'); }} className="btn-teal px-12 py-4 shadow-xl uppercase text-[11px] font-black tracking-widest active:scale-95 transition-all">Add Property</button>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4">
        {filteredProperties.map(p => (
          <div key={p.id} className="group bg-white border border-slate-100 rounded-[2.5rem] p-5 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-xl transition-all duration-300">
               <div className="w-full md:w-32 h-32 rounded-[1.5rem] overflow-hidden shrink-0 shadow-inner bg-slate-50">
                  <img src={p.entrancePhoto || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=300&q=80'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
               </div>
               
               <div className="flex-1 min-w-0 text-center md:text-left space-y-1.5">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h3 className="text-xl font-bold text-[#1E293B] uppercase tracking-tight truncate">{p.name}</h3>
                    <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-teal-100">{p.type}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold uppercase truncate tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {p.address}
                  </p>
               </div>

               <div className="w-full md:w-auto">
                 <button 
                  onClick={() => { setForm(p); setEditingId(p.id); setShowModal(true); setActiveTab(isDriver ? 'access' : 'general'); }} 
                  className="w-full md:px-10 py-4 bg-[#F0FDFA] border border-teal-100 text-[#0D9488] font-black text-[10px] uppercase tracking-[0.3em] rounded-[1.2rem] hover:bg-[#0D9488] hover:text-white transition-all shadow-sm active:scale-95"
                 >
                   {isDriver ? 'Sync GPS' : 'Configuration'}
                 </button>
               </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-fit shadow-2xl relative my-auto animate-in zoom-in-95 flex flex-col overflow-hidden">
             <div className="px-10 pt-8 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/50">
                <div className="flex justify-between items-start">
                   <h2 className="text-2xl font-bold text-[#1E293B] uppercase tracking-tighter leading-none">Property Configuration</h2>
                   <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-900 text-3xl">&times;</button>
                </div>
                <nav className="flex gap-2 overflow-x-auto no-scrollbar -mb-px">
                   {['general', 'access', 'rooms', 'media', 'finance'].map(tab => {
                      if (isDriver && tab !== 'access' && tab !== 'general') return null;
                      return (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white border-x border-t border-slate-100 text-[#0D9488]' : 'text-slate-400'}`}>
                           {tab}
                        </button>
                      );
                   })}
                </nav>
             </div>

             <form onSubmit={handleSave} className="p-8 md:p-10 space-y-8">
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <label className={labelStyle}>Apartment Name</label>
                      <input className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isHousekeeping || isDriver} />
                    </div>
                  </div>
                )}
                {activeTab === 'access' && (
                  <div className="space-y-6">
                    <div>
                      <label className={labelStyle}>Physical Address</label>
                      <input className={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} disabled={isHousekeeping || isDriver} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                       <button type="button" onClick={captureCurrentLocation} disabled={isLocating} className="flex-1 bg-teal-50 border border-teal-200 text-teal-700 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-100 transition-all shadow-md">
                          {isLocating ? 'Capturing...' : 'Capture GPS Pin'}
                       </button>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelStyle}>Latitude</label>
                            <input type="number" step="any" className={inputStyle} value={form.lat || ''} onChange={e => setForm({...form, lat: parseFloat(e.target.value)})} disabled={isHousekeeping} />
                          </div>
                          <div>
                            <label className={labelStyle}>Longitude</label>
                            <input type="number" step="any" className={inputStyle} value={form.lng || ''} onChange={e => setForm({...form, lng: parseFloat(e.target.value)})} disabled={isHousekeeping} />
                          </div>
                       </div>
                    </div>
                  </div>
                )}
                <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                   <button type="button" onClick={() => setShowModal(false)} className="px-6 py-4 text-[10px] font-black text-slate-300 uppercase">Discard</button>
                   <button type="submit" className="bg-[#0D9488] text-white px-12 py-4 rounded-xl shadow-xl text-[11px] font-black uppercase tracking-[0.3em]">Save Property</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyPortfolio;
