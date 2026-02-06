
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

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const [isLocationVerified, setIsLocationVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  
  const [keyInBoxPhotos, setKeyInBoxPhotos] = useState<AttributedPhoto[]>([]);
  const [boxClosedPhotos, setBoxClosedPhotos] = useState<AttributedPhoto[]>([]);

  const [showMessReport, setShowMessReport] = useState(false);
  const [messDescription, setMessDescription] = useState('');
  const [messPhotos, setMessPhotos] = useState<string[]>([]);

  const [reportModalType, setReportModalType] = useState<'maintenance' | 'damage' | 'missing' | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messCameraRef = useRef<HTMLInputElement>(null);
  const reportCameraRef = useRef<HTMLInputElement>(null);
  const checkoutKeyRef = useRef<HTMLInputElement>(null);
  
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<'keyInBox' | 'boxClosed' | null>(null);

  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDateISO, setViewedDateISO] = useState(realTodayISO);

  const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const viewedDateStr = useMemo(() => {
    const [y, m, d] = viewedDateISO.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  }, [viewedDateISO]);

  const activeShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
  const activeProperty = useMemo(() => activeShift ? properties.find(p => p.id === activeShift.propertyId) : null, [activeShift, properties]);

  const currentlyActiveShift = useMemo(() => {
    return shifts.find(s => s.status === 'active' && s.userIds.includes(user.id));
  }, [shifts, user.id]);

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
    dynamicTasks.push({ id: 'kitchen-task', label: 'KITCHEN: Surfaces & Appliances sanitized', isMandatory: true, minPhotos: 1, photos: [] });
    dynamicTasks.push({ id: 'fridge-task', label: 'FRIDGE: Cleaned & Odor-free', isMandatory: true, minPhotos: 1, photos: [] });
    for (let i = 1; i <= (property.rooms || 1); i++) {
      dynamicTasks.push({ id: `room-task-${i}`, label: `BEDROOM ${i}: Linens changed & styled`, isMandatory: true, minPhotos: 1, photos: [] });
    }
    for (let i = 1; i <= (property.bathrooms || 1); i++) {
      dynamicTasks.push({ id: `bath-task-${i}`, label: `BATHROOM ${i}: Deep cleaned & polished`, isMandatory: true, minPhotos: 1, photos: [] });
    }
    dynamicTasks.push({ id: 'living-task', label: 'LIVING AREA: Dusting & Vacuuming', isMandatory: true, minPhotos: 1, photos: [] });
    dynamicTasks.push({ id: 'welcome-task', label: 'WELCOME PACK: Replenished', isMandatory: true, minPhotos: 1, photos: [] });
    return dynamicTasks;
  };

  useEffect(() => {
    if (selectedShiftId && currentStep === 'active' && activeProperty) {
      const storageKey = `reset_tasks_v2_${selectedShiftId}`;
      const savedTasks = localStorage.getItem(storageKey);
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      else setTasks(generateDynamicTasks(activeProperty));
    }
  }, [selectedShiftId, currentStep, activeProperty]);

  useEffect(() => {
    if (selectedShiftId && tasks.length > 0) {
      localStorage.setItem(`reset_tasks_v2_${selectedShiftId}`, JSON.stringify(tasks));
    }
  }, [tasks, selectedShiftId]);

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

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, target: 'task' | 'mess' | 'report' | 'checkout') => {
    const file = e.target.files?.[0];
    if (!file || isProcessingPhoto) return;
    setIsProcessingPhoto(true);
    try {
      const url = await uploadFile(file);
      if (url) {
        const attributed: AttributedPhoto = { url: url, userId: user.id };
        if (target === 'mess') setMessPhotos(prev => [...prev, url]);
        else if (target === 'report') setReportPhotos(prev => [...prev, url]);
        else if (target === 'checkout') {
            if (checkoutTarget === 'keyInBox') setKeyInBoxPhotos(prev => [...prev, attributed]);
            else if (checkoutTarget === 'boxClosed') setBoxClosedPhotos(prev => [...prev, attributed]);
        }
        else if (target === 'task') {
          const tId = activeTaskId || tasks[0].id;
          const newTasks = tasks.map(t => t.id === tId ? { ...t, photos: [...t.photos, attributed] } : t);
          setTasks(newTasks);
        }
      }
    } catch (error) { 
      showNotification("Upload failed.", 'error'); 
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
      showNotification("SECURITY EVIDENCE REQUIRED.", 'error');
      return;
    }
    setIsFinishing(true);
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
        ...s, 
        status: 'completed', 
        actualEndTime: Date.now(), 
        approvalStatus: 'pending', 
        tasks: tasks,
        checkoutPhotos: { keyInBox: keyInBoxPhotos, boxClosed: boxClosedPhotos }
    } as Shift) : s));
    localStorage.removeItem(`reset_tasks_v2_${selectedShiftId}`);
    setTimeout(() => {
        setIsFinishing(false);
        setCurrentStep('list'); 
        setSelectedShiftId(null);
    }, 500);
  };

  if (currentStep === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto text-left">
        <header className="px-1">
          <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Field Ops</p>
          <h1 className="text-3xl font-brand text-[#1E293B] tracking-tighter uppercase font-extrabold">Assignments</h1>
        </header>

        <div className="space-y-4">
          {activeQueue.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue clear for today</p>
            </div>
          ) : activeQueue.map(shift => (
            <div 
              key={shift.id} 
              onClick={() => {
                if (currentlyActiveShift && currentlyActiveShift.id !== shift.id) {
                    showNotification(`FINISH ${currentlyActiveShift.propertyName} FIRST`, 'error');
                    return;
                }
                setSelectedShiftId(shift.id);
                setCurrentStep(shift.status === 'active' ? 'active' : 'overview');
              }}
              className={`p-6 rounded-[2rem] border transition-all active:scale-[0.98] shadow-sm ${shift.status === 'active' ? 'bg-teal-50 border-teal-500' : shift.status === 'completed' ? 'bg-gray-50 border-slate-100 opacity-60' : 'bg-white border-slate-100'}`}
            >
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight leading-none">{shift.propertyName}</h3>
                    <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest">{shift.startTime} • {shift.serviceType}</p>
                 </div>
                 {shift.status === 'active' ? (
                   <span className="bg-teal-600 text-white px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse shadow-sm">LIVE</span>
                 ) : (
                   <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6"/></svg></div>
                 )}
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
         <header className="space-y-2">
            <button onClick={() => setCurrentStep('list')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">← Back to Queue</button>
            <h2 className="text-3xl font-brand font-extrabold uppercase text-slate-900 leading-tight">{activeShift.propertyName}</h2>
         </header>

         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8">
            <div className="space-y-4">
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Asset Destination</p>
                  <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed">{activeProperty?.address}</p>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeProperty?.address || '')}`} target="_blank" className="flex-1 bg-slate-900 text-white text-center py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl">Google Maps</a>
                  <a href={`https://maps.apple.com/?q=${encodeURIComponent(activeProperty?.address || '')}`} target="_blank" className="flex-1 bg-white border border-slate-200 text-slate-900 text-center py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest">Apple Maps</a>
               </div>
            </div>

            <div className="bg-teal-50/80 p-8 rounded-[2rem] border border-teal-100 space-y-4">
               <h4 className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Entry Instructions</h4>
               <p className="text-xs font-medium text-slate-600 leading-relaxed italic border-l-2 border-teal-200 pl-4">"{activeProperty?.accessNotes || 'No special notes.'}"</p>
            </div>

            <button onClick={handleStartShift} className="w-full bg-[#0D9488] text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">CLOCK IN & COMMENCE</button>
         </div>
      </div>
    );
  }

  if (currentStep === 'active' && activeShift) {
    return (
      <div className="animate-in fade-in duration-500 pb-32 text-left max-w-2xl mx-auto px-1">
         <div className="bg-slate-900 p-8 rounded-b-[3.5rem] text-white space-y-6 mb-8 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
               <div>
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight leading-none">{activeShift.propertyName}</h2>
                  <div className="flex items-center gap-2 mt-2.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
                     <p className="text-[8px] font-black text-teal-400 uppercase tracking-[0.3em]">LIVE MISSION • {Math.floor(timer/3600)}h {Math.floor((timer%3600)/60)}m</p>
                  </div>
               </div>
               <button onClick={() => setShowMessReport(true)} className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl">Extra Hours</button>
            </div>
         </div>

         <div className="px-3 space-y-12">
            <div className="grid grid-cols-3 gap-3">
               {[
                 { id: 'maintenance', icon: '🛠️', label: 'Mainten.' },
                 { id: 'damage', icon: '💥', label: 'Damage' },
                 { id: 'missing', icon: '🔍', label: 'Missing' }
               ].map(item => (
                 <button 
                   key={item.id}
                   onClick={() => setReportModalType(item.id as any)} 
                   className="flex flex-col items-center justify-center gap-2.5 bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm active:bg-slate-50 transition-all"
                 >
                   <span className="text-2xl">{item.icon}</span>
                   <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                 </button>
               ))}
            </div>

            <div className="space-y-6">
               <div className="flex items-center gap-4 px-2">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] whitespace-nowrap">Protocol Evidence</p>
                 <div className="h-px w-full bg-slate-100"></div>
               </div>
               
               <div className="space-y-6">
                  {tasks.map(task => (
                    <div key={task.id} className={`p-6 md:p-8 rounded-[2.5rem] border transition-all shadow-sm flex flex-col items-center text-center ${task.photos.length > 0 ? 'bg-teal-50/50 border-teal-500' : 'bg-white border-slate-100'}`}>
                       <p className="text-xs font-bold text-slate-700 uppercase leading-snug tracking-tight mb-6 max-w-xs">{task.label}</p>
                       
                       <div className="flex flex-wrap justify-center gap-3">
                          {task.photos.map((p, i) => (
                            <img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md cursor-zoom-in" />
                          ))}
                          
                          <button 
                            onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }}
                            disabled={isProcessingPhoto}
                            className={`w-16 h-16 rounded-[1.5rem] flex flex-col items-center justify-center transition-all active:scale-90 ${task.photos.length > 0 ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-50 border-2 border-dashed border-slate-200 text-slate-300'}`}
                          >
                            {isProcessingPhoto && activeTaskId === task.id ? (
                               <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            )}
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <button onClick={() => setCurrentStep('review')} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">PROCEED TO DEBRIEF</button>
         </div>

         <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />
      </div>
    );
  }

  return null;
};

export default CleanerPortal;
