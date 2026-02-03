
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
    setTimeout(() => {
      setOrganization(formData);
      setIsSaving(false);
      alert('Studio Registry Updated.');
    }, 500);
  };

  const labelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all shadow-sm";

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px]">Administration</p>
          <h2 className="text-xl font-serif-brand font-bold text-black uppercase tracking-tight">Studio Registry & Configuration</h2>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={handleSave} 
             disabled={!isDirty || isSaving}
             className="px-8 py-3 bg-[#C5A059] text-black font-black rounded-xl text-[9px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all"
           >
             {isSaving ? 'Saving...' : 'Save Configuration'}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] shadow-xl space-y-8">
           <div className="flex items-center gap-4 border-b border-[#D4B476]/10 pb-4">
              <div className="w-12 h-12 bg-black text-[#C5A059] rounded-full flex items-center justify-center font-serif-brand text-xl font-bold shadow-lg">
                 {formData.name?.charAt(0) || 'S'}
              </div>
              <div>
                 <h3 className="text-sm font-serif-brand font-bold text-black uppercase tracking-tight">Organization Identity</h3>
                 <p className="text-[8px] font-black text-[#A68342] uppercase tracking-widest opacity-60">Legal & Brand Configuration</p>
              </div>
           </div>
           
           <div className="space-y-6">
              <div>
                 <label className={labelStyle}>Display Name (Studio Name)</label>
                 <input className={inputStyle} value={formData.name} onChange={e => handleChange('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelStyle}>Legal Entity Name</label>
                    <input className={inputStyle} value={formData.legalEntity} onChange={e => handleChange('legalEntity', e.target.value)} placeholder="E.G. HOLDINGS LTD" />
                 </div>
                 <div>
                    <label className={labelStyle}>Registration Number</label>
                    <input className={inputStyle} value={formData.regNumber || ''} onChange={e => handleChange('regNumber', e.target.value)} placeholder="C 12345" />
                 </div>
              </div>
              <div>
                 <label className={labelStyle}>VAT / Tax ID</label>
                 <input className={inputStyle} value={formData.taxId} onChange={e => handleChange('taxId', e.target.value)} placeholder="MT..." />
              </div>
              <div>
                 <label className={labelStyle}>HQ Physical Address</label>
                 <input className={inputStyle} value={formData.address} onChange={e => handleChange('address', e.target.value)} />
              </div>
           </div>
        </section>

        <section className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-xl space-y-8">
           <div className="flex items-center gap-4 border-b border-gray-50 pb-4">
              <div className="w-12 h-12 bg-gray-50 text-black/40 rounded-full flex items-center justify-center">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div>
                 <h3 className="text-sm font-serif-brand font-bold text-black uppercase tracking-tight">Contact & Web</h3>
                 <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Public Facing Details</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelStyle}>General Email</label>
                    <input type="email" className={inputStyle} value={formData.email} onChange={e => handleChange('email', e.target.value)} />
                 </div>
                 <div>
                    <label className={labelStyle}>Primary Phone</label>
                    <input type="tel" className={inputStyle} value={formData.phone} onChange={e => handleChange('phone', e.target.value)} />
                 </div>
              </div>
              <div>
                 <label className={labelStyle}>Official Website</label>
                 <input className={inputStyle} value={formData.website} onChange={e => handleChange('website', e.target.value)} placeholder="HTTPS://..." />
              </div>
           </div>
        </section>

        <section className="lg:col-span-2 bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="space-y-6">
                 <h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight text-[#C5A059]">System Summary</h3>
                 <div className="flex gap-8">
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Total Assets</p>
                       <p className="text-3xl font-serif-brand font-bold text-white">{propertyCount}</p>
                    </div>
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Personnel</p>
                       <p className="text-3xl font-serif-brand font-bold text-white">{userCount}</p>
                    </div>
                 </div>
              </div>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] italic">PRODUCTION CORE ACTIVE • SECURE ENCRYPTED STORAGE</p>
           </div>
        </section>
      </div>
    </div>
  );
};

export default StudioSettings;
