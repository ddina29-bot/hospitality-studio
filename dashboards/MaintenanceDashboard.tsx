
import React, { useState } from 'react';
import { TabType, User } from '../../types';

interface MaintenanceDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
}

const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({ user, setActiveTab, onLogout }) => {
  const [activeTab, setActiveTabLocal] = useState<'internal' | 'outsourced'>('internal');

  const stats = [
    { label: 'OPEN JOBS', value: '12', sub: 'REPORTS' },
    { label: 'ASSIGNED', value: '8', sub: 'EMPLOYEES' },
    { label: 'EXTERNAL', value: '4', sub: 'OUTSOURCED' },
    { label: 'URGENT', value: '2', sub: 'CRITICAL' }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">TECHNICAL OPERATIONS</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-[#161616] border border-white/5 rounded-2xl p-6 text-center shadow-xl">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-serif-brand font-bold text-white mt-2">{stat.value}</p>
            <p className="text-[7px] font-black text-[#C5A059] uppercase tracking-[0.2em] mt-2">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveTabLocal('internal')} 
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'internal' ? 'bg-[#C5A059] text-black' : 'text-white/40'}`}
          >
            Employed with Us
          </button>
          <button 
            onClick={() => setActiveTabLocal('outsourced')} 
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'outsourced' ? 'bg-[#C5A059] text-black' : 'text-white/40'}`}
          >
            Outsourcing Part
          </button>
        </div>

        <div className="bg-[#1A1A1A] rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-8 space-y-6">
             <h3 className="text-xs font-serif-brand text-white uppercase font-bold tracking-widest">
               {activeTab === 'internal' ? 'INTERNAL MAINTENANCE QUEUE' : 'EXTERNAL CONTRACTOR LOGS'}
             </h3>
             
             {activeTab === 'internal' ? (
               <div className="space-y-4">
                 {[
                   { apt: 'Studio Loft 1', issue: 'AC Filter Cleaning', user: 'Mark Tech', status: 'IN PROGRESS' },
                   { apt: 'Valletta Heritage', issue: 'Lightbulb replacement', user: 'Dave Fix', status: 'PENDING' }
                 ].map((job, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                     <div>
                       <p className="text-xs font-bold text-white uppercase">{job.apt}</p>
                       <p className="text-[8px] text-[#C5A059] uppercase tracking-widest font-black">{job.issue} • {job.user}</p>
                     </div>
                     <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{job.status}</span>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="space-y-4">
                 {[
                   { apt: 'Sliema Penthouse', issue: 'Plumbing (Main leak)', vendor: 'Pipe-Fix Malta', date: 'TODAY' },
                   { apt: 'Republic Apt', issue: 'Electrical Panel', vendor: 'Electro-Grid', date: 'TOMORROW' }
                 ].map((job, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                     <div>
                       <p className="text-xs font-bold text-white uppercase">{job.apt}</p>
                       <p className="text-[8px] text-red-500 uppercase tracking-widest font-black">{job.issue} • {job.vendor}</p>
                     </div>
                     <span className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">{job.date}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDashboard;
