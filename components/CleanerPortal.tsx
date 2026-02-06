
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Property, CleaningTask, Shift, User, AttributedPhoto, SpecialReport, SupplyItem } from '../types';
import { uploadFile } from '../services/storageService';

const parseTimeValue = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) hours = 0;
  if (modifier === 'PM') hours += 12;
  return hours * 60 + minutes;
};

const getLocalISO = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface CleanerPortalProps {
  user: User;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties: Property[];
  users: User[];
  initialSelectedShiftId?: string | null;
  onConsumedDeepLink?: () => void;
  inventoryItems?: SupplyItem[];
  onAddSupplyRequest?: (batch: Record<string, number>) => void;
  onUpdateUser?: (u: User) => void;
}

const CleanerPortal: React.FC<CleanerPortalProps> = ({ 
  user, shifts, setShifts, properties, users, initialSelectedShiftId, onConsumedDeepLink,
  inventoryItems = [], onAddSupplyRequest, onUpdateUser
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(initialSelectedShiftId || null);
  const [currentStep, setCurrentStep] = useState<'list' | 'overview' | 'active' | 'review'>('list');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [timer, setTimer] = useState(0);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [keyInBoxPhotos, setKeyInBoxPhotos] = useState<AttributedPhoto[]>([]);
  const [boxClosedPhotos, setBoxClosedPhotos] = useState<AttributedPhoto[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<'keyInBox' | 'boxClosed' | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const checkoutKeyRef = useRef<HTMLInputElement>(null);

  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDateISO, setViewedDateISO] = useState(realTodayISO);

  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDateISO.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDateISO]);

  const activeShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
  const activeProperty = useMemo(() => activeShift ? properties.find(p => p.id === activeShift.propertyId) : null, [activeShift, properties]);

  const activeQueue = useMemo(() => {
    return shifts
      .filter(s => s.isPublished && s.userIds.includes(user.id) && s.date === viewedDateStr)
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
      });
  }, [shifts, user.id, viewedDateStr]);

  const generateDynamicTasks = (property: Property): CleaningTask[] => {
    const dynamicTasks: CleaningTask[] = [];
    dynamicTasks.push({ id: 'kitchen', label: 'KITCHEN: Surfaces & Appliances sanitized', isMandatory: true, minPhotos: 1, photos: [] });
    dynamicTasks.push({ id: 'fridge', label: 'FRIDGE: Cleaned & Odor-free', isMandatory: true, minPhotos: 1, photos: [] });
    for (let i = 1; i <= (property.rooms || 1); i++) {
      dynamicTasks.push({ id: `room-${i}`, label: `BEDROOM ${i}: Linens changed & styled`, isMandatory: true, minPhotos: 1, photos: [] });
    }
    dynamicTasks.push({ id: 'living', label: 'LIVING AREA: Dusting & Vacuuming', isMandatory: true, minPhotos: 1, photos: [] });
    dynamicTasks.push({ id: 'welcome', label: 'WELCOME PACK: Replenished', isMandatory: true, minPhotos: 1, photos: [] });
    return dynamicTasks;
  };

  useEffect(() => {
    if (selectedShiftId && currentStep === 'active' && activeProperty) {
      const storageKey = `reset_tasks_v3_${selectedShiftId}`;
      const savedTasks = localStorage.getItem(storageKey);
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      else setTasks(generateDynamicTasks(activeProperty));
    }
  }, [selectedShiftId, currentStep, activeProperty]);

  useEffect(() => {
    let interval: any;
    if (currentStep === 'active' && activeShift?.actualStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeShift.actualStartTime!) / 1000);
        setTimer(elapsed > 0 ? elapsed : 0);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, activeShift]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, target: 'task' | 'checkout') => {
    const file = e.target.files?.[0];
    if (!file || isProcessingPhoto) return;
    setIsProcessingPhoto(true);
    try {
      const url = await uploadFile(file);
      if (url) {
        const attributed: AttributedPhoto = { url, userId: user.id };
        if (target === 'checkout') {
          if (checkoutTarget === 'keyInBox') setKeyInBoxPhotos(prev => [...prev, attributed]);
          else if (checkoutTarget === 'boxClosed') setBoxClosedPhotos(prev => [...prev, attributed]);
        } else if (target === 'task') {
          setTasks(prev => prev.map(t => t.id === (activeTaskId || prev[0].id) ? { ...t, photos: [...t.photos, attributed] } : t));
        }
      }
    } catch (error) { 
        alert("Upload failed. Check your connection."); 
    } finally { 
      setIsProcessingPhoto(false);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleStartShift = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'active', actualStartTime: Date.now() } as Shift) : s));
    setCurrentStep('active');
  };

  const handleFinishShift = () => {
    if (!selectedShiftId || isFinishing) return;
    if (keyInBoxPhotos.length < 1 || boxClosedPhotos.length < 1) {
      alert("SECURITY EVIDENCE REQUIRED: Keybox photos must be captured.");
      return;
    }
    setIsFinishing(true);
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
        ...s, status: 'completed', actualEndTime: Date.now(), approvalStatus: 'pending', tasks: tasks,
        checkoutPhotos: { keyInBox: keyInBoxPhotos, boxClosed: boxClosedPhotos }
    } as Shift) : s));
    setTimeout(() => {
        setIsFinishing(false);
        setCurrentStep('list'); 
        setSelectedShiftId(null);
    }, 500);
  };

  if (currentStep === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-32 max-w-2xl mx-auto text-left">
        <header className="px-1 text-left">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Field Ops</p>
          <h1 className="text-3xl font-brand text-[#1E293B] tracking-tighter uppercase font-extrabold text-left">Assignments</h1>
        </header>
        <div className="space-y-4">
          {activeQueue.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue clear for {viewedDateStr}</p>
            </div>
          ) : activeQueue.map(shift => (
            <div key={shift.id} onClick={() => { setSelectedShiftId(shift.id); setCurrentStep(shift.status === 'active' ? 'active' : 'overview'); }} className={`p-6 rounded-[2rem] border transition-all shadow-sm ${shift.status === 'active' ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-center">
                 <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-900 uppercase leading-none tracking-tight">{shift.propertyName}</h3>
                    <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest mt-2">{shift.startTime} • {shift.serviceType}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6"/></svg></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (currentStep === 'overview' && activeShift) {
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-6 text-left pb-32 max-w-2xl mx-auto">
         <header className="space-y-2 text-left">
            <button onClick={() => setCurrentStep('list')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">← Back</button>
            <h2 className="text-3xl font-brand font-extrabold uppercase text-slate-900 leading-tight text-left">{activeShift.propertyName}</h2>
         </header>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8">
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner text-left">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-left">Location</p>
               <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed text-left">{activeProperty?.address}</p>
            </div>
            <div className="bg-teal-50/80 p-8 rounded-[2rem] border border-teal-100 space-y-4 text-left">
               <h4 className="text-[9px] font-black text-teal-700 uppercase tracking-widest text-left">Entry Instructions</h4>
               <p className="text-xs font-medium text-slate-600 leading-relaxed italic text-left">"{activeProperty?.accessNotes || 'Standard keybox access.'}"</p>
            </div>
            <button onClick={handleStartShift} className="w-full bg-[#0D9488] text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">CLOCK IN & COMMENCE</button>
         </div>
      </div>
    );
  }

  if (currentStep === 'active' && activeShift) {
    return (
      <div className="animate-in fade-in duration-500 pb-32 text-left max-w-2xl mx-auto">
         <div className="bg-slate-900 p-8 rounded-b-[3.5rem] text-white space-y-6 mb-8 shadow-2xl relative overflow-hidden text-left">
            <div className="flex justify-between items-start text-left">
               <div className="text-left">
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-left">{activeShift.propertyName}</h2>
                  <div className="flex items-center gap-2 mt-2.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
                     <p className="text-[8px] font-black text-teal-400 uppercase tracking-[0.3em] text-left">LIVE MISSION • {Math.floor(timer/3600)}h {Math.floor((timer%3600)/60)}m</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="px-3 space-y-8">
            {tasks.map(task => (
              <div key={task.id} className={`p-6 rounded-[2.5rem] border transition-all shadow-sm flex flex-col items-center text-center ${task.photos.length > 0 ? 'bg-teal-50/50 border-teal-500' : 'bg-white border-slate-100'}`}>
                 <p className="text-xs font-bold text-slate-700 uppercase leading-snug tracking-tight mb-6 max-w-xs">{task.label}</p>
                 <div className="flex flex-wrap justify-center gap-3 w-full">
                    {task.photos.map((p, i) => (
                      <img key={i} src={p.url} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                    ))}
                    <button 
                      onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }}
                      disabled={isProcessingPhoto}
                      className={`w-full max-w-[200px] py-4 rounded-2xl flex items-center justify-center transition-all active:scale-90 gap-3 ${task.photos.length > 0 ? 'bg-teal-600 text-white' : 'bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400'}`}
                    >
                      {isProcessingPhoto && activeTaskId === task.id ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span className="text-[10px] font-black uppercase tracking-widest">Take Photo</span></>}
                    </button>
                 </div>
              </div>
            ))}
            <button onClick={() => setCurrentStep('review')} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">PROCEED TO DEBRIEF</button>
         </div>
         <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />
      </div>
    );
  }

  if (currentStep === 'review' && activeShift) {
    return (
      <div className="animate-in slide-in-from-right-6 pb-32 text-left space-y-10 max-w-2xl mx-auto">
         <header className="px-4 space-y-1 mt-6 text-left">
            <h2 className="text-3xl font-brand font-extrabold uppercase text-slate-900 text-left">Final Debrief</h2>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em] text-left">Checkout Protocol</p>
         </header>
         <div className="mx-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl space-y-10">
            <div className="bg-slate-50 p-8 rounded-[2rem] text-center border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2.5">Final Keybox Code</p>
               <p className="text-4xl font-mono font-black text-teal-600 tracking-[0.4em]">{activeProperty?.keyboxCode}</p>
            </div>
            <div className="space-y-10">
               <div className="space-y-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">1. Key Evidence (In Box)</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {keyInBoxPhotos.map((p, i) => <img key={i} src={p.url} className="w-20 h-20 rounded-[1.5rem] object-cover border-2 border-white shadow-lg" />)}
                    <button onClick={() => { setCheckoutTarget('keyInBox'); checkoutKeyRef.current?.click(); }} className="w-full max-w-[200px] py-4 rounded-xl bg-slate-50 border-2 border-dashed border-teal-200 text-teal-600 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest">+</button>
                  </div>
               </div>
               <div className="space-y-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">2. Box Security Evidence</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {boxClosedPhotos.map((p, i) => <img key={i} src={p.url} className="w-20 h-20 rounded-[1.5rem] object-cover border-2 border-white shadow-lg" />)}
                    <button onClick={() => { setCheckoutTarget('boxClosed'); checkoutKeyRef.current?.click(); }} className="w-full max-w-[200px] py-4 rounded-xl bg-slate-50 border-2 border-dashed border-teal-200 text-teal-600 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest">+</button>
                  </div>
               </div>
            </div>
            <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
         </div>
         <div className="px-4 flex flex-col gap-4">
            <button onClick={() => setCurrentStep('active')} className="w-full py-5 rounded-3xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase">Back</button>
            <button onClick={handleFinishShift} disabled={isFinishing} className="w-full bg-[#0D9488] text-white py-6 rounded-3xl font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl">{isFinishing ? 'FINISHING...' : 'FINISH MISSION'}</button>
         </div>
      </div>
    );
  }

  return null;
};

export default CleanerPortal;
