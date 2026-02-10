
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

  const existingPackTypes = useMemo(() => {
    const packs = properties.map(p => p.packType).filter(Boolean) as string[];
    const standardPacks = ['Basic Essentials Pack', 'Full Hospitality Suite', 'Child-Friendly Setup', 'Eco-Friendly Protocol'];
    return Array.from(new Set([...standardPacks, ...packs])).sort();
  }, [properties]);

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
          if (isHousekeeping) {
            return { 
              ...p, 
              mainEntranceCode: form.mainEntranceCode,
              apartmentNumber: form.apartmentNumber,
              keyboxCode: form.keyboxCode,
              accessNotes: form.accessNotes
            };
          }
          return { ...p, ...form };
        }
        return p;
      }));
    } else if (!isHousekeeping && !isDriver) {
      setProperties(prev => [{ ...form, id: `p-${Date.now()}` } as Property, ...prev]);
    }
    setShowModal(false);
    setEditingId(null);
  };

  const handleQuickAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: Client = {
      id: `c-${Date.now()}`,
      name: newClientForm.name,
      contactEmail: newClientForm.email,
      phone: '',
      billingAddress: '',
      status: 'active'
    };
    setClients(prev => [...prev, newClient]);
    setForm(prev => ({ ...prev, clientId: newClient.id }));
    setShowNewClientModal(false);
    setNewClientForm({ name: '', email: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (isHousekeeping || isDriver) return; 
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm({ ...form, [field]: url });
  };

  const handleArrayFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'roomPhotos' | 'bathroomPhotos', index: number) => {
    if (isHousekeeping || isDriver) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    const currentArray = [...(form[field] || [])];
    currentArray[index] = url;
    setForm({ ...form, [field]: currentArray });
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(prev => ({
          ...prev,
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6))
        }));
        setIsLocating(false);
        alert("GPS Coordinates Captured Successfully.");
      },
      (error) => {
        console.error("Geolocation Error:", error);
        setIsLocating(false);
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            alert("Permission Denied. Please enable Location Services in your browser settings and try again.");
            break;
          case error.POSITION_UNAVAILABLE:
            alert("Location Information Unavailable. Ensure your GPS is turned on.");
            break;
          case error.TIMEOUT:
            alert("Location Request Timed Out. Please check your signal strength and retry.");
            break;
          default:
            alert("An unknown error occurred during GPS capture.");
            break;
        }
      },
      options
    );
  };

  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#1E293B] outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-teal-50 transition-all disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed shadow-sm";
  const financeInputStyle = "w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-black text-[#1E293B] outline-none focus:border-teal-500 shadow-inner";

  const renderTabContent = () => {
    switch(activeTab) {
      case 'general': return (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8">
              <label className={labelStyle}>Apartment Name</label>
              <input className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.G. SLIEMA SEAFRONT PENTHOUSE" disabled={isHousekeeping || isDriver} />
              <p className="text-[9px] text-slate-400 mt-2 px-1 uppercase font-bold tracking-widest">* Appears on invoices, cleaner worksheets & payroll.</p>
            </div>
            <div className="md:col-span-4">
              <label className={labelStyle}>Property Type</label>
              <select className={inputStyle} value={form.type} onChange={e => setForm({...form, type: e.target.value as any})} disabled={isHousekeeping || isDriver}>
                <option value="Apartment">Apartment</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Villa">Villa</option>
                <option value="Studio">Studio</option>
                <option value="Townhouse">Townhouse</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7">
              <label className={labelStyle}>Owner / Client</label>
              <div className="flex gap-2">
                <select className={inputStyle} value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} disabled={isHousekeeping || isDriver}>
                  <option value="">Choose Client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {(!isHousekeeping && !isDriver) && (
                  <button type="button" onClick={() => setShowNewClientModal(true)} className="w-14 h-14 bg-white border border-teal-100 text-teal-600 rounded-2xl flex items-center justify-center font-bold text-xl hover:bg-teal-50 transition-all shadow-sm shrink-0">+</button>
                )}
              </div>
            </div>
            <div className="md:col-span-5">
              <label className={labelStyle}>Package Type</label>
              <input 
                list="packTypes"
                className={inputStyle} 
                value={form.packType || ''} 
                onChange={e => setForm({...form, packType: e.target.value})} 
                placeholder="SEARCH OR TYPE PACKAGE..."
                disabled={isHousekeeping || isDriver}
              />
              <datalist id="packTypes">
                {existingPackTypes.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <label className={labelStyle}>Package Inclusions & Operational Details</label>
            <textarea 
              className={inputStyle + " h-32 py-4 italic text-slate-500 leading-relaxed"} 
              value={form.packNotes || ''} 
              onChange={e => setForm({...form, packNotes: e.target.value})} 
              placeholder="Specify what is included in this package (Linen, Toiletries, Welcome Pack)..." 
              disabled={isHousekeeping || isDriver}
            />
          </div>
        </div>
      );
      case 'access': return (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="space-y-6">
            <div>
              <label className={labelStyle}>Physical Address (Navigation Core)</label>
              <input className={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} disabled={isHousekeeping || isDriver} placeholder="STREET NAME, TOWN, POSTCODE" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
               <div className="flex gap-2">
                 {form.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`} target="_blank" className="flex-1 bg-[#1E293B] text-white text-center py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">Verify on Satellite Map</a>
                 )}
                 {(!isHousekeeping || isDriver) && (
                   <button type="button" onClick={captureCurrentLocation} disabled={isLocating} className="flex-1 bg-teal-50 border border-teal-200 text-teal-700 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-100 transition-all shadow-md">
                      {isLocating ? 'Capturing...' : 'Capture My GPS Pin'}
                   </button>
                 )}
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>Latitude</label>
                    <input type="number" step="any" className={inputStyle} value={form.lat || ''} onChange={e => setForm({...form, lat: parseFloat(e.target.value)})} disabled={isHousekeeping || isDriver} placeholder="35.9..." />
                  </div>
                  <div>
                    <label className={labelStyle}>Longitude</label>
                    <input type="number" step="any" className={inputStyle} value={form.lng || ''} onChange={e => setForm({...form, lng: parseFloat(e.target.value)})} disabled={isHousekeeping || isDriver} placeholder="14.5..." />
                  </div>
               </div>
            </div>
            {isDriver && <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest px-1">* PERSONNEL: DRIVERS ARE AUTHORIZED TO SYNC GPS PINS WHILE ON-SITE.</p>}
          </div>

          <div className="bg-teal-50/50 p-6 rounded-[2rem] border border-teal-100 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner">
            <div><label className={labelStyle}>Entrance Code</label><input className={`${inputStyle} font-mono tracking-widest text-teal-700 bg-white`} value={form.mainEntranceCode} onChange={e => setForm({...form, mainEntranceCode: e.target.value})} placeholder="****" disabled={isDriver} /></div>
            <div><label className={labelStyle}>Keybox Code</label><input className={`${inputStyle} font-mono tracking-widest text-teal-700 bg-white`} value={form.keyboxCode} onChange={e => setForm({...form, keyboxCode: e.target.value})} placeholder="****" disabled={isDriver} /></div>
            <div><label className={labelStyle}>Floor Level</label><input className={inputStyle} value={form.floorNumber} onChange={e => setForm({...form, floorNumber: e.target.value})} placeholder="G/1/2" disabled={isHousekeeping || isDriver} /></div>
            <div><label className={labelStyle}>Apt Number</label><input className={inputStyle} value={form.apartmentNumber} onChange={e => setForm({...form, apartmentNumber: e.target.value})} placeholder="UNIT #" disabled={isDriver} /></div>
          </div>
          
          <div>
            <label className={labelStyle}>Logistics & Access Notes</label>
            <textarea className={inputStyle + " h-24 py-4 italic text-slate-500"} value={form.accessNotes} onChange={e => setForm({...form, accessNotes: e.target.value})} placeholder="Instructional detail for staff regarding keybox placement..." disabled={isDriver} />
          </div>
        </div>
      );
      case 'rooms': return (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={labelStyle}>Bedrooms</label><input type="number" className={inputStyle} value={form.rooms} onChange={e => setForm({...form, rooms: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
            <div><label className={labelStyle}>Bathrooms</label><input type="number" className={inputStyle} value={form.bathrooms} onChange={e => setForm({...form, bathrooms: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
            <div><label className={labelStyle}>Max Guests</label><input type="number" className={inputStyle} value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="p-6 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                <p className="text-[10px] font-black uppercase text-teal-600 tracking-widest border-b pb-2">Sleeping Arrangements</p>
                <div className="space-y-4">
                  <div><label className={labelStyle}>Double Beds</label><input type="number" className={inputStyle} value={form.doubleBeds} onChange={e => setForm({...form, doubleBeds: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
                  <div><label className={labelStyle}>Single Beds</label><input type="number" className={inputStyle} value={form.singleBeds} onChange={e => setForm({...form, singleBeds: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
                  <div><label className={labelStyle}>Sofa Beds</label><input type="number" className={inputStyle} value={form.sofaBeds} onChange={e => setForm({...form, sofaBeds: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
                  <div><label className={labelStyle}>Total Pillows</label><input type="number" className={inputStyle} value={form.pillows} onChange={e => setForm({...form, pillows: parseInt(e.target.value) || 0})} disabled={isHousekeeping || isDriver} /></div>
                </div>
             </div>

             <div className="p-6 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                <p className="text-[10px] font-black uppercase text-teal-600 tracking-widest border-b pb-2">Amenities</p>
                <div className="space-y-5">
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 accent-[#0D9488] rounded" checked={form.hasDishwasher} onChange={e => setForm({...form, hasDishwasher: e.target.checked})} disabled={isHousekeeping || isDriver} />
                      <span className="text-[11px] font-bold uppercase text-slate-700">Dishwasher</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 accent-[#0D9488] rounded" checked={form.hasCoffeeMachine} onChange={e => setForm({...form, hasCoffeeMachine: e.target.checked})} disabled={isHousekeeping || isDriver} />
                      <span className="text-[11px] font-bold uppercase text-slate-700">Coffee Machine</span>
                   </label>
                   {form.hasCoffeeMachine && (
                     <input className={inputStyle} value={form.coffeeMachineType} onChange={e => setForm({...form, coffeeMachineType: e.target.value})} placeholder="POD TYPE (E.G. NESPRESSO)" disabled={isHousekeeping || isDriver} />
                   )}
                </div>
             </div>

             <div className="p-6 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                <p className="text-[10px] font-black uppercase text-teal-600 tracking-widest border-b pb-2">Guest Extras</p>
                <div className="space-y-4">
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 accent-[#0D9488] rounded" checked={form.hasBabyCot} onChange={e => setForm({...form, hasBabyCot: e.target.checked})} disabled={isHousekeeping || isDriver} />
                      <span className="text-[11px] font-bold uppercase text-slate-700">Baby Cot</span>
                   </label>
                </div>
             </div>
          </div>
        </div>
      );
      case 'media': return (
        <div className="space-y-12 animate-in fade-in duration-300">
          <div>
            <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em] mb-6">Reference Photos</p>
            
            <div className="space-y-6">
              <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-50 pb-2">Core Assets</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { id: 'entrancePhoto', label: 'Entrance' },
                  { id: 'keyboxPhoto', label: 'Keybox' },
                  { id: 'kitchenPhoto', label: 'Kitchen' },
                  { id: 'livingRoomPhoto', label: 'Living Area' },
                  { id: 'welcomePackPhoto', label: 'Welcome Pack' }
                ].map(slot => (
                  <div key={slot.id} className="space-y-3">
                    <label className={labelStyle}>{slot.label}</label>
                    <div 
                      className={`w-full aspect-square bg-white rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center ${(!isHousekeeping && !isDriver) ? 'cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all' : ''}`}
                      onClick={() => (!isHousekeeping && !isDriver) && document.getElementById(slot.id)?.click()}
                    >
                      {(form as any)[slot.id] ? (
                        <img src={(form as any)[slot.id]} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl text-slate-200">+</span>
                      )}
                      <input type="file" id={slot.id} className="hidden" onChange={e => handleFileUpload(e, slot.id)} disabled={isHousekeeping || isDriver} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(form.rooms || 0) > 0 && (
              <div className="space-y-6 mt-10">
                <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-50 pb-2">Bedroom Reference Standards</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Array.from({ length: form.rooms || 0 }).map((_, i) => (
                    <div key={`room-${i}`} className="space-y-3">
                      <label className={labelStyle}>Bedroom {i + 1}</label>
                      <div 
                        className={`w-full aspect-square bg-white rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center ${(!isHousekeeping && !isDriver) ? 'cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all' : ''}`}
                        onClick={() => (!isHousekeeping && !isDriver) && document.getElementById(`roomPhoto-${i}`)?.click()}
                      >
                        {form.roomPhotos?.[i] ? (
                          <img src={form.roomPhotos[i]} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl text-slate-200">+</span>
                        )}
                        <input type="file" id={`roomPhoto-${i}`} className="hidden" onChange={e => handleArrayFileUpload(e, 'roomPhotos', i)} disabled={isHousekeeping || isDriver} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(form.bathrooms || 0) > 0 && (
              <div className="space-y-6 mt-10">
                <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-50 pb-2">Bathroom Reference Standards</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Array.from({ length: form.bathrooms || 0 }).map((_, i) => (
                    <div key={`bath-${i}`} className="space-y-3">
                      <label className={labelStyle}>Bathroom {i + 1}</label>
                      <div 
                        className={`w-full aspect-square bg-white rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center ${(!isHousekeeping && !isDriver) ? 'cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all' : ''}`}
                        onClick={() => (!isHousekeeping && !isDriver) && document.getElementById(`bathPhoto-${i}`)?.click()}
                      >
                        {form.bathroomPhotos?.[i] ? (
                          <img src={form.bathroomPhotos[i]} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl text-slate-200">+</span>
                        )}
                        <input type="file" id={`bathPhoto-${i}`} className="hidden" onChange={e => handleArrayFileUpload(e, 'bathroomPhotos', i)} disabled={isHousekeeping || isDriver} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
      case 'finance': return (
        <div className="space-y-10 animate-in fade-in duration-300">
          {isAdmin ? (
            <div className="space-y-10">
              <section className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest whitespace-nowrap">Service Rate Matrix</h3>
                  <div className="h-px w-full bg-slate-100"></div>
                </div>
                
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-[#1E293B] uppercase tracking-[0.2em]">
                       <tr>
                          <th className="px-6 py-4">Service Category</th>
                          <th className="px-6 py-4">Client Billing (€)</th>
                          <th className="px-6 py-4">Staff Payout (€)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Check-out / Check-in</td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.clientPrice} onChange={e => setForm({...form, clientPrice: parseFloat(e.target.value) || 0})} /></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerPrice} onChange={e => setForm({...form, cleanerPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Refresh Clean</td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.clientRefreshPrice} onChange={e => setForm({...form, clientRefreshPrice: parseFloat(e.target.value) || 0})} /></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerRefreshPrice} onChange={e => setForm({...form, cleanerRefreshPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Mid-Stay Service</td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.clientMidStayPrice} onChange={e => setForm({...form, clientMidStayPrice: parseFloat(e.target.value) || 0})} /></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerMidStayPrice} onChange={e => setForm({...form, cleanerMidStayPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Audit (To Check)</td>
                          <td className="px-6 py-3"><span className="text-[9px] font-black text-slate-300 uppercase italic">N/A (Included)</span></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerAuditPrice} onChange={e => setForm({...form, cleanerAuditPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Common Area</td>
                          <td className="px-6 py-3"><span className="text-[9px] font-black text-slate-300 uppercase italic">Dynamic</span></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerCommonAreaPrice} onChange={e => setForm({...form, cleanerCommonAreaPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                       <tr>
                          <td className="px-6 py-3 font-bold text-xs text-[#1E293B] uppercase">Beds Only</td>
                          <td className="px-6 py-3"><span className="text-[9px] font-black text-slate-300 uppercase italic">Dynamic</span></td>
                          <td className="px-6 py-3"><input type="number" step="0.01" className={financeInputStyle} value={form.cleanerBedsOnlyPrice} onChange={e => setForm({...form, cleanerBedsOnlyPrice: parseFloat(e.target.value) || 0})} /></td>
                       </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : (
            <div className="py-24 text-center bg-rose-50 rounded-[2.5rem] border border-rose-100">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-rose-600 text-2xl">🔒</div>
              <p className="text-xs font-black text-rose-800 uppercase tracking-[0.5em]">Administrative Access Denied</p>
            </div>
          )}
        </div>
      );
      default: return null;
    }
  };

  const tabs: {id: ModalTab, label: string, icon: string}[] = [
    { id: 'general', label: 'General', icon: '🏠' },
    { id: 'access', label: 'Access', icon: '🔑' },
    { id: 'rooms', label: 'Rooms', icon: '🛌' },
    { id: 'media', label: 'Media', icon: '📷' },
    { id: 'finance', label: 'Finance', icon: '💳' }
  ];

  return (
    <div className="space-y-10 text-left pb-32 animate-in fade-in max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="flex-1">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[10px]">Operations Registry</p>
          <h2 className="text-4xl font-bold text-[#1E293B] tracking-tight uppercase leading-none">Portfolio</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2 italic">Registry of all managed asset units and their specific operational requirements.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="SEARCH APARTMENTS..." 
              className="w-full bg-white border border-slate-200 rounded-full px-12 py-3.5 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-400 transition-all placeholder:text-slate-300 shadow-sm" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
            <div className="absolute left-5 top-4 text-slate-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
          {(!isHousekeeping && !isDriver) && (
            <button onClick={() => { setForm(initialForm); setEditingId(null); setShowModal(true); setActiveTab('general'); }} className="btn-teal px-12 py-4 shadow-xl shadow-teal-900/10 uppercase text-[11px] font-black tracking-widest active:scale-95 transition-all">Add Property</button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {filteredProperties.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-200 rounded-[3rem] animate-in fade-in">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-inner">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">No properties matching your criteria</p>
          </div>
        ) : (
          filteredProperties.map(p => (
            <div key={p.id} className="group bg-white border border-slate-100 rounded-[2.5rem] p-5 flex flex-col gap-6 shadow-sm hover:shadow-xl transition-all duration-300 h-full">
               <div className="w-full h-48 rounded-[1.5rem] overflow-hidden shrink-0 shadow-inner bg-slate-50">
                  <img src={p.entrancePhoto || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
               </div>
               
               <div className="flex-1 min-0 text-left space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-[#1E293B] uppercase tracking-tight truncate flex-1">{p.name}</h3>
                    <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-teal-100">{p.type}</span>
                    {p.status === 'disabled' && <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-rose-100">Inactive</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold uppercase truncate tracking-widest flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {p.address}
                  </p>
                  <div className="flex gap-6 pt-2 border-t border-slate-50">
                    <div className="text-left"><p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Rooms</p><p className="text-xs font-black text-[#1E293B]">{p.rooms}</p></div>
                    <div className="text-left"><p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Beds</p><p className="text-xs font-black text-[#1E293B]">{p.doubleBeds + p.singleBeds}</p></div>
                    <div className="text-left"><p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Cap.</p><p className="text-xs font-black text-[#1E293B]">{p.capacity}</p></div>
                  </div>
               </div>

               <div className="w-full">
                 <button 
                  onClick={() => { setForm(p); setEditingId(p.id); setShowModal(true); setActiveTab(isDriver ? 'access' : 'general'); }} 
                  className="w-full py-4 bg-[#F0FDFA] border border-teal-100 text-[#0D9488] font-black text-[10px] uppercase tracking-[0.3em] rounded-[1.2rem] hover:bg-[#0D9488] hover:text-white transition-all shadow-sm active:scale-95"
                 >
                   {isDriver ? 'Sync GPS' : 'Configuration'}
                 </button>
               </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-fit min-h-[50vh] shadow-2xl relative my-auto animate-in zoom-in-95 flex flex-col overflow-hidden border border-slate-100">
             
             <div className="px-10 pt-8 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/50">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <h2 className="text-2xl font-bold text-[#1E293B] uppercase tracking-tighter leading-none">Property</h2>
                      <p className="text-[9px] text-teal-600 font-black uppercase tracking-[0.4em]">Configuration</p>
                   </div>
                   <div className="hidden md:flex items-center gap-3 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm h-fit">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Live Sync</span>
                   </div>
                </div>
                
                <nav className="flex gap-2 overflow-x-auto no-scrollbar -mb-px">
                   {tabs.map(tab => {
                      if (isDriver && tab.id !== 'access' && tab.id !== 'general') return null;
                      return (
                        <button 
                          key={tab.id} 
                          onClick={() => setActiveTab(tab.id)} 
                          className={`flex items-center gap-2.5 px-6 py-4 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all border-x border-t border-transparent ${activeTab === tab.id ? 'bg-white border-slate-100 text-[#0D9488] shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.05)]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                           <span className="text-lg">{tab.icon}</span>
                           <span>{tab.label}</span>
                        </button>
                      );
                   })}
                </nav>
             </div>

             <div className="flex-1 flex flex-col min-h-0 bg-white">
                <form onSubmit={handleSave} className="flex-1 flex flex-col p-8 md:p-10">
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">{renderTabContent()}</div>
                   <div className="pt-8 mt-6 border-t border-slate-100 flex justify-end items-center gap-4">
                      <button type="button" onClick={() => setShowModal(false)} className="px-6 py-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] hover:text-[#1E293B] transition-colors">Discard</button>
                      <button type="submit" className="bg-[#0D9488] text-white px-12 py-4 rounded-xl shadow-xl shadow-teal-900/20 text-[11px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all hover:bg-teal-700">{isDriver ? 'Update GPS Pin' : 'Save property'}</button>
                   </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 shadow-2xl relative text-left border border-teal-100">
              <div className="space-y-2">
                 <h3 className="text-2xl font-bold uppercase text-[#1E293B] tracking-tight">Partner Enrollment</h3>
                 <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-[0.4em]">Initialize New Client Profile</p>
              </div>
              <form onSubmit={handleQuickAddClient} className="space-y-6">
                 <div className="space-y-5">
                    <div><label className={labelStyle}>Partner Legal Name</label><input required className={inputStyle} value={newClientForm.name} onChange={e => setNewClientForm({...newClientForm, name: e.target.value})} placeholder="E.G. LUXURY STAY LTD" /></div>
                    <div><label className={labelStyle}>Lead Operations Email</label><input required type="email" className={inputStyle} value={newClientForm.email} onChange={e => setNewClientForm({...newClientForm, email: e.target.value})} placeholder="OPS@LUXURY.COM" /></div>
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="submit" className="flex-1 bg-[#1E293B] text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Add Client</button>
                    <button type="button" onClick={() => setShowNewClientModal(false)} className="px-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Cancel</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default PropertyPortfolio;
