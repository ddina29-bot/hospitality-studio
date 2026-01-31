
import React, { useMemo, useState, useRef } from 'react';
import { Shift, Property, UserRole } from '../../types';

interface LaundryReportsProps {
  shifts: Shift[];
  properties: Property[];
  userRole?: UserRole;
}

const LaundryReports: React.FC<LaundryReportsProps> = ({ shifts, properties, userRole }) => {
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState('Double Sheet');
  const [damageType, setDamageType] = useState('Stain');
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Aggregated counts for damaged items
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
    localStorage.setItem('studio_damage_counts', JSON.stringify(counts));
  };

  const LINEN_ITEMS = [
    'Double Sheet',
    'Single Sheet',
    'Double Quilt Cover',
    'Single Quilt Cover',
    'Pillow Cases',
    'Bathmats',
    'Hand Towels',
    'Bath Towels',
    'Beach Towels',
    'Kitchen Clothes',
    'Baby Sheet'
  ];

  // Identify specific items exceeding the critical threshold of 10
  const criticalItems = useMemo(() => {
    return Object.entries(damageCounts)
      .filter(([_, count]) => (count as number) > 10)
      .map(([name, count]) => ({ name, count: count as number }));
  }, [damageCounts]);

  const totalDamaged = useMemo(() => {
    return Object.values(damageCounts).reduce((sum, val) => (sum as number) + (val as number), 0) as number;
  }, [damageCounts]);

  const totalCriticalUnits = useMemo(() => {
    return criticalItems.reduce((sum, item) => sum + item.count, 0);
  }, [criticalItems]);

  // Logic: Count linens from all shifts marked as "PREPARED" (Sent out to apartments)
  const inventoryInApartments = useMemo(() => {
    const requirements = {
      doubleSets: 0,
      singleSets: 0,
      sofaSets: 0,
      towels: 0,
    };

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
    
    // Simulate API call
    setTimeout(() => {
      const newCounts = { ...damageCounts };
      newCounts[selectedItem] = (newCounts[selectedItem] || 0) + damageQuantity;
      saveCounts(newCounts);
      
      setIsSubmitting(false);
      setShowDamageModal(false);
      setSelectedItem('Double Sheet');
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

  const labelStyle = "text-[7px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-black text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/20";

  // LOGIC: Admin sees alerts, Laundry/Staff sees input button
  const isAdmin = userRole === 'admin';
  const showAdminAlert = isAdmin && criticalItems.length > 0;
  const canReportDamage = ['laundry', 'supervisor', 'driver'].includes(userRole || '');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-32">
      {/* Alert only visible to Admin when thresholds are met */}
      {showAdminAlert && (
        <section className="bg-red-50 border-2 border-red-600 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-6 text-left flex-1">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0 shadow-lg animate-pulse">
                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="space-y-2">
                 <h4 className="text-sm font-black text-red-700 uppercase tracking-widest">CRITICAL PROCUREMENT REQUIRED</h4>
                 <div className="space-y-1">
                    <p className="text-[11px] text-red-600 font-bold leading-relaxed uppercase">
                      Attention Admin: The following linen categories have exceeded the damage threshold (&gt;10 units) and require immediate replenishment.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {criticalItems.map(item => (
                        <span key={item.name} className="bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                          {item.name}: {item.count} UNITS
                        </span>
                      ))}
                    </div>
                 </div>
              </div>
           </div>
           {/* Action for admin to acknowledge restock */}
           <div className="w-full md:w-auto text-center md:text-right">
              <p className="text-[8px] text-red-600 font-black uppercase tracking-widest mb-2">RESTOCK & CLEAR</p>
              <div className="flex gap-2 justify-center md:justify-end">
                 {criticalItems.map(item => (
                    <button key={item.name} onClick={() => handleResetCount(item.name)} className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg text-[7px] font-black uppercase hover:bg-red-50">
                       Reset {item.name}
                    </button>
                 ))}
              </div>
           </div>
        </section>
      )}

      <header className="flex flex-col space-y-1">
        <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px]">OPERATIONAL INTELLIGENCE</p>
        <h1 className="text-[10px] font-black text-black uppercase tracking-[0.4em]">LAUNDRY HUB TERMINAL</h1>
        <p className="text-[9px] text-black/30 font-black uppercase tracking-widest mt-1 italic">Active Circulation & Fabric Quality Monitor</p>
      </header>

      {/* Circulation Stats */}
      <section className="bg-[#FDF8EE] text-black p-10 rounded-[48px] border border-[#D4B476]/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        </div>
        <div className="relative z-10 space-y-8">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-serif-brand font-bold text-[#8B6B2E] uppercase tracking-widest">LINENS IN APARTMENTS</h2>
                <p className="text-[9px] font-black text-black/40 uppercase tracking-[0.2em]">Live Circulation Telemetry</p>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Double Sets', value: inventoryInApartments.doubleSets, icon: '🛏️' },
                { label: 'Single Sets', value: inventoryInApartments.singleSets, icon: '🛌' },
                { label: 'Sofa Sets', value: inventoryInApartments.sofaSets, icon: '🛋️' },
                { label: 'Towel Sets', value: inventoryInApartments.towels, icon: '🛀' }
              ].map((stat, i) => (
                <div key={i} className="bg-white/80 border border-[#D4B476]/20 p-6 rounded-3xl space-y-2 shadow-sm">
                   <p className="text-[8px] font-black text-[#8B6B2E]/60 uppercase tracking-widest">{stat.label}</p>
                   <div className="flex items-center gap-3">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-3xl font-serif-brand font-bold text-black leading-none">{stat.value}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* DAMAGE REPORTING SECTION - HIDDEN FROM ADMIN (Visible only to Laundry/Staff) */}
      {canReportDamage && (
        <div className="space-y-6">
          <section className="bg-orange-50 border border-orange-200 p-8 rounded-[40px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-left space-y-2">
                <h4 className="text-sm font-black text-orange-800 uppercase tracking-widest">Damaged Laundry Hub</h4>
                <p className="text-[10px] text-orange-700/60 italic leading-relaxed">
                  "Record damaged items here to maintain Studio fabric quality standards. Total decommissioned count: <span className="font-bold text-orange-800">{totalDamaged}</span>"
                </p>
            </div>
            <button 
              onClick={() => setShowDamageModal(true)}
              className="w-full md:w-auto bg-orange-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl hover:bg-orange-700 active:scale-95 transition-all"
            >
              LOG DAMAGE
            </button>
          </section>
        </div>
      )}

      {/* INVENTORY TRACKER - VISIBLE TO ALL */}
      {totalCriticalUnits > 0 && (
        <section className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-sm space-y-6">
          <div className="flex items-center gap-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-black/20">CRITICAL DAMAGED INVENTORY</h3>
            <div className="h-px flex-1 bg-black/5"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {criticalItems.map(item => (
              <div key={item.name} className="flex items-center justify-between p-5 rounded-2xl border transition-all group bg-red-50/50 border-red-100 shadow-inner">
                <div className="text-left">
                  <h5 className="text-[11px] font-black uppercase tracking-tight text-red-700">{item.name}</h5>
                  <p className="text-[8px] text-black/30 font-black uppercase tracking-widest mt-1">Critical Level</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-serif-brand font-bold text-red-600">{item.count}</span>
                  {isAdmin && (
                    <button 
                      onClick={() => handleResetCount(item.name)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-black/20 hover:text-red-500 transition-all"
                      title="Reset Count (Restocked)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      <p className="text-[9px] text-center text-black/10 uppercase font-black tracking-[0.4em] pt-10 italic">TELEMETRY ACTIVE. COUNTS REFLECT CUMULATIVE DAMAGE REPORTS ACROSS STUDIO ASSETS.</p>

      {/* DAMAGE LOGGING MODAL */}
      {showDamageModal && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-white border border-orange-200 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
            <button onClick={() => setShowDamageModal(false)} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            
            <header className="space-y-1">
              <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">Report Damaged Linen</h2>
              <p className="text-[8px] font-black text-orange-600 uppercase tracking-[0.4em]">Increment Fabric Loss Counter</p>
            </header>

            <form onSubmit={handleSubmitDamage} className="space-y-8">
              <div className="space-y-5">
                <div>
                  <label className={labelStyle}>Select Fabric Item</label>
                  <select 
                    className={inputStyle} 
                    value={selectedItem} 
                    onChange={e => setSelectedItem(e.target.value)}
                  >
                    {LINEN_ITEMS.map(item => (
                      <option key={item} value={item}>{item.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Number of Items Affected</label>
                  <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-1.5">
                    <button type="button" onClick={() => setDamageQuantity(Math.max(1, damageQuantity - 1))} className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-black font-bold hover:bg-gray-100 transition-all">-</button>
                    <input 
                      type="number" 
                      className="flex-1 bg-transparent text-center text-lg font-bold text-black outline-none"
                      value={damageQuantity}
                      onChange={e => setDamageQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button type="button" onClick={() => setDamageQuantity(damageQuantity + 1)} className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-black font-bold hover:bg-gray-100 transition-all">+</button>
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

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-orange-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'PROCESSING LOSS...' : `REPORT ${damageQuantity} DAMAGED UNITS`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaundryReports;
