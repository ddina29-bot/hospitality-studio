
import React, { useState, useEffect, useMemo } from 'react';
import { OrganizationSettings } from '../../types';

interface StudioSettingsProps {
  organization: OrganizationSettings;
  setOrganization: React.Dispatch<React.SetStateAction<OrganizationSettings>>;
  userCount: number;
  propertyCount: number;
  currentOrgId: string | null;
}

const StudioSettings: React.FC<StudioSettingsProps> = ({ organization, setOrganization, userCount, propertyCount, currentOrgId }) => {
  const [formData, setFormData] = useState<OrganizationSettings>(organization);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{ persistenceActive: boolean, version: string } | null>(null);

  useEffect(() => {
    setFormData(organization);
    fetch('/api/system/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.warn('System status check failed', err));
  }, [organization]);

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
      alert('Studio Registry Updated Successfully.');
    }, 800);
  };

  const handleDeleteOrganization = async () => {
    if (!currentOrgId) {
      alert("Error: No active Organization ID found. Please reload the page.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/auth/delete-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: currentOrgId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Server returned an error during deletion.');
      }

      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";

    } catch (error: any) {
      console.error("Deletion failed:", error);
      alert(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleResetData = async () => {
    if (!currentOrgId) return;
    setIsProcessing(true);
    try {
        // 1. Tell Server to wipe data
        const res = await fetch('/api/admin/reset-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: currentOrgId })
        });
        
        if (!res.ok) throw new Error('Reset failed on server');
        
        // 2. AGGRESSIVE LOCAL WIPE
        // We get the current object, manually empty the arrays, and save it back IMMEDIATELY.
        // This stops the App from reloading old data from cache.
        const savedOrgStr = localStorage.getItem('studio_org_settings');
        if (savedOrgStr) {
            const savedOrg = JSON.parse(savedOrgStr);
            savedOrg.shifts = [];
            savedOrg.manualTasks = [];
            savedOrg.supplyRequests = [];
            savedOrg.invoices = [];
            savedOrg.leaveRequests = [];
            savedOrg.timeEntries = [];
            // Force save empty state to local storage
            localStorage.setItem('studio_org_settings', JSON.stringify(savedOrg));
        }
        
        alert("Operational Data Cleared Successfully. The system will now reload.");
        window.location.reload();
        
    } catch (e) {
        console.error(e);
        alert("Failed to reset data. Please check connection.");
        setIsProcessing(false);
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

        <section className="lg:col-span-2 bg-[#F6E6C2] text-black p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-16 opacity-5 text-[#8B6B2E]">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
           </div>
           
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
              <div className="space-y-6">
                 <div>
                    <h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight text-black">System Status: Operational</h3>
                    <div className="flex gap-4 mt-2">
                       <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-60">v{systemStatus?.version || '3.2.0'} • Enterprise License</p>
                       {systemStatus && (
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${systemStatus.persistenceActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                           STORAGE: {systemStatus.persistenceActive ? 'PERSISTENT' : 'EPHEMERAL (WARNING)'}
                         </span>
                       )}
                    </div>
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
                 </div>
              </div>
              
              <div className="space-y-3 w-full md:w-auto text-right">
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full bg-[#D4B476] text-black border border-[#D4B476]/30 px-8 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all hover:bg-[#C5A059] shadow-lg"
                    >
                      CLEAR OPERATIONAL DATA
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full bg-black text-[#F6E6C2] border border-black/10 px-8 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all hover:bg-zinc-800 shadow-xl"
                    >
                      Delete Organisation
                    </button>
                 </div>
              </div>
           </div>
        </section>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
           <div className="bg-white border-2 border-red-500 rounded-[40px] w-full max-w-md p-10 space-y-8 shadow-2xl relative text-center">
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-red-600 tracking-tight">Confirm Deletion</h2>
                 <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-relaxed">
                    This action is <span className="text-red-600 underline">irreversible</span>.<br/>
                    All organization data will be wiped from the server and you will be redirected to the login screen.
                 </p>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={handleDeleteOrganization} disabled={isProcessing} className="w-full bg-red-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-red-700 active:scale-95 transition-all">
                   {isProcessing ? 'DELETING...' : 'YES, DELETE EVERYTHING'}
                 </button>
                 <button onClick={() => setShowDeleteConfirm(false)} className="w-full bg-gray-100 text-black/60 font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] hover:bg-gray-200 transition-all">ABORT ACTION</button>
              </div>
           </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
           <div className="bg-[#FDF8EE] border-2 border-[#D4B476] rounded-[40px] w-full max-w-md p-10 space-y-8 shadow-2xl relative text-center">
              <div className="space-y-2">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-black tracking-tight">Factory Reset Data</h2>
                 <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-relaxed">
                    This will clear all <strong>Schedules, Shifts, Tasks, Reports, and Invoices</strong>.<br/>
                    <br/>
                    <span className="text-black font-bold">Safe Action:</span> Users, Clients, and Properties will remain intact. Use this to clear testing data.
                 </p>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={handleResetData} disabled={isProcessing} className="w-full bg-[#D4B476] text-black font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-[#C5A059] active:scale-95 transition-all">
                   {isProcessing ? 'RESETTING...' : 'CONFIRM RESET'}
                 </button>
                 <button onClick={() => setShowResetConfirm(false)} className="w-full bg-white border border-gray-200 text-black/40 font-black py-4 rounded-xl uppercase text-[10px] tracking-[0.2em] hover:text-black transition-all">CANCEL</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StudioSettings;
