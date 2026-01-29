
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Property, Client, PropertyType, SofaBedType } from '../../types';
import { SERVICE_TYPES } from '../../constants';

interface PropertyPortfolioProps {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  selectedClientIdFilter: string | null;
  setSelectedClientIdFilter: (id: string | null) => void;
}

const PropertyPortfolio: React.FC<PropertyPortfolioProps> = ({ 
  properties, setProperties, clients, setClients, selectedClientIdFilter, setSelectedClientIdFilter 
}) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isHousekeeping = currentUser.role === 'housekeeping';

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [requestInput, setRequestInput] = useState('');
  
  // Rate configuration state
  const [rateServiceType, setRateServiceType] = useState('BEDS ONLY'); 
  const [ratePrice, setRatePrice] = useState(''); // Changed to string to handle decimal input correctly

  // Package Configuration State
  const [availablePackages, setAvailablePackages] = useState<string[]>(() => {
    const saved = localStorage.getItem('studio_packages');
    return saved ? JSON.parse(saved) : ['PREMIUM MANAGED', 'BASIC LISTING', 'FULL SERVICE'];
  });
  const [packageSearch, setPackageSearch] = useState('');
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const packagePickerRef = useRef<HTMLDivElement>(null);

  // New Client Temporary State
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    address: '',
    vat: ''
  });

  const initialFormState: Partial<Property> = {
    name: '', type: 'Apartment', clientId: '', address: '', apartmentNumber: '', floor: '',
    rooms: 1, bathrooms: 1, halfBaths: 0,
    doubleBeds: 1, singleBeds: 0, pillows: 2, sofaBed: 'none', foldableBeds: 0, babyCots: 0, capacity: 2,
    clientPrice: 0, clientServiceRates: {}, cleanerPrice: 0, serviceRates: {},
    servicePackage: '', packagePrice: 0, packageNote: '',
    keyboxCode: '', mainEntranceCode: '', accessNotes: '', 
    entrancePhoto: '',
    keyboxPhoto: '',
    hasDishwasher: false, hasCoffeeMachine: false, coffeeMachineType: '', specialRequests: [], 
    roomReferencePhotos: {}, status: 'active'
  };

  const [form, setForm] = useState<Partial<Property>>(initialFormState);
  const entranceInputRef = useRef<HTMLInputElement>(null);
  const keyboxInputRef = useRef<HTMLInputElement>(null);
  const roomPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Sync packageSearch when editing a property
  useEffect(() => {
    if (form.servicePackage) {
        setPackageSearch(form.servicePackage);
    } else {
        setPackageSearch('');
    }
  }, [form.servicePackage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (packagePickerRef.current && !packagePickerRef.current.contains(e.target as Node)) {
        setShowPackageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPackages = useMemo(() => {
    const query = packageSearch.toLowerCase();
    return availablePackages.filter(p => p.toLowerCase().includes(query));
  }, [availablePackages, packageSearch]);

  const filtered = useMemo(() => {
    let list = properties;
    if (selectedClientIdFilter) list = list.filter(p => p.clientId === selectedClientIdFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.address.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => {
      const aVal = a.status === 'disabled' ? 1 : 0;
      const bVal = b.status === 'disabled' ? 1 : 0;
      return aVal - bVal;
    });
  }, [properties, search, selectedClientIdFilter]);

  const handleQuickAddClient = () => {
    if (!newClient.name || !newClient.email) {
      alert("Company Name and Email are required.");
      return;
    }
    const created: Client = {
      id: `c-${Date.now()}`,
      name: newClient.name,
      contactEmail: newClient.email,
      phone: '',
      billingAddress: newClient.address,
      vatNumber: newClient.vat,
      propertyIds: [],
      status: 'active'
    };
    setClients(prev => [...prev, created]);
    setForm({ ...form, clientId: created.id });
    setIsAddingClient(false);
    setNewClient({ name: '', email: '', address: '', vat: '' });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHousekeeping) return;
    
    // Auto-save new package if it doesn't exist
    const finalPackage = form.servicePackage?.trim().toUpperCase();
    if (finalPackage && !availablePackages.includes(finalPackage)) {
        const newPackages = [...availablePackages, finalPackage];
        setAvailablePackages(newPackages);
        localStorage.setItem('studio_packages', JSON.stringify(newPackages));
    }

    const finalForm = { 
      ...form, 
      servicePackage: finalPackage,
      specialRequests: form.specialRequests || [], 
      serviceRates: form.serviceRates || {},
      clientServiceRates: form.clientServiceRates || {},
      status: form.status || 'active' 
    };

    if (editingId) {
      setProperties(prev => prev.map(p => p.id === editingId ? { ...p, ...finalForm } as Property : p));
    } else {
      setProperties(prev => [...prev, { ...finalForm, id: `prop-${Date.now()}` } as Property]);
    }

    resetState();
  };

  const resetState = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(initialFormState);
    setRequestInput('');
    setIsAddingClient(false);
    setNewClient({ name: '', email: '', address: '', vat: '' });
    setRatePrice('');
    setPackageSearch('');
  };

  const handleAddRequest = () => {
    if (!requestInput.trim()) return;
    const current = form.specialRequests || [];
    setForm({ ...form, specialRequests: [...current, requestInput.trim()] });
    setRequestInput('');
  };

  const handleAddServiceRate = () => {
    const price = parseFloat(ratePrice);
    if (!rateServiceType || !ratePrice || isNaN(price) || price <= 0) return;
    setForm(prev => ({
        ...prev,
        serviceRates: {
            ...prev.serviceRates,
            [rateServiceType]: price
        }
    }));
    setRatePrice('');
  };

  const handleRemoveServiceRate = (type: string) => {
    const updated = { ...form.serviceRates };
    delete updated[type];
    setForm({ ...form, serviceRates: updated });
  };

  const handleUpdateClientRate = (type: string, value: string) => {
    const price = parseFloat(value);
    setForm(prev => ({
        ...prev,
        clientServiceRates: {
            ...prev.clientServiceRates,
            [type]: isNaN(price) ? 0 : price
        }
    }));
  };

  const handleUpdateServiceRate = (type: string, value: string) => {
    const price = parseFloat(value);
    setForm(prev => ({
        ...prev,
        serviceRates: {
            ...prev.serviceRates,
            [type]: isNaN(price) ? 0 : price
        }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: string) => {
    if (isHousekeeping) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (target === 'entrance') {
        setForm({ ...form, entrancePhoto: dataUrl });
      } else if (target === 'keybox') {
        setForm({ ...form, keyboxPhoto: dataUrl });
      } else {
        const currentRooms = { ...form.roomReferencePhotos } || {};
        setForm({ ...form, roomReferencePhotos: { ...currentRooms, [target]: [dataUrl] } });
      }
    };
    reader.readAsDataURL(file);
  };

  const labelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20";
  const stepperStyle = "bg-white border border-gray-300 text-black rounded-lg flex items-center overflow-hidden h-8";

  // Fixed categories + Dynamic ones
  const referenceCategories = useMemo(() => {
    const base = ['Kitchen', 'Welcome Pack', 'Living/Dining Room', 'Others'];
    const rooms = Array.from({ length: form.rooms || 0 }).map((_, i) => `Bedroom ${i + 1}`);
    const baths = Array.from({ length: form.bathrooms || 0 }).map((_, i) => `Bathroom ${i + 1}`);
    return [...base, ...rooms, ...baths];
  }, [form.rooms, form.bathrooms]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">Property assets and onboarding</h2>
          <p className="text-[9px] font-bold text-[#8B6B2E] uppercase tracking-[0.3em] mt-1 opacity-60">Strategic Portfolio Management</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch">
          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="SEARCH..." 
              className="w-full bg-white border border-gray-300 rounded-full px-4 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20 pr-10" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <div className="absolute right-3 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
          </div>
          {!isHousekeeping && (
            <button onClick={() => { setForm(initialFormState); setEditingId(null); setShowModal(true); }} className="bg-[#C5A059] text-black px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">ONBOARDING PROPERTY</button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(prop => (
          <div key={prop.id} className={`bg-[#FDF8EE] rounded-[32px] overflow-hidden border border-[#D4B476]/30 shadow-2xl group transition-all ${prop.status === 'disabled' ? 'opacity-40 grayscale' : 'hover:border-[#C5A059]/50 hover:translate-y-[-4px]'}`}>
            <div className="h-48 relative">
              <img src={prop.entrancePhoto || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80'} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" alt={prop.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#FDF8EE] via-transparent to-transparent"></div>
              {prop.status === 'disabled' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-[10px] font-black text-white bg-red-600 px-5 py-1.5 rounded-full uppercase tracking-[0.3em] shadow-2xl border border-red-500">Handed Back to Owner</span>
                </div>
              )}
              <div className="absolute bottom-4 left-6">
                 <h3 className="text-lg font-serif-brand font-bold text-black uppercase tracking-tight truncate max-w-[200px]">{prop.name}</h3>
                 <p className="text-[8px] text-black/60 uppercase tracking-widest truncate">{prop.address}</p>
                 {prop.servicePackage && <span className="text-[6px] font-black text-black bg-[#C5A059] px-2 py-0.5 rounded mt-1 inline-block uppercase tracking-wider">{prop.servicePackage}</span>}
              </div>
            </div>
            <div className="p-6 space-y-6">
              {!isHousekeeping && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/40 p-3 rounded-2xl border border-[#D4B476]/10 flex flex-col items-center">
                     <span className="text-[7px] text-[#8B6B2E] font-black uppercase tracking-widest mb-1">Invoice Price</span>
                     <span className="text-sm font-bold text-black">€{prop.clientPrice}</span>
                  </div>
                  <div className="bg-white/40 p-3 rounded-2xl border border-[#D4B476]/10 flex flex-col items-center">
                     <span className="text-[7px] text-green-700 font-black uppercase tracking-widest mb-1">Staff Rate</span>
                     <span className="text-sm font-bold text-black">€{prop.cleanerPrice}</span>
                  </div>
                </div>
              )}
              <button 
                onClick={() => { setForm(prop); setEditingId(prop.id); setShowModal(true); }} 
                className="w-full py-3 rounded-xl border border-[#D4B476]/40 text-black/40 text-[9px] font-black uppercase tracking-widest hover:bg-white/50 hover:text-black transition-all"
              >
                {isHousekeeping ? 'View Details' : 'Manage Asset'}
              </button>
            </div>
          </div>
        ))}
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto custom-scrollbar">
          <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] w-full max-w-4xl p-6 md:p-12 space-y-8 md:space-y-10 text-left shadow-2xl my-auto animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center border-b border-black/5 pb-8">
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{isHousekeeping ? 'Property Profile' : 'Onboarding Property'}</h2>
                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80">Proprietary Asset Registration Core</p>
              </div>
              <button onClick={resetState} className="text-black/20 hover:text-black transition-colors"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <form onSubmit={handleSave} className={`space-y-12 ${isHousekeeping ? 'pointer-events-none' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">1. Master Configuration</h4>
                  <div>
                    <label className={labelStyle}>Internal Unit Name</label>
                    <input required className={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>

                  {!isHousekeeping && (
                    <div className="space-y-6">
                        {/* Package Selection & Client Price */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative" ref={packagePickerRef}>
                                <label className={labelStyle}>Service Package (Auto-Saves New)</label>
                                <input 
                                    className={inputStyle}
                                    placeholder="SEARCH OR TYPE NEW PACKAGE..."
                                    value={packageSearch}
                                    onChange={(e) => { 
                                        setPackageSearch(e.target.value); 
                                        setForm({...form, servicePackage: e.target.value.toUpperCase()});
                                        setShowPackageDropdown(true); 
                                    }}
                                    onFocus={() => setShowPackageDropdown(true)}
                                />
                                {showPackageDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1 animate-in slide-in-from-top-2">
                                        {filteredPackages.length === 0 ? (
                                            <p className="p-3 text-[9px] font-black uppercase text-black/20 text-center">New entry will be saved</p>
                                        ) : filteredPackages.map(pkg => (
                                            <button 
                                                key={pkg}
                                                type="button"
                                                onClick={() => { 
                                                    setPackageSearch(pkg); 
                                                    setForm({...form, servicePackage: pkg}); 
                                                    setShowPackageDropdown(false); 
                                                }}
                                                className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-gray-50 text-[9px] font-bold uppercase transition-all"
                                            >
                                                {pkg}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={labelStyle}>Client Price (Check In/Out)</label>
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                    <input 
                                        type="number" 
                                        required 
                                        className={`${inputStyle} pl-8`} 
                                        value={form.clientPrice} 
                                        onChange={e => setForm({...form, clientPrice: parseFloat(e.target.value)})} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Package Note & New Rates */}
                        <div className="space-y-4">
                            <div>
                                <label className={labelStyle}>Package Requirements Note</label>
                                <textarea 
                                    className={`${inputStyle} h-20 italic`} 
                                    placeholder="Details on what this apartment needs from the package (e.g. Weekly deep clean included, laundry managed by owner)..."
                                    value={form.packageNote || ''}
                                    onChange={e => setForm({...form, packageNote: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>Client Refresh Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.clientServiceRates?.['REFRESH'] || 0} 
                                            onChange={e => handleUpdateClientRate('REFRESH', e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelStyle}>Client Mid Stay Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.clientServiceRates?.['MID STAY CLEANING'] || 0} 
                                            onChange={e => handleUpdateClientRate('MID STAY CLEANING', e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cost Configuration Section */}
                        <div className="space-y-4 pt-4 border-t border-black/5">
                            <h5 className="text-[9px] font-black text-black/40 uppercase tracking-[0.2em]">COST CONFIGURATION (CLEANER)</h5>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Fixed Explicit Rates */}
                                <div>
                                    <label className={labelStyle}>Standard Cleaning (Turnover)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            required 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.cleanerPrice} 
                                            onChange={e => setForm({...form, cleanerPrice: parseFloat(e.target.value)})} 
                                        />
                                    </div>
                                    <p className="text-[7px] text-black/30 mt-1 italic uppercase tracking-wider">Base rate</p>
                                </div>
                                <div>
                                    <label className={labelStyle}>Refresh Rate</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.serviceRates?.['REFRESH'] || ''} 
                                            onChange={e => handleUpdateServiceRate('REFRESH', e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelStyle}>Mid Stay Rate</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.serviceRates?.['MID STAY CLEANING'] || ''} 
                                            onChange={e => handleUpdateServiceRate('MID STAY CLEANING', e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelStyle}>Audit (Check Apt)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-8`} 
                                            value={form.serviceRates?.['TO CHECK APARTMENT'] || ''} 
                                            onChange={e => handleUpdateServiceRate('TO CHECK APARTMENT', e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Generic Adder for other types */}
                            <div className="md:col-span-2 space-y-2 bg-white/40 p-4 rounded-2xl border border-[#D4B476]/10 mt-2">
                                <label className={labelStyle}>Other Service Rates (e.g. Beds Only)</label>
                                <div className="flex gap-2">
                                    <select className={`${inputStyle} w-1/2`} value={rateServiceType} onChange={e => setRateServiceType(e.target.value)}>
                                        {['BEDS ONLY', 'LINEN DROP / COLLECTION'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <div className="relative w-1/4">
                                        <span className="absolute left-2 top-2.5 text-[10px] text-black/20">€</span>
                                        <input 
                                            type="number" 
                                            className={`${inputStyle} pl-6`} 
                                            placeholder="0.00" 
                                            value={ratePrice} 
                                            onChange={e => setRatePrice(e.target.value)} 
                                        />
                                    </div>
                                    <button type="button" onClick={handleAddServiceRate} className="w-10 bg-[#C5A059] text-black font-black rounded-lg flex items-center justify-center text-lg active:scale-95">+</button>
                                </div>
                                
                                {Object.keys(form.serviceRates || {}).length > 0 && (
                                    <div className="grid grid-cols-1 gap-2 pt-2">
                                        {Object.entries(form.serviceRates || {}).filter(([type]) => !['REFRESH', 'MID STAY CLEANING', 'TO CHECK APARTMENT'].includes(type)).map(([type, price]) => (
                                            <div key={type} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                                                <span className="text-[9px] font-bold uppercase">{type}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[9px] font-bold text-green-700">€{(price as number).toFixed(2)}</span>
                                                    <button type="button" onClick={() => handleRemoveServiceRate(type)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">2. Client Ownership</h4>
                   <div className="bg-white/40 p-6 rounded-3xl border border-[#D4B476]/10 space-y-6">
                      {!isAddingClient ? (
                        <div className="space-y-4">
                           <label className={labelStyle}>Select Portfolio Owner</label>
                           <div className="flex gap-2">
                              <select className={inputStyle} value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
                                <option value="">SELECT OWNER...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                              </select>
                              {!isHousekeeping && (
                                <button type="button" onClick={() => setIsAddingClient(true)} className="w-10 bg-[#C5A059] text-black font-black rounded-lg text-lg flex items-center justify-center shrink-0">+</button>
                              )}
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in">
                           <div className="flex justify-between items-center">
                              <p className="text-[8px] font-black text-black uppercase tracking-widest">New Partner Detail</p>
                              <button type="button" onClick={() => setIsAddingClient(false)} className="text-[7px] text-red-500 underline font-black uppercase">Cancel</button>
                           </div>
                           <div className="space-y-4">
                              <div>
                                <label className={labelStyle}>Company / Legal Name</label>
                                <input className={inputStyle} value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                              </div>
                              <div>
                                <label className={labelStyle}>Contact Email</label>
                                <input className={inputStyle} value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                              </div>
                              <div>
                                <label className={labelStyle}>Billing Address</label>
                                <input className={inputStyle} value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} />
                              </div>
                              <div>
                                <label className={labelStyle}>VAT Number</label>
                                <input className={inputStyle} value={newClient.vat} onChange={e => setNewClient({...newClient, vat: e.target.value})} />
                              </div>
                              <button type="button" onClick={handleQuickAddClient} className="w-full bg-[#C5A059] text-black font-black py-3 rounded-xl text-[9px] uppercase tracking-widest shadow-xl active:scale-95">Save Partner</button>
                           </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-4 border-t border-black/5">
                         <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-black uppercase">{form.status === 'disabled' ? 'UNIT ARCHIVED' : 'UNIT ACTIVE'}</p>
                            <p className="text-[7px] text-black/30 uppercase">Management Visibility Status</p>
                         </div>
                         <button 
                           type="button" 
                           onClick={() => setForm({...form, status: form.status === 'disabled' ? 'active' : 'disabled'})}
                           className={`w-14 h-7 rounded-full relative transition-all ${form.status === 'disabled' ? 'bg-red-600' : 'bg-green-600'}`}
                         >
                           <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${form.status === 'disabled' ? 'left-1' : 'left-8'}`}></div>
                         </button>
                      </div>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">3. Location Intel</h4>
                  <div>
                    <label className={labelStyle}>Full Address (Suggestion Enabled)</label>
                    <div className="flex gap-2">
                       <input required className={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                       <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address || '')}`} target="_blank" className="w-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center text-black/40 hover:text-black shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="10" r="3"/><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg></a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyle}>Apt No.</label>
                      <input className={inputStyle} value={form.apartmentNumber} onChange={e => setForm({...form, apartmentNumber: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelStyle}>Floor</label>
                      <input className={inputStyle} value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyle}>Entrance Code</label>
                      <input className={inputStyle} value={form.mainEntranceCode} onChange={e => setForm({...form, mainEntranceCode: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelStyle}>Keybox Code</label>
                      <input className={inputStyle} value={form.keyboxCode} onChange={e => setForm({...form, keyboxCode: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">4. Reference Protocols</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className={labelStyle}>Entrance Reference Photo</label>
                       <div 
                          onClick={() => entranceInputRef.current?.click()}
                          className="w-full h-32 rounded-3xl border-2 border-dashed border-[#D4B476]/30 bg-white/20 flex items-center justify-center cursor-pointer hover:border-[#8B6B2E]/60 transition-all overflow-hidden"
                        >
                          {form.entrancePhoto ? (
                            <img src={form.entrancePhoto} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 opacity-20 text-black">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              <span className="text-[8px] font-black uppercase tracking-widest">Entrance</span>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={entranceInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'entrance')} />
                     </div>

                     <div className="space-y-2">
                       <label className={labelStyle}>Keybox Reference Photo</label>
                       <div 
                          onClick={() => keyboxInputRef.current?.click()}
                          className="w-full h-32 rounded-3xl border-2 border-dashed border-[#D4B476]/30 bg-white/20 flex items-center justify-center cursor-pointer hover:border-[#8B6B2E]/60 transition-all overflow-hidden"
                        >
                          {form.keyboxPhoto ? (
                            <img src={form.keyboxPhoto} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 opacity-20 text-black">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              <span className="text-[8px] font-black uppercase tracking-widest">Keybox</span>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={keyboxInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'keybox')} />
                     </div>
                   </div>
                   <div>
                      <div className="flex justify-between items-center mb-1 px-1">
                        <label className="text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80">Internal Access Protocol</label>
                        <span className="text-[6px] font-black text-[#C5A059] uppercase tracking-widest">Visible to Field Staff</span>
                      </div>
                      <textarea className={inputStyle + " h-24 py-3 italic"} value={form.accessNotes} onChange={e => setForm({...form, accessNotes: e.target.value})} placeholder="Provide exact physical directions to the keybox and building entry protocols..." />
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">5. Unit Inventory & Bedding</h4>
                <div className="bg-white/40 p-6 rounded-[32px] border border-[#D4B476]/10 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Rooms</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, rooms: Math.max(0, (form.rooms || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.rooms}</span>
                          <button type="button" onClick={() => setForm({...form, rooms: (form.rooms || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Bathrooms</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, bathrooms: Math.max(0, (form.bathrooms || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.bathrooms}</span>
                          <button type="button" onClick={() => setForm({...form, bathrooms: (form.bathrooms || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Toilet + Sink only</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, halfBaths: Math.max(0, (form.halfBaths || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.halfBaths}</span>
                          <button type="button" onClick={() => setForm({...form, halfBaths: (form.halfBaths || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Baby Cot</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, babyCots: Math.max(0, (form.babyCots || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.babyCots}</span>
                          <button type="button" onClick={() => setForm({...form, babyCots: (form.babyCots || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Double Beds</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, doubleBeds: Math.max(0, (form.doubleBeds || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.doubleBeds}</span>
                          <button type="button" onClick={() => setForm({...form, doubleBeds: (form.doubleBeds || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Single Beds</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, singleBeds: Math.max(0, (form.singleBeds || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.singleBeds}</span>
                          <button type="button" onClick={() => setForm({...form, singleBeds: (form.singleBeds || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-center">
                        <label className={labelStyle}>Pillows</label>
                        <div className={stepperStyle}>
                          <button type="button" onClick={() => setForm({...form, pillows: Math.max(0, (form.pillows || 0) - 1)})} className="flex-1 hover:bg-black/5">-</button>
                          <span className="w-8 text-center text-xs font-bold">{form.pillows}</span>
                          <button type="button" onClick={() => setForm({...form, pillows: (form.pillows || 0) + 1})} className="flex-1 hover:bg-black/5">+</button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Sofa Bed</label>
                        <select className={inputStyle + " h-8 py-0"} value={form.sofaBed} onChange={e => setForm({...form, sofaBed: e.target.value as SofaBedType})}>
                          <option value="none">NONE</option>
                          <option value="single">SINGLE</option>
                          <option value="double">DOUBLE</option>
                        </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-black/5 flex flex-wrap gap-x-12 gap-y-4">
                     <div className="flex items-center gap-4">
                        <label className="text-[10px] font-black text-black/60 uppercase cursor-pointer flex items-center gap-3">
                           <input type="checkbox" className="w-5 h-5 accent-[#8B6B2E] bg-white border-gray-300 rounded" checked={form.hasDishwasher} onChange={e => setForm({...form, hasDishwasher: e.target.checked})} />
                           Dishwasher
                        </label>
                     </div>
                     <div className="flex flex-wrap items-center gap-4 md:gap-8">
                        <label className="text-[10px] font-black text-black/60 uppercase cursor-pointer flex items-center gap-3">
                           <input type="checkbox" className="w-5 h-5 accent-[#8B6B2E] bg-white border-gray-300 rounded" checked={form.hasCoffeeMachine} onChange={e => setForm({...form, hasCoffeeMachine: e.target.checked})} />
                           Coffee Machine
                        </label>
                        {form.hasCoffeeMachine && (
                          <div className="space-y-1 min-w-[150px]">
                            <label className={labelStyle}>Machine Type</label>
                            <input className={inputStyle + " h-9 py-0"} placeholder="E.G. NESPRESSO" value={form.coffeeMachineType} onChange={e => setForm({...form, coffeeMachineType: e.target.value})} />
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">6. Deployment Reference Photos</h4>
                <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar">
                   {referenceCategories.map((cat, i) => (
                     <div key={cat} className="flex flex-col items-center gap-3 shrink-0">
                        <div 
                          onClick={() => !isHousekeeping && roomPhotoRefs.current[cat]?.click()}
                          className={`w-28 h-28 md:w-32 md:h-32 rounded-[24px] md:rounded-3xl bg-white/20 border-2 border-dashed border-[#D4B476]/30 flex items-center justify-center overflow-hidden hover:border-[#8B6B2E]/60 transition-all ${isHousekeeping ? '' : 'cursor-pointer'}`}
                        >
                          {form.roomReferencePhotos?.[cat]?.[0] ? (
                            <img src={form.roomReferencePhotos[cat][0]} className="w-full h-full object-cover" />
                          ) : (
                            <div className="opacity-10 scale-110 md:scale-125 text-black">
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                          )}
                        </div>
                        <span className="text-[7px] font-black text-black/30 uppercase tracking-widest max-w-[100px] text-center leading-tight">{cat}</span>
                        <input type="file" ref={el => { roomPhotoRefs.current[cat] = el; }} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, cat)} />
                     </div>
                   ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] border-l-2 border-[#8B6B2E] pl-4">7. Recurring Special Requests</h4>
                {!isHousekeeping && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                        <label className={labelStyle}>Add instruction</label>
                        <input 
                          className={inputStyle} 
                          value={requestInput} 
                          onChange={e => setRequestInput(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddRequest())}
                        />
                    </div>
                    <button type="button" onClick={handleAddRequest} className="w-10 h-10 mt-auto bg-[#C5A059] text-black font-black rounded-lg text-lg active:scale-95 flex items-center justify-center shrink-0">+</button>
                  </div>
                )}
                <div className="space-y-2">
                   {(form.specialRequests || []).map((req, i) => (
                     <div key={i} className="bg-white/40 px-4 py-3 rounded-xl flex justify-between items-center group">
                        <p className="text-[10px] text-black/80 font-medium uppercase tracking-wider">{req}</p>
                        {!isHousekeeping && (
                          <button type="button" onClick={() => setForm({...form, specialRequests: (form.specialRequests || []).filter((_, idx) => idx !== i)})} className="text-red-500/40 hover:text-red-500 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                     </div>
                   ))}
                </div>
              </div>

              {!isHousekeeping && (
                <div className="pt-12 border-t border-black/5 flex gap-4 pb-12 pointer-events-auto">
                  <button type="submit" className="flex-1 bg-[#C5A059] text-black font-black py-3 md:py-5 rounded-2xl uppercase text-[10px] md:text-[11px] tracking-widest md:tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                     {editingId ? 'UPDATE' : 'ADD PROPERTY'}
                  </button>
                  <button type="button" onClick={resetState} className="flex-1 bg-white border border-gray-300 text-black/40 font-black py-3 md:py-5 rounded-2xl uppercase text-[10px] md:text-[11px] tracking-widest active:scale-95">Discard</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyPortfolio;
