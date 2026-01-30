
import React, { useState, useMemo, useRef } from 'react';
import { SupplyItem, SupplyRequest, User } from '../../types';
import { uploadFile } from '../../services/storageService';

interface InventoryAdminProps {
  inventoryItems: SupplyItem[];
  setInventoryItems: React.Dispatch<React.SetStateAction<SupplyItem[]>>;
  supplyRequests: SupplyRequest[];
  setSupplyRequests: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const InventoryAdmin: React.FC<InventoryAdminProps> = ({ 
  inventoryItems, setInventoryItems, supplyRequests, setSupplyRequests, showToast 
}) => {
  const [activeMode, setActiveMode] = useState<'requests' | 'catalog'>('requests');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplyItem | null>(null);
  
  const [productForm, setProductForm] = useState<Partial<SupplyItem>>({
    name: '',
    unit: '',
    category: 'basic',
    explanation: '',
    photo: '',
    type: 'cleaning'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRequests = supplyRequests.filter(r => r.status === 'pending');

  const consumptionAlerts = useMemo(() => {
    const alerts: { userId: string, userName: string, type: 'high' | 'low', message: string }[] = [];
    const now = new Date();
    const currentMonth = now.getMonth(); 
    const isWinter = currentMonth >= 10 || currentMonth <= 2; // Nov-Mar
    
    const userMap: Record<string, { name: string, requests: SupplyRequest[] }> = {};
    supplyRequests.forEach(r => {
      if (!userMap[r.userId]) userMap[r.userId] = { name: r.userName, requests: [] };
      userMap[r.userId].requests.push(r);
    });

    Object.entries(userMap).forEach(([uid, data]) => {
      const thisMonthSprays = data.requests.filter(r => {
        const item = inventoryItems.find(i => i.id === r.itemId);
        const reqDate = new Date(r.date);
        return item?.category === 'spray' && reqDate.getMonth() === currentMonth;
      }).length;

      const threshold = isWinter ? 2 : 3;
      if (thisMonthSprays > threshold) {
        alerts.push({ userId: uid, userName: data.name, type: 'high', message: `ABNORMAL SPRAY USAGE: ${thisMonthSprays} requests this month (${isWinter ? 'Winter' : 'Summer'} limit: ${threshold})` });
      }

      const lastTwoWeeksBasics = data.requests.filter(r => {
        const item = inventoryItems.find(i => i.id === r.itemId);
        const reqDate = new Date(r.date);
        const diffDays = (now.getTime() - reqDate.getTime()) / (1000 * 3600 * 24);
        return item?.category === 'basic' && diffDays <= 14;
      }).length;

      if (lastTwoWeeksBasics < 1) {
        alerts.push({ userId: uid, userName: data.name, type: 'low', message: `HYGIENE PROTOCOL RISK: No Floor/Toilet cleaner requested in >14 days. Audit required.` });
      }
    });

    return alerts;
  }, [supplyRequests, inventoryItems]);

  const handleAuditStaffTrigger = (userName: string) => {
    if (showToast) {
      showToast(`HIGH-PRIORITY AUDIT TICKET FILED FOR ${userName.toUpperCase()}`, 'error');
      setTimeout(() => {
        showToast(`SUPERVISOR ALERT DISPATCHED: PHYSICAL INSPECTION REQUIRED ON NEXT SHIFT`, 'info');
      }, 1500);
    }
  };

  const handleApproveBatch = (batch: SupplyRequest[]) => {
    const ids = batch.map(r => r.id);
    setSupplyRequests(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'approved' } : r));
    if (showToast) showToast('SUPPLIES DISPATCHED', 'success');
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setInventoryItems(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...productForm } as SupplyItem : p));
      if (showToast) showToast('PRODUCT UPDATED', 'success');
    } else {
      const newProduct: SupplyItem = {
        ...productForm,
        id: `sup-${Date.now()}`,
        photo: productForm.photo || 'https://images.unsplash.com/photo-1584622781564-1d9876a3e75a?auto=format&fit=crop&w=300&q=80'
      } as SupplyItem;
      setInventoryItems(prev => [...prev, newProduct]);
      if (showToast) showToast('NEW PRODUCT ADDED', 'success');
    }
    closeCatalogModal();
  };

  const closeCatalogModal = () => {
    setShowCatalogModal(false);
    setEditingProduct(null);
    setProductForm({ name: '', unit: '', category: 'basic', explanation: '', photo: '', type: 'cleaning' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        const url = await uploadFile(file);
        setProductForm({ ...productForm, photo: url });
    } catch (e) {
        console.error("Upload failed", e);
        if (showToast) showToast('PHOTO UPLOAD FAILED', 'error');
    }
  };

  const labelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20";

  const groupedPendingRequests = useMemo(() => {
    return pendingRequests.reduce((acc, r) => {
      if (!acc[r.userId]) acc[r.userId] = [];
      acc[r.userId].push(r);
      return acc;
    }, {} as Record<string, SupplyRequest[]>);
  }, [pendingRequests]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">LOGISTICS & CATALOG MANAGEMENT</h2>
          <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.4em] opacity-80">Supply Chain Control Center</p>
        </div>
        <div className="flex gap-2 p-1 bg-white rounded-2xl w-full md:w-auto">
           <button onClick={() => setActiveMode('requests')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMode === 'requests' ? 'bg-[#C5A059] text-black shadow-xl' : 'text-black/30 hover:bg-gray-50'}`}>Pending Requests</button>
           <button onClick={() => setActiveMode('catalog')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMode === 'catalog' ? 'bg-[#C5A059] text-black shadow-xl' : 'text-black/30 hover:bg-gray-50'}`}>Product Catalog</button>
        </div>
      </header>

      {activeMode === 'requests' && (
        <div className="space-y-12">
          {consumptionAlerts.length > 0 && (
            <section className="bg-red-600/5 border border-red-500/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
               <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  <h3 className="text-[11px] font-black text-red-500 uppercase tracking-[0.5em]">CONSUMPTION ANOMALIES</h3>
               </div>
               <div className="space-y-3">
                  {consumptionAlerts.map((alert, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#FDF8EE] p-5 rounded-2xl border border-red-500/10 group hover:border-red-500/30 transition-all">
                       <div className="space-y-1">
                          <p className="text-xs font-bold text-black uppercase">{alert.userName}</p>
                          <p className="text-[9px] text-red-500/80 font-black uppercase italic">{alert.message}</p>
                       </div>
                       <button onClick={() => handleAuditStaffTrigger(alert.userName)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">AUDIT STAFF</button>
                    </div>
                  ))}
               </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex items-center gap-4 px-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-black/30">PENDING REQUISITIONS</h3>
              <div className="h-px flex-1 bg-black/5"></div>
            </div>
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[48px] opacity-10 italic text-[10px] font-black uppercase tracking-[0.4em]">Queue Clear.</div>
              ) : (
                (Object.entries(groupedPendingRequests) as [string, SupplyRequest[]][]).map(([uid, batch]) => (
                   <div key={uid} className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
                      <div className="flex-1 text-left w-full">
                         <p className="text-[11px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-4">{batch[0].userName}</p>
                         <div className="space-y-2">
                            {batch.map(req => (
                               <div key={req.id} className="flex justify-between border-b border-black/5 pb-2">
                                  <span className="text-sm text-black font-bold uppercase tracking-tight">{req.itemName}</span>
                                  <span className="text-xs font-black text-[#8B6B2E]">QTY: {req.quantity}</span>
                               </div>
                            ))}
                         </div>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                         <button onClick={() => handleApproveBatch(batch)} className="flex-1 md:w-48 bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">APPROVE BATCH</button>
                         <button onClick={() => setSupplyRequests(prev => prev.filter(r => !batch.map(b => b.id).includes(r.id)))} className="px-6 border border-black/10 text-black/40 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:text-red-500">REJECT</button>
                      </div>
                   </div>
                 ))
              )}
            </div>
          </section>
        </div>
      )}

      {activeMode === 'catalog' && (
        <section className="space-y-8 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center px-1">
             <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-black/30">PRE-ADDED SUPPLIES</h3>
             <button onClick={() => { setEditingProduct(null); setShowCatalogModal(true); }} className="bg-[#C5A059] text-black px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95">NEW PRODUCT</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {inventoryItems.map(item => (
               <div key={item.id} className="bg-[#FDF8EE] rounded-[32px] overflow-hidden border border-[#D4B476]/30 hover:border-[#C5A059]/20 transition-all group flex flex-col shadow-xl">
                  <div className="h-44 relative">
                     <img src={item.photo} className="w-full h-full object-cover opacity-80" alt={item.name} />
                     <div className="absolute top-4 right-4 flex gap-2">
                        <button onClick={() => { setEditingProduct(item); setProductForm(item); setShowCatalogModal(true); }} className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-black hover:text-[#C5A059] backdrop-blur-md border border-[#D4B476]/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => setInventoryItems(prev => prev.filter(p => p.id !== item.id))} className="w-8 h-8 bg-red-50/80 rounded-full flex items-center justify-center text-red-600 hover:text-red-700 backdrop-blur-md border border-red-500/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                     </div>
                  </div>
                  <div className="p-6 flex-1 space-y-4">
                     <div>
                        <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.3em] mb-1">{item.category} • {item.unit}</p>
                        <h4 className="text-black font-bold uppercase text-base tracking-tight">{item.name}</h4>
                     </div>
                     <div className="bg-white/60 p-4 rounded-xl border border-[#D4B476]/10">
                        <p className="text-[7px] font-black text-black/30 uppercase tracking-widest mb-1 italic">Usage Protocol:</p>
                        <p className="text-[10px] text-black/60 italic leading-relaxed line-clamp-3">"{item.explanation}"</p>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[48px] w-full max-w-2xl p-10 space-y-10 shadow-2xl relative my-auto text-left">
            <button onClick={closeCatalogModal} className="absolute top-10 right-10 text-black/20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">{editingProduct ? 'Refine Product' : 'Register New Supply'}</h2>
              <p className={labelStyle}>Pre-Added Product Configuration</p>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelStyle}>Product Name</label>
                  <input required className={inputStyle} value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="E.G. WINDOW SANITIZER" />
                </div>
                <div>
                  <label className={labelStyle}>Unit Specification</label>
                  <input required className={inputStyle} value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} placeholder="E.G. 750ML BOTTLE" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelStyle}>Category</label>
                  <select className={inputStyle} value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as any})}>
                    <option value="spray">Spray (Detection Logic: High Usage Alert)</option>
                    <option value="basic">Basic (Detection Logic: Hygiene Shortcut Alert)</option>
                    <option value="linen">Linen / Textiles</option>
                    <option value="pack">Welcome / Guest Packs</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Supply Type</label>
                  <select className={inputStyle} value={productForm.type} onChange={e => setProductForm({...productForm, type: e.target.value as any})}>
                    <option value="cleaning">Cleaning Chemical</option>
                    <option value="laundry">Laundry Item</option>
                    <option value="welcome pack">Welcome Pack</option>
                    <option value="other">Maintenance / Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelStyle}>Mandatory Protocol (Displayed to Personnel)</label>
                <textarea required className={inputStyle + " h-32 py-4 italic"} value={productForm.explanation} onChange={e => setProductForm({...productForm, explanation: e.target.value})} placeholder="Detailed step-by-step instructions for personnel..." />
              </div>

              <div className="space-y-2">
                 <label className={labelStyle}>Reference Photo</label>
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="w-full h-32 bg-white/40 border border-gray-300 rounded-2xl flex items-center justify-center cursor-pointer hover:border-[#C5A059] transition-all overflow-hidden"
                 >
                    {productForm.photo ? (
                      <img src={productForm.photo} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="text-center opacity-20">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2 text-black"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span className="text-[10px] font-black uppercase text-black">Click to Attach Image</span>
                      </div>
                    )}
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </div>

              <button type="submit" className="w-full bg-[#C5A059] text-black font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all">
                {editingProduct ? 'UPDATE PRODUCT' : 'ADD TO CATALOG'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryAdmin;
