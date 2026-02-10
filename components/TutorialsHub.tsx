
import React, { useState, useRef } from 'react';
import { Tutorial, UserRole, User } from '../types';
import { uploadFile } from '../services/storageService';

interface TutorialsHubProps {
  tutorials: Tutorial[];
  setTutorials: React.Dispatch<React.SetStateAction<Tutorial[]>>;
  userRole: UserRole;
  currentUser?: User;
  onUpdateUser?: (u: User) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const TutorialsHub: React.FC<TutorialsHubProps> = ({ tutorials, setTutorials, userRole, currentUser, onUpdateUser, showToast }) => {
  const [selected, setSelected] = useState<Tutorial | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  
  const [categories, setCategories] = useState<string[]>(['setup', 'cleaning', 'safety']);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [form, setForm] = useState<Partial<Tutorial>>({
    title: '',
    category: 'setup' as any,
    description: '',
    videoUrl: '',
    thumbnail: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isManager = userRole === 'admin' || userRole === 'housekeeping';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) return;

    if (editingTutorial) {
      setTutorials(prev => prev.map(t => t.id === editingTutorial.id ? { ...t, ...form } as Tutorial : t));
      if (showToast) showToast('TUTORIAL UPDATED', 'success');
    } else {
      const newTutorial: Tutorial = {
        ...form,
        id: `tut-${Date.now()}`,
        thumbnail: form.thumbnail || 'https://images.unsplash.com/photo-1584622781564-1d9876a3e75a?auto=format&fit=crop&w=500&q=80'
      } as Tutorial;
      setTutorials(prev => [...prev, newTutorial]);
      if (showToast) showToast('NEW TUTORIAL ADDED', 'success');
    }
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTutorial(null);
    setShowNewCatInput(false);
    setForm({ title: '', category: 'setup' as any, description: '', videoUrl: '', thumbnail: '' });
  };

  const handleEdit = (e: React.MouseEvent, tut: Tutorial) => {
    e.stopPropagation();
    setEditingTutorial(tut);
    setForm(tut);
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Permanently remove this instruction?')) {
      setTutorials(prev => prev.filter(t => t.id !== id));
      if (showToast) showToast('TUTORIAL REMOVED', 'info');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        const url = await uploadFile(file);
        setForm(prev => ({ ...prev, thumbnail: url }));
    } catch (err) {
        console.error("Upload failed", err);
        alert("Failed to upload image.");
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const cat = newCatName.toLowerCase().trim();
    if (!categories.includes(cat)) {
      setCategories(prev => [...prev, cat]);
    }
    setForm({ ...form, category: cat as any });
    setNewCatName('');
    setShowNewCatInput(false);
  };

  const markCompleted = (tut: Tutorial) => {
    if (!currentUser || !onUpdateUser) return;
    const progress = { ...(currentUser.onboardingProgress || {}) };
    progress[tut.id] = true;
    onUpdateUser({ ...currentUser, onboardingProgress: progress });
    if (showToast) showToast(`MODULE COMPLETED: ${tut.title}`, 'success');
    setSelected(null);
  };

  const labelStyle = "text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] opacity-80 mb-1.5 block px-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all placeholder:text-slate-300";

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">STANDARD OPERATING PROCEDURES</h2>
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em] opacity-80">Official Methodologies Hub</p>
        </div>
        {isManager && (
          <button 
            onClick={() => { setEditingTutorial(null); setForm({ category: 'setup' as any, title: '', description: '', videoUrl: '', thumbnail: '' }); setShowModal(true); }}
            className="bg-teal-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all hover:bg-teal-700"
          >
            ADD TUTORIAL
          </button>
        )}
      </header>

