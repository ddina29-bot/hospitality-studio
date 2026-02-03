import React, { useMemo, useState, useRef } from 'react';
import { Shift, Property, UserRole } from '../../types';

interface LaundryReportsProps {
  shifts: Shift[];
  properties: Property[];
  userRole?: UserRole;
}

const LaundryReports: React.FC<LaundryReportsProps> = ({ shifts, properties, userRole }) => {
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState('double sheet');
  const [damageType, setDamageType] = useState('Stain');
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');

  const [damageCounts, setDamageCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('studio_damage_counts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const saveCounts = (counts: Record<string, number>) => {
    setDamageCounts(counts);
    try {
      localStorage.setItem('studio_damage_counts', JSON.stringify(counts));
    } catch (e) {
      console.warn("Could not save damage counts to local storage (quota exceeded)");
    }
  };

  const LINEN_ITEMS = [
    'double sheet',
    'single sheet',
    'double quilt cover',
    'single quilt cover',
    'pillow case',
    'hand towel',
    'bath towel',
    'bathmat',
    'kitchen cloth'
  ];

  const allDamagedItems = useMemo(() => {
    return Object.entries(damageCounts)
      .filter(([_, count]) => (count as number) > 0)
      .map(([name, count]) => ({ name, count: count as number }));
  }, [damageCounts]);

  const totalDamaged = useMemo(() => {
    return Object.values(damageCounts).reduce((sum, val) => (sum as number) + (val as number), 0) as number;
  }, [damageCounts]);

  const isAdmin = userRole === 'admin';
  const hasCriticalItems = allDamagedItems.some(i => i.count > 10);
  const showAdminAlert = isAdmin && hasCriticalItems;

  const canReportDamage = ['laundry', 'supervisor', 'driver', 'admin'].includes(userRole || '');

  const inventoryInApartments = useMemo(() => {
    const requirements = { doubleSets: 0, singleSets: 0, sofaSets: 0, towels: 0 };
    shifts.filter(s => s.isLaundryPrepared && !s.excludeLaundry).forEach(s => {
      const prop = properties.find(p => p.id === s.propertyId);
      if (prop) {
        requirements.doubleSets += prop.doubleBeds || 0;
        requirements.singleSets += prop.singleBeds || 0;
        requirements.sofaSets += prop.sofaBed !== 'none' ? 1 : 0;
        const towelSetsFromSingles = (prop.singleBeds || 0) * 1;
        const towelSetsFromDoubles = (prop.doubleBeds || 0) * 2;
        const towelSetsFromSofa = prop.sofaBed === 'single' ? 1 : (prop.sofaBed === 'double' ? 2 : 0);
        requirements.towels += (towelSetsFromSingles + towelSetsFromDoubles + towelSetsFromSofa);
      }
    });
    return requirements;
  }, [shifts, properties]);

  const handleSubmitDamage = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      const newCounts = { ...damageCounts };
      newCounts[selectedItem] = (newCounts[selectedItem] || 0) + damageQuantity;
      saveCounts(newCounts);
      setIsSubmitting(false);
      setShowDamageModal(false);
      setSelectedItem('double sheet');
      setDamageType('Stain');
      setDamageQuantity(1);
    }, 800);
  };

  const handleResetCount = (item: string) => {
    if (!window.confirm(`Clear damage count for ${item}? This confirms you have restocked or disposed of the items.`)) return;
    const newCounts = { ...damageCounts };
    delete newCounts[item];
    saveCounts(newCounts);
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-amber-500 transition-all placeholder:text-slate-300";

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      {showAdminAlert && (
        <section className="bg-red-50 border-2 border-red-600 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-6 text-left flex-1">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0 shadow-lg animate-pulse">
                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="space-y-2">
                 <h4 className="text-sm font-black text-red-700 uppercase tracking-widest">CRITICAL PROCUREMENT REQUIRED</h4>
                 <div className="space-y-1">
                    <p className="text-[11px] text-red-600 font-bold leading-relaxed uppercase">Attention Admin: Some linen categories have exceeded the damage threshold (&gt;10 units) and require replenishment.</p>
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* Sub-Tabs: Line style */}
      <div className="flex gap-8 border-b border-slate-100 px-2">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Inventory Stats
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Damage History
        </button>
      </div>

      {activeTab === 'inventory' && (
        <section className="bg-white text-slate-900 p-10 rounded-[48px] border border-slate-100 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-serif-brand font-bold text-slate-900 uppercase tracking-widest">LINENS IN APARTMENTS</h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Circulation Telemetry</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Double Sets', value: inventoryInApartments.doubleSets, icon: '🛏️' },
                  { label: 'Single Sets', value: inventoryInApartments.singleSets, icon: '🛌' },
                  { label: 'Sofa Sets', value: inventoryInApartments.sofaSets, icon: '🛋️' },
                  { label: 'Towel Sets', value: inventoryInApartments.towels, icon: '🛀' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white border border-slate-100 p-6 rounded-3xl space-y-2 shadow-sm">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xl text-indigo-400 opacity-60">{stat.icon}</span>
                        <p className="text-3xl font-serif-brand font-bold text-indigo-900 leading-none">{stat.value}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <div className="space-y-8 animate-in fade-in">
           {canReportDamage && (
            <section className="bg-indigo-50/30 border border-indigo-100 p-8 rounded-[40px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-left space-y-2">
                  <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Damaged Laundry Hub</h4>
                  <p className="text-[10px] text-slate-500 italic leading-relaxed">"Record damaged items here to maintain Studio fabric quality standards. Total decommissioned count: <span className="font-bold text-indigo-600">{totalDamaged}</span>"</p>
              </div>
              <button 
                onClick={() => setShowDamageModal(true)}
                className="w-full md:w-auto bg-amber-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-amber-700 active:scale-95 transition-all"
              >
                LOG DAMAGE
              </button>
            </section>
          )}

          {allDamagedItems.length > 0 ? (
            <section className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm space-y-6">
              <div className="flex items-center gap-4 px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">DAMAGED INVENTORY LOG</h3>
                <div className="h-px flex-1 bg-slate-50"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allDamagedItems.map(item => (
                  <div key={item.name} className={`flex items-center justify-between p-5 rounded-2xl border transition-all group shadow-sm ${item.count > 10 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                    <div className="text-left">
                      <h5 className={`text-[11px] font-black uppercase tracking-tight ${item.count > 10 ? 'text-red-700' : 'text-slate-900'}`}>{item.name}</h5>
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">{item.count > 10 ? 'Critical' : 'Recorded'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xl font-serif-brand font-bold ${item.count > 10 ? 'text-red-600' : 'text-indigo-900'}`}>{item.count}</span>
                      {isAdmin && (
                        <button onClick={() => handleResetCount(item.name)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-red-500 transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="py-32 text-center border-2 border-dashed border-slate-100 rounded-[40px]">
               <p className="text-slate-400 italic text-[10px] uppercase font-black tracking-widest">No damage records in log</p>
            </div>
          )}
        </div>
      )}

      {showDamageModal && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-slate-100 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-6 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
            <button onClick={() => setShowDamageModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-all"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <header className="space-y-1">
              <h2 className="text-xl font-serif-brand font-bold text-slate-900 uppercase tracking-tight">Report Damaged Linen</h2>
              <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.4em]">Increment Fabric Loss Counter</p>
            </header>
            <form onSubmit={handleSubmitDamage} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className={labelStyle}>Select Fabric Item</label>
                  <select className={inputStyle} value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                    {LINEN_ITEMS.map(item => (<option key={item} value={item}>{item.toUpperCase()}</option>))}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Number of Items Affected</label>
                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button type="button" onClick={() => setDamageQuantity(Math.max(1, damageQuantity - 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-bold hover:bg-slate-50 transition-all">-</button>
                    <input type="number" className="flex-1 bg-transparent text-center text-sm font-bold text-slate-900 outline-none" value={damageQuantity} onChange={e => setDamageQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                    <button type="button" onClick={() => setDamageQuantity(damageQuantity + 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-bold hover:bg-slate-50 transition-all">+</button>
                  </div>
                </div>
                <div>
                  <label className={labelStyle}>Reason for Removal</label>
                  <select className={inputStyle} value={damageType} onChange={e => setDamageType(e.target.value)}>
                    <option value="Stain">Permanent Stain</option>
                    <option value="Tear">Fabric Tear / Hole</option>
                    <option value="Discolor">Bleach / Discoloration</option>
                    <option value="Loss">Structural Loss</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full h-10 bg-amber-600 text-white font-black rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all hover:bg-amber-700 disabled:opacity-50">{isSubmitting ? 'PROCESSING LOSS...' : `REPORT ${damageQuantity} DAMAGED UNITS`}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaundryReports;