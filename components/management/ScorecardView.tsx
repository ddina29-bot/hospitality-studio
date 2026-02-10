
import React from 'react';
import { User, Shift, Scorecard } from '../../types';

interface ScorecardViewProps {
  user: User;
  shifts: Shift[];
}

const ScorecardView: React.FC<ScorecardViewProps> = ({ user, shifts }) => {
  const stats = React.useMemo(() => {
    const myCompleted = shifts.filter(s => s.userIds.includes(user.id) && s.status === 'completed');
    const approved = myCompleted.filter(s => s.approvalStatus === 'approved');
    
    const qualityIndex = myCompleted.length === 0 ? 100 : Math.round((approved.length / myCompleted.length) * 100);
    const reliability = myCompleted.length === 0 ? 100 : 95; // Mocked for now
    
    let totalDur = 0;
    myCompleted.forEach(s => {
      if (s.actualStartTime && s.actualEndTime) {
        totalDur += (s.actualEndTime - s.actualStartTime) / 3600000;
      }
    });
    const avgDur = myCompleted.length === 0 ? 0 : totalDur / myCompleted.length;
    
    let grade: Scorecard['grade'] = 'C';
    if (qualityIndex >= 98) grade = 'A+';
    else if (qualityIndex >= 90) grade = 'A';
    else if (qualityIndex >= 80) grade = 'B';
    else if (qualityIndex >= 70) grade = 'C';
    else grade = 'D';

    return {
      qualityIndex,
      reliability,
      avgDur: avgDur.toFixed(1),
      grade,
      completedCount: myCompleted.length,
      points: myCompleted.length * 10 + approved.length * 5
    };
  }, [user.id, shifts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Grade Card */}
        <div className="md:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between items-center text-center">
           <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
           </div>
           <div className="relative z-10 w-full">
              <p className="text-[8px] font-black text-teal-400 uppercase tracking-[0.4em] mb-4">Official Rating</p>
              <div className="w-32 h-32 rounded-full border-4 border-teal-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(20,184,166,0.2)]">
                 <span className="text-6xl font-black tracking-tighter text-white">{stats.grade}</span>
              </div>
              <h3 className="text-xl font-bold uppercase mt-6 tracking-tight">Master Operator</h3>
              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1">Level {Math.floor(stats.points / 100) + 1} Profile</p>
           </div>
        </div>

        {/* Vital Stats Grid */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Quality Index</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.qualityIndex}%</span>
                 <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">▲ Top 10%</span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                 <div className="h-full bg-teal-500" style={{ width: `${stats.qualityIndex}%` }}></div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Operational Velocity</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.avgDur}h</span>
                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Avg Duration</span>
              </div>
              <p className="text-[8px] text-slate-400 mt-4 uppercase font-bold tracking-widest italic">Optimized deployment speed.</p>
           </div>

           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reliability Score</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.reliability}%</span>
              </div>
              <div className="flex gap-1 mt-4">
                 {[1,2,3,4,5].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 4 ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>)}
              </div>
           </div>

           <div className="bg-[#F8FAFC] p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Experience Points</p>
              <span className="text-3xl font-black text-[#0D9488] tracking-tighter">{stats.points} XP</span>
              <p className="text-[7px] text-slate-400 mt-2 uppercase font-black tracking-widest">{(Math.floor(stats.points / 100) + 1) * 100 - stats.points} XP to next level</p>
           </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl space-y-6">
         <div className="flex justify-between items-center border-b border-slate-50 pb-4">
            <h3 className="text-xs font-black uppercase tracking-widest">Deployment Performance History</h3>
            <span className="text-[8px] font-black text-teal-600 uppercase bg-teal-50 px-3 py-1 rounded-full">Last 10 Mission Audits</span>
         </div>
         <div className="space-y-3">
            {shifts.filter(s => s.userIds.includes(user.id) && s.status === 'completed').slice(0, 10).map(s => (
               <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-teal-200 transition-all group">
                  <div className="flex items-center gap-4">
                     <div className={`w-2 h-2 rounded-full ${s.approvalStatus === 'approved' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                     <div>
                        <p className="text-[11px] font-bold text-slate-900 uppercase leading-none">{s.propertyName}</p>
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.date} • {s.serviceType}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     {s.fixWorkPayment && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">FIX BONUS</span>}
                     <span className={`text-[8px] font-black uppercase tracking-widest ${s.approvalStatus === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>{s.approvalStatus}</span>
                  </div>
               </div>
            ))}
            {shifts.filter(s => s.userIds.includes(user.id) && s.status === 'completed').length === 0 && (
               <div className="py-20 text-center opacity-20">
                  <p className="text-[10px] font-black uppercase tracking-widest">Mission History Clear</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ScorecardView;
