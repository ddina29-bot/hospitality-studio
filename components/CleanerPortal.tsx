
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
  authorizedInspectorIds?: string[];
  onClosePortal?: () => void;
  inventoryItems?: SupplyItem[];
  onAddSupplyRequest?: (item: Record<string, number>) => void;
}

const CleanerPortal: React.FC<CleanerPortalProps> = ({ 
  user, shifts, setShifts, properties, users, initialSelectedShiftId, onConsumedDeepLink, authorizedInspectorIds = [], onClosePortal,
  inventoryItems = [], onAddSupplyRequest
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(initialSelectedShiftId || null);
  const [currentStep, setCurrentStep] = useState<'list' | 'overview' | 'active' | 'review' | 'inspection'>('list');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [completedSpecialRequests, setCompletedSpecialRequests] = useState<Record<string, boolean>>({});
  const [timer, setTimer] = useState(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const [isLocationVerified, setIsLocationVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);
  
  const [keyInBoxPhotos, setKeyInBoxPhotos] = useState<AttributedPhoto[]>([]);
  const [boxClosedPhotos, setBoxClosedPhotos] = useState<AttributedPhoto[]>([]);

  const [showMessReport, setShowMessReport] = useState(false);
  const [messDescription, setMessDescription] = useState('');
  const [messPhotos, setMessPhotos] = useState<string[]>([]);

  const [reportModalType, setReportModalType] = useState<'maintenance' | 'damage' | 'missing' | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [missingCategory, setMissingCategory] = useState<'laundry' | 'apartment'>('apartment');
  
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messCameraRef = useRef<HTMLInputElement>(null);
  const reportCameraRef = useRef<HTMLInputElement>(null);
  const checkoutKeyRef = useRef<HTMLInputElement>(null);
  
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<'keyInBox' | 'boxClosed' | null>(null);
  const hasTriggeredBreach = useRef(false);

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

  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - 3); 
    for (let i = 0; i < 11; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = getLocalISO(d);
      days.push({
        iso,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateNum: d.getDate(),
        isToday: iso === realTodayISO
      });
    }
    return days;
  }, [realTodayISO]);

  const activeShift = useMemo(() => (shifts || []).find(s => s && s.id === selectedShiftId), [shifts, selectedShiftId]);
  const activeProperty = useMemo(() => activeShift ? properties.find(p => p.id === activeShift.propertyId) : null, [activeShift, properties]);

  const currentlyActiveShift = useMemo(() => {
    return (shifts || []).find(s => s.status === 'active' && s.userIds.includes(user.id));
  }, [shifts, user.id]);

  const activeQueue = useMemo(() => {
    return (shifts || [])
      .filter(s => s.isPublished && s.userIds.includes(user.id) && s.date === viewedDateStr)
      .sort((a, b) => {
        const isCompletedA = a.status === 'completed';
        const isCompletedB = b.status === 'completed';
        if (isCompletedA && !isCompletedB) return 1;
        if (!isCompletedA && isCompletedB) return -1;
        return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
      });
  }, [shifts, user.id, viewedDateStr]);

  const categorizedQueue = useMemo(() => {
    const cleanTasks = activeQueue.filter(s => s.serviceType !== 'TO CHECK APARTMENT');
    const inspectionTasks = activeQueue.filter(s => s.serviceType === 'TO CHECK APARTMENT');
    return { cleanTasks, inspectionTasks };
  }, [activeQueue]);

  const generateDynamicTasks = (property: Property): CleaningTask[] => {
    const dynamicTasks: CleaningTask[] = [];
    dynamicTasks.push({ id: 'kitchen-task', label: 'KITCHEN: Surfaces & Appliances sanitized', isMandatory: true, minPhotos: 1, photos: [] });
    const roomCount = property.rooms || 0;
    for (let i = 1; i <= roomCount; i++) {
      dynamicTasks.push({ id: `room-task-${i}`, label: `BEDROOM ${i}: Bed linens changed & styled`, isMandatory: true, minPhotos: 1, photos: [] });
    }
    const bathCount = property.bathrooms || 0;
    for (let i = 1; i <= bathCount; i++) {
      dynamicTasks.push({ id: `bath-task-${i}`, label: `BATHROOM ${i}: Toilet & Shower deep cleaned`, isMandatory: true, minPhotos: 1, photos: [] });
    }
    dynamicTasks.push({ id: 'living-task', label: 'LIVING/DINING AREA: Dusting & Mirror check', isMandatory: true, minPhotos: 1, photos: [] });
    dynamicTasks.push({ id: 'balcony-task', label: 'BALCONY/TERRACE: Cleaned', isMandatory: false, minPhotos: 0, photos: [] });
    dynamicTasks.push({ id: 'welcome-task', label: 'WELCOME PACK: Replenished', isMandatory: false, minPhotos: 0, photos: [] });
    dynamicTasks.push({ id: 'soaps-task', label: 'SOAP BOTTLES: Checked', isMandatory: false, minPhotos: 0, photos: [] });
    return dynamicTasks;
  };

  const handleForceClockOut = useCallback(() => {
    if (!selectedShiftId) return;
    if (hasTriggeredBreach.current) return; 
    hasTriggeredBreach.current = true;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
      ...s, 
      status: 'completed', 
      actualEndTime: Date.now(), 
      approvalStatus: 'pending', 
      wasRejected: false,
      approvalComment: 'SYSTEM AUTO-STOP: Geofence Breach (User left property).',
      tasks: tasks 
    } as Shift) : s));
    localStorage.removeItem(`shared_protocol_v10_${selectedShiftId}`);
    setSelectedShiftId(null);
    setCurrentStep('list');
    alert("⚠️ LOCATION ALERT: You have left the property area (150m+). Shift auto-stopped.");
  }, [selectedShiftId, setShifts, tasks]);

  useEffect(() => {
    let watchId: number | null = null;
    if (currentStep === 'active') hasTriggeredBreach.current = false;
    if (currentStep === 'active' && activeProperty?.lat && activeProperty?.lng) {
      const targetLat = activeProperty.lat;
      const targetLng = activeProperty.lng;
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const distanceKm = calculateDistance(targetLat, targetLng, position.coords.latitude, position.coords.longitude);
          if (distanceKm > 0.15) handleForceClockOut();
        },
        (error) => console.warn("Geolocation watch error:", error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [currentStep, activeProperty, handleForceClockOut]);

  useEffect(() => {
    if (selectedShiftId && currentStep === 'active' && activeProperty) {
      const storageKey = `shared_protocol_v10_${selectedShiftId}`;
      const savedTasks = localStorage.getItem(storageKey);
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      else {
        if (activeShift?.serviceType === 'TO FIX') setTasks([{ id: 'remedial-proof', label: 'Proof of Correction (Required)', isMandatory: true, minPhotos: 1, photos: [] }]);
        else setTasks(generateDynamicTasks(activeProperty));
      }
    }
  }, [selectedShiftId, currentStep, activeProperty, activeShift?.serviceType]);

  useEffect(() => {
    if (selectedShiftId && tasks.length > 0) {
      localStorage.setItem(`shared_protocol_v10_${selectedShiftId}`, JSON.stringify(tasks));
    }
  }, [tasks, selectedShiftId]);

  useEffect(() => {
    let interval: any;
    if ((currentStep === 'active' || currentStep === 'review' || currentStep === 'inspection') && activeShift?.actualStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeShift.actualStartTime!) / 1000);
        setTimer(elapsed > 0 ? elapsed : 0);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, activeShift]);

  const verifyLocation = () => {
    if (!activeProperty || !activeProperty.lat || !activeProperty.lng) {
        showNotification("Property coordinates missing. Manual override required.", 'success');
        setIsLocationVerified(true);
        return;
    }
    setIsVerifying(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const distance = calculateDistance(activeProperty.lat!, activeProperty.lng!, position.coords.latitude, position.coords.longitude);
            if (distance <= 0.15) {
                setIsLocationVerified(true);
                showNotification("Location Verified Successfully", 'success');
            } else {
                showNotification(`Location Error: You are ${Math.round(distance * 1000)}m away. 150m radius required.`, 'error');
            }
            setIsVerifying(false);
        },
        (error) => { showNotification("GPS Access Required.", 'error'); setIsVerifying(false); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const setSelectedIdAndStart = (shift: Shift) => {
    if (currentlyActiveShift && currentlyActiveShift.id !== shift.id) {
        showNotification(`ACTIVE SHIFT ALERT: Finish ${currentlyActiveShift.propertyName} first.`, 'error');
        return;
    }
    setSelectedShiftId(shift.id);
    setIsLocationVerified(false);
    setAttemptedNext(false);
    if (shift.status === 'active') setCurrentStep('active');
    else setCurrentStep('overview');
  };

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
    } catch (error) { showNotification("Upload failed.", 'error'); } finally { setIsProcessingPhoto(false); }
  };

  const handleStartShift = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'active', actualStartTime: Date.now() } as Shift) : s));
    setCurrentStep('active');
  };

  const missingTasks = useMemo(() => tasks.filter(t => t.isMandatory && t.photos.length < t.minPhotos), [tasks]);

  const handleProceedToHandover = () => {
    if (missingTasks.length > 0) {
      setAttemptedNext(true);
      showNotification(`INCOMPLETE CHECKLIST: Evidence Missing.`, 'error');
      return;
    }
    setCurrentStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    localStorage.removeItem(`shared_protocol_v10_${selectedShiftId}`);
    setTimeout(() => {
        setIsFinishing(false);
        if (onClosePortal) onClosePortal();
        else { setCurrentStep('list'); setSelectedShiftId(null); }
    }, 500);
  };

  const handleSubmitMessReport = () => {
    if (!selectedShiftId) return;
    if (!messDescription.trim() || messPhotos.length === 0) {
        showNotification("Description and Photo required.", 'error');
        return;
    }
    setShifts(prev => prev.map(s => {
      if (s.id === selectedShiftId) {
        return { ...s, messReport: { description: messDescription, photos: messPhotos, status: 'pending' } };
      }
      return s;
    }));
    setShowMessReport(false);
    setMessDescription('');
    setMessPhotos([]);
    showNotification("Request submitted for review.", 'success');
  };

  const handleIncidentSubmit = () => {
    if (!selectedShiftId || !reportModalType) return;
    if (!reportDescription.trim()) { showNotification("Description required.", 'error'); return; }
    if ((reportModalType === 'maintenance' || reportModalType === 'damage') && reportPhotos.length === 0) {
        showNotification("Camera photo required.", 'error');
        return;
    }
    const report: SpecialReport = { id: `rep-${Date.now()}`, description: reportDescription, photos: reportPhotos, timestamp: Date.now(), status: 'open', category: reportModalType === 'missing' ? missingCategory : undefined };
    setShifts(prev => prev.map(s => {
        if (s.id === selectedShiftId) {
            if (reportModalType === 'maintenance') return { ...s, maintenanceReports: [...(s.maintenanceReports || []), report] };
            if (reportModalType === 'damage') return { ...s, damageReports: [...(s.damageReports || []), report] };
            if (reportModalType === 'missing') return { ...s, missingReports: [...(s.missingReports || []), report] };
        }
        return s;
    }));
    setReportModalType(null);
    setReportDescription('');
    setReportPhotos([]);
    showNotification("Incident successfully logged.", 'success');
  };

  const renderShiftCard = (shift: Shift) => {
    const isActive = shift.status === 'active';
    const isCompleted = shift.status === 'completed';
    const isPendingReview = isCompleted && shift.approvalStatus === 'pending';
    return (
      <div key={shift.id} onClick={() => setSelectedIdAndStart(shift)} className={`p-6 rounded-[32px] border transition-all relative overflow-hidden group active:scale-[0.98] ${isPendingReview ? 'bg-blue-50 border-blue-200 shadow-md cursor-pointer' : isActive ? 'bg-teal-50 border-teal-600 shadow-lg ring-2 ring-teal-600/20 cursor-pointer' : isCompleted ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-teal-600/40 cursor-pointer shadow-sm'}`}>
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 text-left">
            <h3 className="text-base font-bold text-black uppercase tracking-tight">{shift.propertyName}</h3>
            <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">{shift.startTime} — {shift.endTime} • {shift.serviceType}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isActive ? <span className="text-[8px] font-black bg-teal-600 text-white px-3 py-1 rounded-full animate-pulse border border-teal-600 uppercase">Live</span> : isPendingReview ? <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 uppercase">Reviewing</span> : isCompleted ? <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200 uppercase">Done</span> : <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg></div>}
          </div>
        </div>
      </div>
    );
  };

  if (currentStep === 'list') {
    const isSupervisor = user.role === 'supervisor' || user.role === 'admin';

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-6xl mx-auto px-2 text-left relative">
        <header className="space-y-6 max-w-2xl mx-auto md:max-w-none">
          <div className="flex flex-col space-y-1">
            <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px]">Deployment Schedule</p>
            <h1 className="text-2xl font-brand text-black tracking-tight uppercase leading-none font-bold">Field Ops</h1>
          </div>
          <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {weekDays.map((wd) => (
              <button key={wd.iso} onClick={() => setViewedDateISO(wd.iso)} className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${viewedDateISO === wd.iso ? 'bg-teal-600 border-teal-600 text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-400 hover:border-teal-600/40'}`}>
                <span className={`text-[8px] font-black uppercase mb-1 ${viewedDateISO === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                <span className={`text-sm font-bold ${viewedDateISO === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Dynamic Layout: Columns for Supervisor, Single List for Cleaner */}
        <div className={`grid grid-cols-1 gap-8 ${isSupervisor ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
          {/* Units to Clean Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <span className="text-sm">🧹</span>
              <h2 className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em]">UNITS TO CLEAN ({categorizedQueue.cleanTasks.length})</h2>
            </div>
            {categorizedQueue.cleanTasks.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-gray-200 rounded-[32px] opacity-40">
                <p className="text-[10px] font-black uppercase text-black tracking-widest">No cleaning tasks today.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {categorizedQueue.cleanTasks.map(shift => renderShiftCard(shift))}
              </div>
            )}
          </div>

          {/* Units to Inspect Section (Only if Supervisor/Admin) */}
          {isSupervisor && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <span className="text-sm">📋</span>
                <h2 className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em]">UNITS TO INSPECT ({categorizedQueue.inspectionTasks.length})</h2>
              </div>
              {categorizedQueue.inspectionTasks.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-gray-200 rounded-[32px] opacity-40">
                  <p className="text-[10px] font-black uppercase text-black tracking-widest">No inspections scheduled.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categorizedQueue.inspectionTasks.map(shift => renderShiftCard(shift))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Step: Overview ---
  if (currentStep === 'overview' && activeShift) {
    return (
      <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 pb-32 max-w-2xl mx-auto px-4 text-left">
        <button onClick={() => { setSelectedShiftId(null); setCurrentStep('list'); }} className="text-black/40 hover:text-black flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> BACK</button>
        <div className="space-y-2">
          <h1 className="text-3xl font-brand font-bold text-black uppercase tracking-tight leading-tight">{activeShift.propertyName}</h1>
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.3em]">MISSION BRIEFING</p>
        </div>
        <div className="bg-white border border-teal-100 p-8 rounded-[40px] space-y-8 shadow-xl">
           {activeProperty?.entrancePhoto && (
             <div className="space-y-3">
                <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Building Reference</p>
                <img src={activeProperty.entrancePhoto} className="w-full h-56 object-cover rounded-3xl border border-teal-50 shadow-md" alt="Entrance" />
             </div>
           )}

           <div className="space-y-4">
              <div>
                 <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mb-1">Target Address</p>
                 <p className="text-sm font-bold text-black uppercase leading-relaxed">{activeProperty?.address}</p>
              </div>
              <div className="flex gap-2">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeProperty?.address || '')}`} target="_blank" className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-3 rounded-xl text-[9px] font-black uppercase text-center shadow-sm">Google Maps</a>
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(activeProperty?.address || '')}`} target="_blank" className="flex-1 bg-slate-50 text-slate-600 border border-slate-200 py-3 rounded-xl text-[9px] font-black uppercase text-center shadow-sm">Apple Maps</a>
              </div>
           </div>

           <div className="bg-teal-50 p-6 rounded-[32px] border border-teal-100 space-y-6">
              <div className="flex justify-between items-center border-b border-teal-200/40 pb-4">
                 <p className="text-[8px] font-black text-teal-700 uppercase tracking-widest">Digital Keys & Access</p>
                 {!isLocationVerified && <span className="text-[7px] font-black bg-red-100 text-red-600 px-3 py-1 rounded-full uppercase animate-pulse">Redacted</span>}
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[7px] font-black uppercase text-teal-800/40 mb-1">Level / Unit</p>
                       <p className="text-lg font-bold text-black">{isLocationVerified ? `${activeProperty?.floorNumber || '0'} / ${activeProperty?.apartmentNumber || '---'}` : '• • •'}</p>
                    </div>
                    <div>
                       <p className="text-[7px] font-black uppercase text-teal-800/40 mb-1">Entrance</p>
                       <p className="text-lg font-mono font-bold text-black tracking-widest">{isLocationVerified ? activeProperty?.mainEntranceCode : '****'}</p>
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-2xl border border-teal-100 text-center">
                    <p className="text-[7px] font-black uppercase text-teal-800/40 mb-1">Keybox Secure Code</p>
                    <p className="text-3xl font-mono font-bold text-teal-700 tracking-[0.2em]">{isLocationVerified ? activeProperty?.keyboxCode : '****'}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[7px] font-black uppercase text-teal-800/40">Logistics Detail</p>
                    <p className="text-[11px] text-black italic leading-relaxed">{activeProperty?.accessNotes || 'Standard entry protocol applies.'}</p>
                 </div>
              </div>
           </div>

           <div className="pt-4 space-y-4">
              {!isLocationVerified ? (
                <button onClick={verifyLocation} disabled={isVerifying} className="w-full py-5 rounded-3xl bg-black text-[#C5A059] font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                  {isVerifying ? 'Locating...' : 'Verify GPS to Unlock'}
                </button>
              ) : (
                <button onClick={handleStartShift} className="w-full py-5 rounded-3xl bg-teal-600 text-white font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all hover:bg-teal-700">
                  Initialize deployment
                </button>
              )}
           </div>
        </div>
      </div>
    );
  }

  // --- Step: Active Mission ---
  if (currentStep === 'active' && activeShift) {
    const labelStyle = "text-[7px] font-black text-teal-700 uppercase tracking-[0.4em] opacity-80 mb-2 block px-1 text-left";
    return (
      <div className="pb-40 animate-in fade-in duration-500 max-w-3xl mx-auto text-left">
         <div className="bg-[#0D9488] p-10 mb-8 rounded-b-[60px] text-white shadow-2xl space-y-4">
            <div className="space-y-1">
               <h2 className="text-3xl font-bold uppercase tracking-tight leading-none">{activeShift.propertyName}</h2>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em]">Live Mission • {Math.floor(timer / 3600)}h {Math.floor((timer % 3600) / 60)}m</p>
               </div>
            </div>
         </div>

         <div className="px-4 space-y-12">
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowMessReport(true)} className="bg-red-50 text-red-600 border border-red-100 p-5 rounded-[32px] flex flex-col items-center gap-3 transition-all hover:bg-red-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Report Mess</span>
               </button>
               <button onClick={() => setReportModalType('maintenance')} className="bg-blue-50 text-blue-600 border border-blue-100 p-5 rounded-[32px] flex flex-col items-center gap-3 transition-all hover:bg-blue-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Fix required</span>
               </button>
               <button onClick={() => setReportModalType('damage')} className="bg-orange-50 text-orange-600 border border-orange-100 p-5 rounded-[32px] flex flex-col items-center gap-3 transition-all hover:bg-orange-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Damages</span>
               </button>
               <button onClick={() => setReportModalType('missing')} className="bg-purple-50 text-purple-600 border border-purple-100 p-5 rounded-[32px] flex flex-col items-center gap-3 transition-all hover:bg-purple-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Missing item</span>
               </button>
            </div>

            <div className="space-y-6">
               <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em] px-2 text-left">Main Checklist</p>
               {tasks.map(task => {
                  const hasPhoto = task.photos.length > 0;
                  return (
                     <div key={task.id} className={`bg-white border rounded-[32px] p-6 transition-all shadow-sm ${hasPhoto ? 'border-green-200 bg-green-50/10' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-4 text-left">
                           <div className="space-y-1 flex-1">
                              <p className="text-sm font-bold text-black uppercase leading-tight">{task.label}</p>
                              {task.isMandatory && !hasPhoto && attemptedNext && <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Evidence required</span>}
                           </div>
                           {hasPhoto && <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                           {task.photos.map((p, i) => (<img key={i} src={p.url} className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shadow-sm" alt="Evidence" />))}
                           <button onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }} className="w-20 h-20 rounded-2xl bg-teal-50 border-2 border-dashed border-teal-200 flex flex-col items-center justify-center text-teal-400 hover:border-teal-600 hover:text-teal-600 transition-all shrink-0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
                        </div>
                     </div>
                  );
               })}
            </div>

            <div className="pb-10 pt-4">
               <button onClick={handleProceedToHandover} className="w-full bg-[#0D9488] text-white font-black py-6 rounded-[32px] text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">Next: Security Handover</button>
            </div>
         </div>
         
         <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />

         {(reportModalType || showMessReport) && (
            <div className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in slide-in-from-bottom-10">
               <div className="bg-white w-full max-w-md rounded-[50px] p-10 space-y-8 shadow-2xl relative text-left">
                  <div className="text-center space-y-1">
                     <h3 className="text-2xl font-brand font-bold text-black uppercase tracking-tight">{showMessReport ? 'Extra hours request' : `Report ${reportModalType}`}</h3>
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Field Intelligence Registry</p>
                  </div>
                  
                  <div className="space-y-2">
                     <label className={labelStyle}>Detailed Description</label>
                     <textarea className="w-full bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-sm font-medium outline-none focus:border-teal-600 h-40 shadow-inner" placeholder="Provide full context..." value={showMessReport ? messDescription : reportDescription} onChange={e => showMessReport ? setMessDescription(e.target.value) : setReportDescription(e.target.value)} />
                  </div>
                  
                  <div className="space-y-4">
                     <p className={labelStyle}>Visual Proof (Camera mandatory)</p>
                     <div className="flex gap-3 overflow-x-auto pb-2">
                        {(showMessReport ? messPhotos : reportPhotos).map((url, i) => (<img key={i} src={url} className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm" />))}
                        <button onClick={() => (showMessReport ? messCameraRef : reportCameraRef).current?.click()} className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:text-teal-500 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
                     </div>
                  </div>

                  <input type="file" ref={showMessReport ? messCameraRef : reportCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, showMessReport ? 'mess' : 'report')} />
                  
                  <div className="flex gap-3 pt-4">
                     <button onClick={() => { setShowMessReport(false); setReportModalType(null); }} className="flex-1 py-5 bg-slate-100 text-black/30 font-black rounded-3xl text-[10px] uppercase">Cancel</button>
                     <button onClick={showMessReport ? handleSubmitMessReport : handleIncidentSubmit} className="flex-[2] py-5 bg-black text-[#C5A059] font-black rounded-3xl text-[10px] uppercase tracking-[0.2em] shadow-xl">Submit Mission Report</button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  // --- Step: Review ---
  if (currentStep === 'review') {
    return (
      <div className="pb-40 px-4 pt-10 max-w-2xl mx-auto text-left space-y-12 animate-in fade-in duration-500">
         <div className="space-y-2">
            <h2 className="text-3xl font-brand font-bold text-black uppercase tracking-tight">Debriefing</h2>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em]">Final Secure Protocol</p>
         </div>

         <div className="bg-white border border-teal-100 p-10 rounded-[50px] space-y-10 shadow-2xl">
            <div className="bg-teal-50 p-6 rounded-[32px] border border-teal-100 text-center">
                <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.3em] mb-1">Confirmation: Secure Code</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-black">{activeProperty?.keyboxCode || '---'}</p>
            </div>

            <div className="space-y-6">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Step 1: Key inside open lockbox</p>
               <div className="flex gap-4 overflow-x-auto pb-2">
                  {keyInBoxPhotos.map((p, i) => <img key={i} src={p.url} className="w-24 h-24 rounded-3xl object-cover border border-teal-100 shadow-md" />)}
                  <button onClick={() => { setCheckoutTarget('keyInBox'); checkoutKeyRef.current?.click(); }} className="w-24 h-24 rounded-3xl bg-teal-50 border-2 border-dashed border-teal-200 flex items-center justify-center text-teal-300 hover:bg-teal-100 hover:text-teal-500 transition-all shadow-sm"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
               </div>
            </div>

            <div className="space-y-6">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Step 2: Lockbox Closed & Scrambled</p>
               <div className="flex gap-4 overflow-x-auto pb-2">
                  {boxClosedPhotos.map((p, i) => <img key={i} src={p.url} className="w-24 h-24 rounded-3xl object-cover border border-teal-100 shadow-md" />)}
                  <button onClick={() => { setCheckoutTarget('boxClosed'); checkoutKeyRef.current?.click(); }} className="w-24 h-24 rounded-3xl bg-teal-50 border-2 border-dashed border-teal-200 flex items-center justify-center text-teal-300 hover:bg-teal-100 hover:text-teal-500 transition-all shadow-sm"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
               </div>
            </div>
            <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
         </div>

         <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setCurrentStep('active')} className="flex-1 py-6 bg-slate-50 text-black/40 font-black rounded-[32px] text-xs uppercase tracking-widest border border-slate-100">Go Back</button>
            <button onClick={handleFinishShift} disabled={isFinishing} className={`flex-[2] py-6 font-black rounded-[32px] uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${isFinishing ? 'bg-slate-300 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>
                {isFinishing ? 'Finalizing...' : 'Verify & Clock out'}
            </button>
         </div>
      </div>
    );
  }

  return <div className="p-20 text-center opacity-20 font-black uppercase tracking-widest">Loading environment...</div>;
};

export default CleanerPortal;
