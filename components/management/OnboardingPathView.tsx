
import React from 'react';
import { User, Tutorial } from '../../types';

interface OnboardingPathViewProps {
  user: User;
  tutorials: Tutorial[];
  onNavigateToTutorials: () => void;
}

const OnboardingPathView: React.FC<OnboardingPathViewProps> = ({ user, tutorials, onNavigateToTutorials }) => {
  const progress = user.onboardingProgress || {};
  
  const stages = [
    {
      id: 'stage-1',
      title: 'Foundation & Compliance',
      description: 'Identity verification and legal documentation.',
      milestones: [
        { id: 'hasID', label: 'ID/Passport Verification', completed: user.hasID },
        { id: 'hasContract', label: 'Employment Contract', completed: user.hasContract },
        { id: 'profile-complete', label: 'Full Profile Data', completed: !!user.homeAddress && !!user.dateOfBirth }
      ]
    },
    {
      id: 'stage-2',
      title: 'Operational Theory',
      description: 'Master the Studio standards via training modules.',
      milestones: tutorials.filter(t => t.category === 'setup').map(t => ({
        id: t.id,
        label: t.title,
        completed: progress[t.id],
        isTutorial: true
      }))
    },
    {
      id: 'stage-3',
      title: 'Field Execution',
      description: 'First successful property deployments.',
      milestones: [
        { id: 'first-shift', label: 'First Live Deployment', completed: (user.scorecard?.totalPoints || 0) > 0 },
        { id: 'first-approval', label: 'First Approved Quality Audit', completed: (user.scorecard?.qualityIndex || 0) > 0 }
      ]
    },
    {
      id: 'stage-4',
      title: 'Master Operator',
      description: 'Consistency and quality excellence.',
      milestones: [
        { id: 'consistency-badge', label: 'Maintain 95%+ Quality Index', completed: (user.scorecard?.qualityIndex || 0) >= 95 },
        { id: 'efficiency-pro', label: 'Reach Experience Level 5', completed: (user.scorecard?.level || 1) >= 5 }
      ]
    }
  ];

  const totalMilestones = stages.flatMap(s => s.milestones).length;
  const completedMilestones = stages.flatMap(s => s.milestones).filter(m => m.completed).length;
  const overallProgress = Math.round((completedMilestones / totalMilestones) * 100);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left">
      {/* Progress Dashboard */}
      <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
         <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="white"><path d="M12 2L1 12l1.41 1.41L12 3.83l9.59 9.58L23 12 12 2z"/><path d="M12 7.83l-7.59 7.58L5.83 16.82 12 10.65l6.17 6.17 1.41-1.41L12 7.83z"/></svg>
         </div>
         
         <div className="relative z-10">
            <div className="w-32 h-32 rounded-full border-8 border-teal-500/20 flex items-center justify-center relative">
               <svg className="w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                  <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" 
                    strokeDasharray={351.85} 
                    strokeDashoffset={351.85 - (351.85 * overallProgress / 100)} 
                    className="text-teal-400 transition-all duration-1000" 
                  />
               </svg>
               <span className="absolute text-2xl font-black">{overallProgress}%</span>
            </div>
         </div>

         <div className="relative z-10 flex-1 space-y-4">
            <h3 className="text-3xl font-black uppercase tracking-tighter">Onboarding Journey</h3>
            <p className="text-white/60 text-sm leading-relaxed max-w-lg">
               You are currently in the <span className="text-teal-400 font-bold">Training & Integration</span> phase. 
               Complete all milestones below to unlock the <span className="text-amber-400 font-bold">Elite Operator</span> status and higher tier deployments.
            </p>
            <div className="flex gap-4">
               <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Tasks Done</p>
                  <p className="text-lg font-bold">{completedMilestones} / {totalMilestones}</p>
               </div>
               <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-white/40 uppercase tracking-widest">Current Tier</p>
                  <p className="text-lg font-bold uppercase text-teal-400">Junior</p>
               </div>
            </div>
         </div>
      </section>

      {/* Roadmap Stages */}
      <div className="grid grid-cols-1 gap-6 relative">
         {/* Vertical connector line */}
         <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-slate-100 hidden md:block"></div>

         {stages.map((stage, sIdx) => {
            const isStageDone = stage.milestones.every(m => m.completed);
            const isStageStarted = stage.milestones.some(m => m.completed);

            return (
              <div key={stage.id} className="relative flex flex-col md:flex-row gap-8 items-start group">
                 {/* Stage Marker */}
                 <div className="relative z-10 hidden md:flex w-16 h-16 rounded-full border-4 border-white shadow-xl items-center justify-center shrink-0 transition-all group-hover:scale-110">
                    <div className={`w-full h-full rounded-full flex items-center justify-center font-black text-lg ${isStageDone ? 'bg-teal-500 text-white' : isStageStarted ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-100 text-slate-300'}`}>
                       {isStageDone ? '✓' : sIdx + 1}
                    </div>
                 </div>

                 {/* Content Card */}
                 <div className={`flex-1 bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all ${isStageDone ? 'border-teal-100' : isStageStarted ? 'border-indigo-100 ring-2 ring-indigo-50' : 'border-slate-50 opacity-60 grayscale'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                       <div>
                          <h4 className="text-xl font-bold uppercase tracking-tight text-slate-900">{stage.title}</h4>
                          <p className="text-xs text-slate-400 mt-1">{stage.description}</p>
                       </div>
                       {isStageDone && <span className="bg-teal-50 text-teal-600 px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-teal-100">Stage Verified</span>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {stage.milestones.map((m, mIdx) => (
                          <div key={mIdx} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${m.completed ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-80'}`}>
                             <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.completed ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border-2 border-slate-200 text-slate-200'}`}>
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <p className={`text-[10px] font-bold uppercase tracking-tight truncate ${m.completed ? 'text-emerald-800' : 'text-slate-400'}`}>{m.label}</p>
                             </div>
                             {(!m.completed && m.isTutorial) && (
                               <button onClick={onNavigateToTutorials} className="text-[8px] font-black text-indigo-600 uppercase hover:underline">Learn →</button>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
            );
         })}
      </div>

      <div className="py-10 text-center border-t border-slate-50">
         <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Official Onboarding Protocol v1.4 • reset hospitality studio</p>
      </div>
    </div>
  );
};

export default OnboardingPathView;
