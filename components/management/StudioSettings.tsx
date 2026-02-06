
import React, { useState, useMemo } from 'react';
import { OrganizationSettings } from '../../types';

interface StudioSettingsProps {
  organization: OrganizationSettings;
  setOrganization: React.Dispatch<React.SetStateAction<OrganizationSettings>>;
  userCount: number;
  propertyCount: number;
  currentOrgId: string | null;
}

const StudioSettings: React.FC<StudioSettingsProps> = ({ organization, setOrganization, userCount, propertyCount }) => {
  const [formData, setFormData] = useState<OrganizationSettings>(organization);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(organization);
  }, [formData, organization]);

  const handleChange = (field: keyof OrganizationSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setOrganization(formData);
      setIsSaving(false);
      alert('Studio Registry Updated Successfully and synced to cloud.');
    }, 800);
  };

  const captureLaundryLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          laundryLat: parseFloat(pos.coords.latitude.toFixed(6)),
          laundryLng: parseFloat(pos.coords.longitude.toFixed(6))
        }));
        setIsLocating(false);
        alert("Laundry HQ Coordinates Captured.");
      },
      () => {
        setIsLocating(false);
        alert("GPS Capture Failed.");
      },
      { enableHighAccuracy: true }
    );
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all shadow-sm";

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="text-teal-600 font-black uppercase tracking-[0.4em] text-[10px]">SYSTEM ADMINISTRATION</p>
          <h2 className="text-2xl font-serif-brand font-bold text-slate-900 uppercase tracking-tight">Organization Configuration</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Configure statutory identifiers and corporate identity for the Studio.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <button 
             onClick={handleSave} 
             disabled={!isDirty || isSaving}
             className={`flex-1 md:flex-none px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all ${isDirty ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-300'}`}
           >
             {isSaving ? 'PERSISTING...' : 'Update & Sync'}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEGAL ENTITY REGISTRY */}
        <section className="bg-white border border-slate-100 p-8 md:p-10 rounded-[40px] shadow-sm space-y-10">
           <div className="flex items-center gap-5 border-b border-slate-50 pb-6">
              <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-serif-brand text-2xl font-bold shadow-lg">
                 {formData.name?.charAt(0) || 'R'}
              </div>
              <div>
                 <h3 className="text-lg font-serif-brand font-bold text-slate-900 uppercase tracking-tight">Legal Registry</h3>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">Company Identity & Tax</p>
              </div>
           </div>
           
           <div className="space-y-6">
              <div>
                 <label className={labelStyle}>Business Brand Name</label>
                 <input className={inputStyle} value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="RESET HOSPITALITY STUDIO" />
              </div>
              <div>
                 <label className={labelStyle}>Registered Legal Entity Name</label>
                 <input className={inputStyle} value={formData.legalEntity || ''} onChange={e => handleChange('legalEntity', e.target.value)} placeholder="E.G. RESET OPERATIONS MALTA LTD" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelStyle}>PE Number (Employment)</label>
                    <input className={inputStyle} value={formData.peNumber || ''} onChange={e => handleChange('peNumber', e.target.value)} placeholder="PE 12345" />
                 </div>
                 <div>
                    <label className={labelStyle}>VAT Number</label>
                    <input className={inputStyle} value={formData.taxId || ''} onChange={e => handleChange('taxId', e.target.value)} placeholder="MT 12345678" />
                 </div>
              </div>

              <div>
                 <label className={labelStyle}>Company Registration (Reg #)</label>
                 <input className={inputStyle} value={formData.regNumber || ''} onChange={e => handleChange('regNumber', e.target.value)} placeholder="C 99999" />
              </div>

              <div>
                 <label className={labelStyle}>Official HQ Registered Address</label>
                 <input className={inputStyle} value={formData.address} onChange={e => handleChange('address', e.target.value)} placeholder="FULL ADDRESS FOR INVOICING" />
              </div>
           </div>
        </section>

        {/* OPERATIONS & COMMUNICATIONS */}
        <div className="space-y-8">
            <section className="bg-white border border-slate-100 p-8 md:p-10 rounded-[40px] shadow-sm space-y-8">
               <div className="flex items-center gap-5 border-b border-slate-50 pb-6">
                  <div className="w-14 h-14 bg-teal-50 text-teal-600 border border-teal-100 rounded-2xl flex items-center justify-center shadow-sm">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div>
                     <h3 className="text-lg font-serif-brand font-bold text-slate-900 uppercase tracking-tight">Operations Lead</h3>
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Master Contact Protocols</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className={labelStyle}>Support Email</label>
                        <input type="email" className={inputStyle} value={formData.email} onChange={e => handleChange('email', e.target.value)} placeholder="OPS@RESET.STUDIO" />
                     </div>
                     <div>
                        <label className={labelStyle}>Master Phone</label>
                        <input type="tel" className={inputStyle} value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+356 ..." />
                     </div>
                  </div>
                  <div>
                     <label className={labelStyle}>Corporate URL</label>
                     <input className={inputStyle} value={formData.website || ''} onChange={e => handleChange('website', e.target.value)} placeholder="HTTPS://WWW.RESET.STUDIO" />
                  </div>
               </div>
            </section>

            {/* GEOFENCE CONFIG */}
            <section className="bg-slate-900 p-8 md:p-10 rounded-[40px] text-white space-y-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <svg width="150" height="150" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
               </div>
               <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.4em] text-teal-400">HQ Geofence</h3>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Laundry HQ Security Protocol</p>
                     </div>
                     <button 
                        onClick={captureLaundryLocation} 
                        disabled={isLocating}
                        className="bg-teal-600 text-white px-6 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                     >
                        {isLocating ? 'Capturing...' : 'Capture Current Location'}
                     </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 block">HQ Latitude</label>
                        <input 
                           type="number" 
                           step="any"
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-[10px] font-bold outline-none focus:border-teal-500" 
                           value={formData.laundryLat || ''} 
                           onChange={e => handleChange('laundryLat', parseFloat(e.target.value))} 
                           placeholder="35.xxxx"
                        />
                     </div>
                     <div>
                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 block">HQ Longitude</label>
                        <input 
                           type="number" 
                           step="any"
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-[10px] font-bold outline-none focus:border-teal-500" 
                           value={formData.laundryLng || ''} 
                           onChange={e => handleChange('laundryLng', parseFloat(e.target.value))} 
                           placeholder="14.xxxx"
                        />
                     </div>
                  </div>
                  <p className="text-[8px] font-medium text-slate-500 leading-relaxed uppercase">
                     * When coordinates are set, the Laundry role is restricted to clocking in within 150m. They will be auto-clocked out if they depart HQ.
                  </p>
               </div>
            </section>
        </div>
      </div>
    </div>
  );
};

export default StudioSettings;
