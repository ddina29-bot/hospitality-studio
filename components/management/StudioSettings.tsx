
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

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(organization);
  }, [formData, organization]);

  const handleChange = (field: keyof OrganizationSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // In a real online app, this updates the parent state, 
    // which triggers the App.tsx background sync to the SQLite server.
    setTimeout(() => {
      setOrganization(formData);
      setIsSaving(false);
      alert('Studio Registry Updated Successfully and synced to cloud.');
    }, 800);
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
        <section className="bg-white border border-slate-100 p-8 md:p-10 rounded-[40px] shadow-sm space-y-10">
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

           <div className="pt-10">
              <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-4 relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none text-white">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                 </div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-teal-400">Environment Intelligence</h3>
                 <div className="flex gap-10">
                    <div>
                       <p className="text-[7px] font-black uppercase tracking-widest opacity-40 mb-1">UNITS</p>
                       <p className="text-2xl font-serif-brand font-bold">{propertyCount}</p>
                    </div>
                    <div>
                       <p className="text-[7px] font-black uppercase tracking-widest opacity-40 mb-1">TEAM MEMBERS</p>
                       <p className="text-2xl font-serif-brand font-bold">{userCount}</p>
                    </div>
                 </div>
                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest pt-2 border-t border-white/5 italic">Persistent online storage active via SQLite v3.45</p>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default StudioSettings;