      <div className="space-y-12">
        {categories.map(cat => (
          <section key={cat} className="space-y-6">
            <div className="flex items-center gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-900">{cat.toUpperCase()} PROTOCOLS</h3>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {tutorials.filter(t => t.category === cat).map(t => {
                 const isDone = currentUser?.onboardingProgress?.[t.id];
                 return (
                 <div key={t.id} onClick={() => setSelected(t)} className={`bg-white rounded-[32px] overflow-hidden border border-slate-200 hover:border-teal-500/40 transition-all group cursor-pointer shadow-xl relative ${isDone ? 'ring-2 ring-emerald-500/50' : ''}`}>
                    {isManager && (
                      <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={(e) => handleEdit(e, t)} className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-black hover:text-teal-600 backdrop-blur-md border border-slate-200"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                         <button onClick={(e) => handleDelete(e, t.id)} className="w-8 h-8 bg-red-50/80 rounded-full flex items-center justify-center text-red-600 hover:text-red-700 backdrop-blur-md border border-red-500/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                      </div>
                    )}
                    {isDone && (
                      <div className="absolute top-4 left-4 z-10 bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-in zoom-in">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                        COMPLETED
                      </div>
                    )}
                    <div className="h-44 relative overflow-hidden">
                       <img src={t.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80" alt={t.title} />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-teal-600/20 border border-teal-600/40 flex items-center justify-center backdrop-blur-md shadow-2xl">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-teal-600 ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
                          </div>
                       </div>
                    </div>
                    <div className="p-6">
                       <h4 className="text-slate-900 font-bold uppercase text-sm tracking-tight">{t.title}</h4>
                       <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed italic">"{t.description}"</p>
                    </div>
                 </div>
               )})}
               {tutorials.filter(t => t.category === cat).length === 0 && (
                 <div className="col-span-full py-10 border border-dashed border-slate-200 rounded-[32px] text-center italic text-[10px] uppercase text-slate-400">No protocols listed.</div>
               )}
            </div>
          </section>
        ))}
      </div>

      {/* Viewing Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
           <div className="bg-white border border-slate-200 rounded-[48px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
              <button onClick={() => setSelected(null)} className="absolute top-8 right-8 text-slate-400 z-10 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 space-y-8 text-left">
                <header className="pr-12">
                   <h2 className="text-xl md:text-2xl font-serif-brand font-bold text-slate-900 uppercase tracking-tight leading-tight">{selected.title}</h2>
                   <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.3em] mt-2 opacity-60">Category: {selected.category}</p>
                </header>

                <div className="aspect-video bg-black rounded-[32px] border border-slate-200 flex items-center justify-center text-white/10 overflow-hidden shadow-inner relative">
                   {selected.videoUrl ? (
                     <iframe width="100%" height="100%" src={selected.videoUrl.replace("watch?v=", "embed/")} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                   ) : (
                     <div className="text-center space-y-2">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-white/5"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"/><path d="m16 16 2 2 4-4"/><path d="m5 10 3 3 4.5-4.5"/></svg>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Official Instructional Stream</p>
                     </div>
                   )}
                </div>

                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Summary & Protocol</p>
                   <p className="text-slate-700 text-sm leading-relaxed italic font-serif-brand whitespace-pre-line">{selected.description}</p>
                </div>

                {!currentUser?.onboardingProgress?.[selected.id] && (
                  <button 
                    onClick={() => markCompleted(selected)}
                    className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl active:scale-95 transition-all hover:bg-emerald-700"
                  >
                    ACKNOWLEDGE MODULE & COMPLETE
                  </button>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Creation/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[48px] w-full max-w-2xl p-10 space-y-10 shadow-2xl relative my-auto text-left">
            <button onClick={closeModal} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-serif-brand font-bold text-slate-900 uppercase tracking-tight">{editingTutorial ? 'Refine Tutorial' : 'New Tutorial Registration'}</h2>
              <div className="space-y-1">
                <p className={labelStyle}>Knowledge Management Hub</p>
                <p className="text-[9px] text-slate-400 italic px-1">Register official Standard Operating Procedures (SOPs) to ensure consistent quality across all Studio deployments.</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelStyle}>Tutorial Title</label>
                  <input required className={inputStyle} value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="E.G. WINDOW SANITIZATION" />
                </div>
                <div className="relative">
                  <label className={labelStyle}>Protocol Category</label>
                  <div className="flex gap-2">
                    {showNewCatInput ? (
                      <div className="flex-1 flex gap-2 animate-in slide-in-from-right-2">
                        <input 
                          autoFocus
                          className={inputStyle} 
                          value={newCatName} 
                          onChange={e => setNewCatName(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                          placeholder="Category Name" 
                        />
                        <button type="button" onClick={handleAddCategory} className="w-10 bg-teal-600 text-white font-black rounded-lg flex items-center justify-center shrink-0 hover:bg-teal-700">✓</button>
                        <button type="button" onClick={() => setShowNewCatInput(false)} className="w-10 bg-white border border-slate-200 text-slate-400 font-black rounded-lg flex items-center justify-center shrink-0">×</button>
                      </div>
                    ) : (
                      <>
                        <select className={`${inputStyle} bg-white`} value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                          {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowNewCatInput(true)} className="w-10 bg-white border border-slate-200 text-teal-600 font-black rounded-lg flex items-center justify-center shrink-0 hover:bg-slate-50 transition-all shadow-sm">+</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelStyle}>Protocol Summary (Detailed Instructions)</label>
                <textarea required className={inputStyle + " h-32 py-4 italic"} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed step-by-step instructions for personnel..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className={labelStyle}>Video Resource Link</label>
                    <input className={inputStyle} value={form.videoUrl} onChange={e => setForm({...form, videoUrl: e.target.value})} placeholder="YouTube / Vimeo URL" />
                 </div>
                 <div>
                    <label className={labelStyle}>Reference Thumbnail</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between px-4 cursor-pointer hover:border-teal-500 transition-all"
                    >
                       <span className="text-[10px] text-slate-400 uppercase font-black truncate max-w-[150px]">{form.thumbnail ? 'Image Attached' : 'Select Frame'}</span>
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                 </div>
              </div>

              <button type="submit" className="w-full bg-teal-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-95 transition-all hover:bg-teal-700">
                {editingTutorial ? 'UPDATE TUTORIAL' : 'ADD TUTORIAL'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialsHub;
