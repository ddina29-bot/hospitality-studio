
import React, { useState, useEffect, useMemo } from 'react';
import { OrganizationSettings } from '../../types';

interface StudioSettingsProps {
  organization: OrganizationSettings;
  setOrganization: React.Dispatch<React.SetStateAction<OrganizationSettings>>;
  userCount: number;
  propertyCount: number;
}

const StudioSettings: React.FC<StudioSettingsProps> = ({ organization, setOrganization, userCount, propertyCount }) => {
  const [formData, setFormData] = useState<OrganizationSettings>(organization);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form data when organization prop changes (e.g. after a save or external update)
  useEffect(() => {
    setFormData(organization);
  }, [organization]);

  // Derived dirty state to avoid synchronization issues
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(organization);
  }, [formData, organization]);

  const handleChange = (field: keyof OrganizationSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API delay
    setTimeout(() => {
      setOrganization(formData);
      setIsSaving(false);
      // isDirty will automatically become false because organization prop will update to match formData
      alert('Studio Registry Updated Successfully.');
    }, 800);
  };

  const handleDeleteOrganization = async () => {
    setIsDeleting(true);
    try {
      // Retrieve the persistent Org ID from local session storage
      const storedOrg = localStorage.getItem('studio_org_settings');
      
      if (!storedOrg) {
         // Fallback if session is corrupted: just wipe client side
         localStorage.clear();
         sessionStorage.clear();
         window.location.href = window.location.origin;
         window.location.reload();
         return;
      }

      const orgData = JSON.parse(storedOrg);
      const orgId = orgData.id;

      // Call Backend to perform actual deletion
      const res = await fetch('/api/auth/delete-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });

      if (!res.ok) {
        throw new Error('Server failed to delete organization.');
      }

      // Complete data wipe for the entire application to reset to factory state
      localStorage.clear();
      sessionStorage.clear();

      // Force reload to reset application state to initial demo/login
      window.location.href = window.location.origin;
      window.location.reload();

    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete organization from server. Please try again or contact support.");
      setIsDeleting(false);
    }
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
             onClick={() => setFormData(organization)} 
             disabled={!isDirty}
             className="px-6 py-3 border border-gray-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-black/40 hover:text-black disabled:opacity-30 transition-all"
           >
             Discard
           </button>
           <button 
             onClick={handleSave} 
             disabled={!isDirty || isSaving}
             className="px-8 py-3 bg-[#C5A059] text-black font-black rounded-xl text-[9px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all"
           >
             {isSaving ? 'Saving...' : 'Save Changes'}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Identity Section */}
        <section className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] shadow-xl space-y-8">
           <div className="flex items-center gap-4 border-b border-[#D4B476]/10 pb-4">
              <div className="w-12 h-12 bg-black text-[#C5A059] rounded-full flex items-center justify-center font-serif-brand text-xl font-bold shadow-lg">
                 {formData.name.charAt(0)}
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
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelStyle}>VAT / Tax ID</label>
                    <input className={inputStyle} value={formData.taxId} onChange={e => handleChange('taxId', e.target.value)} placeholder="MT..." />
                 </div>
                 <div>
                    <label className={labelStyle}>PE Number</label>
                    <input className={inputStyle} value={formData.peNumber || ''} onChange={e => handleChange('peNumber', e.target.value)} placeholder="00000" />
                 </div>
              </div>
              <div>
                 <label className={labelStyle}>HQ Physical Address</label>
                 <input className={inputStyle} value={formData.address} onChange={e => handleChange('address', e.target.value)} />
              </div>
           </div>
        </section>

        {/* Contact Section */}
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

        {/* System Stats Section */}
        <section className="lg:col-span-2 bg-[#F6E6C2] text-black p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-16 opacity-5 text-[#8B6B2E]">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
           </div>
           
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
              <div className="space-y-6">
                 <div>
                    <h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight text-black">System Status: Operational</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-60 mt-1">v3.1.0 • Enterprise License Active</p>
                 </div>
                 <div className="flex gap-8">
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Total Assets</p>
                       <p className="text-3xl font-serif-brand font-bold text-black">{propertyCount}</p>
                    </div>
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Personnel</p>
                       <p className="text-3xl font-serif-brand font-bold text-black">{userCount}</p>
                    </div>
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Storage</p>
                       <p className="text-3xl font-serif-brand font-bold text-black">12%</p>
                    </div>
                 </div>
              </div>
              
              <div className="space-y-3 w-full md:w-auto text-right">
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full bg-black text-[#F6E6C2] border border-black/10 px-8 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all hover:bg-zinc-800 shadow-xl"
                    >
                      Cancel Organisation
                    </button>
                    <p className="text-[7px] font-black text-black/30 uppercase tracking-widest">© 2024 Reset Hospitality Studio. All rights reserved.</p>
                 </div>
              </div>
           </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
           <div className="bg-white border-2 border-red-500 rounded-[40px] w-full max-w-md p-10 space-y-8 shadow-2xl relative text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 animate-pulse">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-red-600 tracking-tight">Confirm Deletion</h2>
                 <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-relaxed">
                    This action is <span className="text-red-600 underline">irreversible</span>.<br/>
                    All organization data will be wiped from the server and you will be redirected to the login screen.
                 </p>
              </div>
              <div className="flex flex-col gap-3">
                 <button 
                   onClick={handleDeleteOrganization}
                   disabled={isDeleting}
                   className="w-full bg-red-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isDeleting ? 'DELETING...' : 'YES, DELETE EVERYTHING'}
                 </button>
                 <button 
                   onClick={() => setShowDeleteConfirm(false)}
                   disabled={isDeleting}
                   className="w-full bg-gray-100 text-black/60 font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] hover:bg-gray-200 transition-all"
                 >
                   ABORT ACTION
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StudioSettings;
