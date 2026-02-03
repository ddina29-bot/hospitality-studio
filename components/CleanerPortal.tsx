
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
  onAddSupplyRequest?: (batch: Record<string, number>) => void;
  onUpdateUser?: (u: User) => void;
}

const CleanerPortal: React.FC<CleanerPortalProps> = ({ 
  user, shifts, setShifts, properties, users, initialSelectedShiftId, onConsumedDeepLink, authorizedInspectorIds = [], onClosePortal,
  inventoryItems = [], onAddSupplyRequest, onUpdateUser
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(initialSelectedShiftId || null);
  const [currentStep, setCurrentStep] = useState<'list' | 'overview' | 'active' | 'review' | 'inspection'>('list');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
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
  
  // Supply Request Modal State
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [supplyBatch, setSupplyBatch] = useState<Record<string, number>>({});
  
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

  // 24 Hour Logic for Supplies Button
  const isRequestBlocked = useMemo(() => {
    if (!user.lastSupplyRequestDate) return false;
    const now = Date.now();
    const diff = now - user.lastSupplyRequestDate;
    return diff < 24 * 60 * 60 * 1000;
  }, [user.lastSupplyRequestDate]);

  const requestButtonLabel = useMemo(() => {
    if (isRequestBlocked && user.lastSupplyRequestDate) {
      const dateStr = new Date(user.lastSupplyRequestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
      return `Requested ${dateStr}`;
    }
    return 'Request Supplies';
  }, [isRequestBlocked, user.lastSupplyRequestDate]);

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

  // Find the cleaning shift being audited
  const lastCleanerShift = useMemo(() => {
    if (activeShift?.serviceType !== 'TO CHECK APARTMENT') return null;
    return (shifts || []).find(s => 
      s.propertyId === activeShift.propertyId && 
      s.status === 'completed' && 
      s.serviceType !== 'TO CHECK APARTMENT' &&
      s.serviceType !== 'TO FIX'
    );
  }, [shifts, activeShift]);

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
        if (!isCompletedA && b.status === 'completed') return -1;
        return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
      });
  }, [shifts, user.id, viewedDateStr]);

  const categorizedQueue = useMemo(() => {
    const cleanTasks = activeQueue.filter(s => s.serviceType !== 'TO CHECK APARTMENT');
    const inspectionTasks = activeQueue.filter(s => s.serviceType === 'TO CHECK APARTMENT');
    return { cleanTasks, inspectionTasks };
  }, [activeQueue]);

  // STAFF PERFORMANCE STATS
  const performanceStats = useMemo(() => {
    const myCompleted = shifts.filter(s => s.status === 'completed' && s.userIds.includes(user.id));
    const totalCompleted = myCompleted.length;
    const totalApproved = myCompleted.filter(s => s.approvalStatus === 'approved').length;
    
    // Monthly stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyCompleted = myCompleted.filter(s => {
        const d = s.date.includes('-') ? new Date(s.date) : new Date(`${s.date} ${currentYear}`);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyHours = monthlyCompleted.reduce((acc, s) => {
        if (s.actualStartTime && s.actualEndTime) {
            return acc + (s.actualEndTime - s.actualStartTime) / (1000 * 60 * 60);
        }
        return acc;
    }, 0);

    const score = totalCompleted === 0 ? 100 : Math.round((totalApproved / totalCompleted) * 100);

    return {
        score,
        monthlyJobs: monthlyCompleted.length,
        monthlyHours: Math.round(monthlyHours * 10) / 10
    };
  }, [shifts, user.id]);

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
      approvalComment: 'SYSTEM AUTO-STOP: Geofence Breach (User left property area).',
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
        if (activeShift?.serviceType === 'TO FIX') {
          setTasks([{ id: 'remedial-proof', label: 'Proof of Correction (Required)', isMandatory: true, minPhotos: 1, photos: [] }]);
        } else if (activeShift?.serviceType === 'TO CHECK APARTMENT') {
          setTasks([
            { id: 'audit-general', label: 'Overall Presentation & Styling Audit', isMandatory: true, minPhotos: 1, photos: [] },
            { id: 'audit-hygiene', label: 'Hygiene & Surface Sanitization Audit', isMandatory: true, minPhotos: 1, photos: [] },
            { id: 'audit-inventory', label: 'Linen & Welcome Pack Inventory Audit', isMandatory: true, minPhotos: 1, photos: [] }
          ]);
        } else {
          setTasks(generateDynamicTasks(activeProperty));
        }
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
    if (shift.status === 'active') {
        setIsLocationVerified(true);
        setCurrentStep('active');
    } else {
        setCurrentStep('overview');
    }
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

  const completedTasksCount = useMemo(() => tasks.filter(t => t.photos.length > 0).length, [tasks]);
  const totalTasksCount = useMemo(() => tasks.length, [tasks]);
  const isChecklistComplete = useMemo(() => {
    const mandatoryTasks = tasks.filter(t => t.isMandatory);
    return mandatoryTasks.every(t => t.photos.length > 0);
  }, [tasks]);

  const handleProceedToHandover = () => {
    if (!isChecklistComplete) {
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
    showNotification("Report submitted for review.", 'success');
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

  const updateSupplyQty = (itemId: string, delta: number) => {
    setSupplyBatch(prev => {
        const val = (prev[itemId] || 0) + delta;
        const next = { ...prev };
        if (val <= 0) delete next[itemId];
        else next[itemId] = val;
        return next;
    });
  };

  const submitBatchSupply = () => {
    if (Object.keys(supplyBatch).length === 0) return;
    onAddSupplyRequest?.(supplyBatch);
    setSupplyBatch({});
    setShowSupplyModal(false);
    showNotification("Supply Request Dispatched to HQ", 'success');
  };

  const getRefPhotoForTask = (taskId: string) => {
     if (!activeProperty) return null;
     if (taskId === 'kitchen-task') return activeProperty.kitchenPhoto;
     if (taskId.startsWith('room-task-')) {
        const idx = parseInt(taskId.split('-').pop() || '1') - 1;
        return activeProperty.roomPhotos?.[idx];
     }
     if (taskId.startsWith('bath-task-')) {
        const idx = parseInt(taskId.split('-').pop() || '1') - 1;
        return activeProperty.bathroomPhotos?.[idx];
     }
     if (taskId === 'living-task') return activeProperty.livingRoomPhoto;
     if (taskId === 'welcome-task') return activeProperty.welcomePackPhoto;
     return null;
  };

  const renderShiftCard = (shift: Shift) => {
    const isActive = shift.status === 'active';
    const isCompleted = shift.status === 'completed';
    const isPendingReview = isCompleted && shift.approvalStatus === 'pending';
    const isReported = isCompleted && shift.approvalStatus === 'rejected';
    return (
      <div key={shift.id} onClick={() => setSelectedIdAndStart(shift)} className={`p-6 rounded-[32px] border transition-all relative overflow-hidden group active:scale-[0.98] ${isReported ? 'bg-rose-50 border-rose-200' : isPendingReview ? 'bg-blue-50 border-blue-200 shadow-md cursor-pointer' : isActive ? 'bg-teal-50 border-teal-600 shadow-lg ring-2 ring-teal-600/20 cursor-pointer' : isCompleted ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-teal-600/40 cursor-pointer shadow-sm'}`}>
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 text-left">
            <h3 className="text-base font-bold text-black uppercase tracking-tight">{shift.propertyName}</h3>
            <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">{shift.startTime} • {shift.endTime} • {shift.serviceType}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isActive ? <span className="text-[8px] font-black bg-teal-600 text-white px-3 py-1 rounded-full animate-pulse border border-teal-600 uppercase">Live</span> : 
             isReported ? <span className="text-[8px] font-black bg-rose-600 text-white px-3 py-1 rounded-full border border-rose-700 uppercase">Reported</span> :
             isPendingReview ? <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 uppercase">Reviewing</span> : 
             isCompleted ? <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200 uppercase">Done</span> : 
             <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>}
          </div>
        </div>
      </div>
    );
  };

  if (currentStep === 'list') {
    const isSupervisor = user.role === 'supervisor' || user.role === 'admin';

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-6xl mx-auto px-2 text-left relative">
        <header className="space-y-6">
          {/* PERSONALIZED WELCOME ROW */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
            <div className="flex flex-col space-y-1">
              <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[10px]">OPERATIONS TERMINAL ACTIVE</p>
              <h1 className="text-3xl md:text-4xl font-brand text-[#1E293B] tracking-tighter uppercase leading-none font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mt-1">Review your deployment queue and performance intelligence.</p>
            </div>
            
            <button 
              onClick={() => setShowSupplyModal(true)} 
              disabled={isRequestBlocked}
              className={`w-full md:w-auto px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 ${isRequestBlocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
                <span className="text-xl">{isRequestBlocked ? '📅' : '📦'}</span>
                <span>{requestButtonLabel}</span>
            </button>
          </div>

          {/* PERFORMANCE DASHBOARD HUD */}
          <section className="bg-[#1E293B] rounded-[40px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
                <svg width="250" height="250" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
             </div>
             
             <div className="relative z-10 flex flex-col lg:flex-row justify-between items-stretch gap-10">
                <div className="flex-1 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]"></div>
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#2DD4BF]">Monthly Performance Intelligence</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Success Score</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-5xl font-bold font-brand tracking-tighter text-[#F59E0B]">{performanceStats.score}</p>
                                <span className="text-lg font-bold text-[#F59E0B]/40">%</span>
                            </div>
                            <p className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Rate of Approval</p>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Done This Month</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyJobs}</p>
                                <span className="text-lg font-bold text-white/20">Units</span>
                            </div>
                            <p className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Apartments Completed</p>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-[#CBD5E1] uppercase tracking-widest leading-none">Total Hours</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyHours}</p>
                                <span className="text-lg font-bold text-white/20">Hrs</span>
                            </div>
                            <p className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Logged Flight Time</p>
                        </div>
                    </div>
                </div>
             </div>
          </section>

          <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {weekDays.map((wd) => (
              <button key={wd.iso} onClick={() => setViewedDateISO(wd.iso)} className={`flex flex-col items-center min-w-[70px] py-4 rounded-3xl border transition-all ${viewedDateISO === wd.iso ? 'bg-teal-600 border-teal-600 text-white shadow-xl scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-600/40 hover:bg-teal-50/10'}`}>
                <span className={`text-[8px] font-black uppercase mb-1 ${viewedDateISO === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                <span className={`text-sm font-black ${viewedDateISO === wd.iso ? 'text-white' : 'text-gray-700'}`}>{wd.dateNum}</span>
              </button>
            ))}
          </div>
        </header>

        <div className={`grid grid-cols-1 gap-8 ${isSupervisor ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <span className="text-base">🧹</span>
              <h2 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em]">UNITS TO CLEAN ({categorizedQueue.cleanTasks.length})</h2>
            </div>
            {categorizedQueue.cleanTasks.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[40px] opacity-40">
                <p className="text-[11px] font-black uppercase text-slate-900 tracking-widest">No cleaning sessions scheduled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {categorizedQueue.cleanTasks.map(shift => renderShiftCard(shift))}
              </div>
            )}
          </div>

          {isSupervisor && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <span className="text-base">📋</span>
                <h2 className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em]">UNITS TO INSPECT ({categorizedQueue.inspectionTasks.length})</h2>
              </div>
              {categorizedQueue.inspectionTasks.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[40px] opacity-40">
                  <p className="text-[11px] font-black uppercase text-slate-900 tracking-widest">No audit missions today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categorizedQueue.inspectionTasks.map(shift => renderShiftCard(shift))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUPPLY REQUEST SLIDING MODAL */}
        {showSupplyModal && (
          <div className="fixed inset-0 bg-black/90 z-[2000] flex items-end sm:items-center justify-center p-4 backdrop-blur-md animate-in slide-in-from-bottom-10">
            <div className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 pb-6 border-b border-gray-50 flex justify-between items-start">
                 <div className="space-y-1 text-left">
                   <h3 className="text-3xl font-brand font-extrabold uppercase text-slate-900 tracking-tighter">Inventory Requisition</h3>
                   <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.5em]">Studio Support Hub</p>
                 </div>
                 <button onClick={() => setShowSupplyModal(false)} className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-all active:scale-90">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-white">
                 {inventoryItems.length === 0 ? (
                    <div className="py-20 text-center opacity-30 italic text-[11px] uppercase font-black tracking-widest">No inventory items synchronized by HQ.</div>
                 ) : (
                   inventoryItems.map(item => (
                     <div key={item.id} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center justify-between gap-6 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-5 flex-1">
                           <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-white shrink-0 border border-slate-200">
                              <img src={item.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           </div>
                           <div className="text-left">
                              <p className="text-base font-extrabold text-slate-900 uppercase leading-none">{item.name}</p>
                              <p className="text-[9px] text-slate-400 font-black uppercase mt-1.5 tracking-widest">{item.unit}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-5 bg-white rounded-[20px] p-2 border border-slate-100 shadow-inner">
                           <button onClick={() => updateSupplyQty(item.id, -1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black text-lg hover:text-indigo-900 hover:border-slate-300 transition-all active:scale-90">-</button>
                           <span className="text-lg font-black w-8 text-center text-slate-900">{supplyBatch[item.id] || 0}</span>
                           <button onClick={() => updateSupplyQty(item.id, 1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black text-lg hover:text-indigo-900 hover:border-slate-300 transition-all active:scale-90">+</button>
                        </div>
                     </div>
                   ))
                 )}
              </div>

              <div className="p-10 pt-6 border-t border-gray-50 flex gap-4 bg-white">
                 <button onClick={() => setShowSupplyModal(false)} className="flex-1 py-6 bg-slate-100 text-slate-400 font-black rounded-[24px] text-[11px] uppercase tracking-widest transition-all hover:bg-slate-200">Cancel</button>
                 <button 
                  onClick={submitBatchSupply} 
                  disabled={Object.keys(supplyBatch).length === 0}
                  className="flex-[2] py-6 bg-indigo-600 text-white font-black rounded-[24px] text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale"
                 >
                  request
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- OVERVIEW, ACTIVE, REVIEW VIEWS ---
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
                    <p className="text-11px text-black italic leading-relaxed">{activeProperty?.accessNotes || 'Standard entry protocol applies.'}</p>
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

  if (currentStep === 'active' && activeShift) {
    const isAudit = activeShift.serviceType === 'TO CHECK APARTMENT';
    return (
      <div className="pb-40 animate-in fade-in duration-500 max-w-3xl mx-auto text-left">
         <div className="bg-[#0D9488] p-10 mb-8 rounded-b-[60px] text-white shadow-2xl space-y-4">
            <div className="space-y-1">
               <h2 className="text-3xl font-bold uppercase tracking-tight leading-none">{activeShift.propertyName}</h2>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em]">{isAudit ? 'Audit Session' : 'Live Mission'} • {Math.floor(timer / 3600)}h {Math.floor((timer % 3600) / 60)}m</p>
               </div>
            </div>
         </div>

         <div className="px-4 space-y-12">
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowMessReport(true)} className="h-24 bg-rose-50 border-2 border-rose-200 text-rose-700 flex flex-col items-center justify-center gap-2 rounded-[28px] transition-all active:scale-95 hover:bg-rose-100 shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Extra Hours</span>
               </button>
               <button onClick={() => setReportModalType('maintenance')} className="h-24 bg-slate-50 border-2 border-slate-300 text-slate-700 flex flex-col items-center justify-center gap-2 rounded-[28px] transition-all active:scale-95 hover:bg-slate-100 shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Maintenance</span>
               </button>
               <button onClick={() => setReportModalType('damage')} className="h-24 bg-amber-50 border-2 border-amber-200 text-amber-700 flex flex-col items-center justify-center gap-2 rounded-[28px] transition-all active:scale-95 hover:bg-amber-100 shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Damages</span>
               </button>
               <button onClick={() => setReportModalType('missing')} className="h-24 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 flex flex-col items-center justify-center gap-2 rounded-[28px] transition-all active:scale-95 hover:bg-indigo-100 shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Missing</span>
               </button>
            </div>

            <div className="space-y-4 text-left">
               <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] px-2">{isAudit ? 'Audit Protocol' : 'Deployment Protocol'}</p>
               {tasks.map(task => {
                  const hasPhoto = task.photos.length > 0;
                  const refPhoto = getRefPhotoForTask(task.id);
                  
                  // For Supervisor: Get cleaner's evidence photo for this specific area/task
                  const cleanerEvidence = lastCleanerShift?.tasks?.find(t => {
                    if (task.id === 'audit-general') return t.id === 'living-task';
                    if (task.id === 'audit-hygiene') return t.id === 'bath-task-1';
                    if (task.id === 'audit-inventory') return t.id === 'welcome-task';
                    return false;
                  })?.photos[0]?.url;

                  return (
                     <div key={task.id} className={`border rounded-[32px] p-6 transition-all shadow-sm ${hasPhoto ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-4 text-left">
                           <div className="space-y-1 flex-1">
                              <p className={`text-sm font-bold uppercase leading-tight ${hasPhoto ? 'text-teal-900' : 'text-slate-700'}`}>{task.label}</p>
                              {task.isMandatory && !hasPhoto && attemptedNext && <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Evidence Required</span>}
                              {!hasPhoto && <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Evidence Pending</p>}
                              {hasPhoto && <p className="text-[8px] font-black text-teal-600 uppercase tracking-[0.3em]">Requirement Satisfied</p>}
                           </div>
                           <div className={`shrink-0 ${hasPhoto ? 'text-teal-600' : 'text-slate-300'}`}>
                             {hasPhoto ? (
                               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                             ) : (
                               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/></svg>
                             )}
                           </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                           {refPhoto && (
                             <div className="flex flex-col gap-1 items-center shrink-0">
                               <p className="text-[6px] font-black uppercase text-teal-600">Standard</p>
                               <img src={refPhoto} onClick={() => setZoomedImage(refPhoto)} className="w-20 h-20 rounded-2xl object-cover border-2 border-[#0D9488]/20 shadow-md cursor-zoom-in" alt="Standard" />
                             </div>
                           )}
                           {isAudit && cleanerEvidence && (
                              <div className="flex flex-col gap-1 items-center shrink-0">
                                <p className="text-[6px] font-black uppercase text-indigo-600">Cleaner Shot</p>
                                <img src={cleanerEvidence} onClick={() => setZoomedImage(cleanerEvidence)} className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-200 shadow-md cursor-zoom-in" alt="Cleaner Proof" />
                              </div>
                           )}
                           {(refPhoto || cleanerEvidence) && <div className="w-px h-20 bg-slate-100 shrink-0 self-end"></div>}
                           {task.photos.map((p, i) => (
                             <div key={i} className="flex flex-col gap-1 items-center shrink-0">
                               <p className="text-[6px] font-black uppercase text-slate-400">Captured</p>
                               <img src={p.url} onClick={() => setZoomedImage(p.url)} className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shadow-sm cursor-zoom-in" alt="Evidence" />
                             </div>
                           ))}
                           <button onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }} className={`w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all shrink-0 self-end ${hasPhoto ? 'bg-white border-teal-200 text-teal-400' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                           </button>
                        </div>
                     </div>
                  );
               })}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.5em] px-2 text-left">Final Logistics</p>
              <div className="bg-slate-900 rounded-[32px] p-8 text-slate-100 space-y-6 shadow-2xl text-left">
                <div className="grid grid-cols-1 gap-5">
                  {[
                    "All AC units turned OFF",
                    "Main switches for water heater ON",
                    "All lights and electricals OFF",
                    "Windows and balcony doors locked"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-teal-400 font-bold border border-teal-400/20 shrink-0">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest leading-none">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pb-10 pt-4">
               <button 
                onClick={handleProceedToHandover} 
                className={`w-full font-black py-6 rounded-[32px] text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${isChecklistComplete ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400 shadow-none'}`}
               >
                 {!isChecklistComplete && <span className="text-xl">🔒</span>}
                 {isChecklistComplete ? 'PROCEED TO CLOCK-OUT' : `INCOMPLETE (${completedTasksCount}/${totalTasksCount})`}
                 {isChecklistComplete && <span className="text-xl">➔</span>}
               </button>
            </div>
         </div>
         
         <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />

         {(reportModalType || showMessReport) && (
            <div className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in slide-in-from-bottom-10">
               <div className="bg-white w-full max-w-md rounded-[50px] space-y-8 shadow-2xl relative text-center overflow-hidden">
                  <div className={`h-4 w-full ${showMessReport ? 'bg-rose-500' : 'bg-teal-600'}`}></div>
                  <div className="p-10 pb-4 space-y-2">
                     <h3 className="text-3xl font-brand font-extrabold uppercase tracking-tighter text-slate-900">{showMessReport ? 'Extra Hours Report' : reportModalType?.toUpperCase()}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Field Intelligence Registry</p>
                  </div>
                  <div className="px-10 space-y-3">
                     <textarea className="w-full bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-sm font-medium outline-none focus:border-teal-600 h-40 shadow-inner" placeholder="Provide details..." value={showMessReport ? messDescription : reportDescription} onChange={e => showMessReport ? setMessDescription(e.target.value) : setReportDescription(e.target.value)} />
                  </div>
                  <div className="px-10 space-y-4 pb-10">
                     <div className="flex gap-3 justify-center">
                        {(showMessReport ? messPhotos : reportPhotos).map((url, i) => (<img key={i} src={url} className="w-20 h-20 rounded-2xl object-cover border border-slate-200" />))}
                        <button onClick={() => (showMessReport ? messCameraRef : reportCameraRef).current?.click()} className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:text-teal-500 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
                     </div>
                     <div className="flex gap-3 pt-4">
                        <button onClick={() => { setShowMessReport(false); setReportModalType(null); }} className="flex-1 py-5 bg-slate-100 text-slate-400 font-black rounded-[32px] text-[10px] uppercase">Cancel</button>
                        <button onClick={showMessReport ? handleSubmitMessReport : handleIncidentSubmit} className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-[32px] text-[10px] uppercase tracking-widest shadow-xl">Submit Report</button>
                     </div>
                  </div>
                  <input type="file" ref={showMessReport ? messCameraRef : reportCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, showMessReport ? 'mess' : 'report')} />
               </div>
            </div>
         )}
      </div>
    );
  }

  if (currentStep === 'review') {
    return (
      <div className="pb-40 px-4 pt-10 max-w-2xl mx-auto text-left space-y-12 animate-in fade-in duration-500">
         <div className="space-y-2">
            <h2 className="text-3xl font-brand font-extrabold text-slate-900 uppercase tracking-tighter">Security Debrief</h2>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.5em]">Final Checkout Protocol</p>
         </div>

         <div className="bg-white border border-slate-100 p-10 rounded-[50px] space-y-10 shadow-2xl">
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-2">Keybox Verification</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-teal-600">{activeProperty?.keyboxCode || '---'}</p>
            </div>

            <div className="space-y-6">
               <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.5em]">Phase 1: Key Deployment Evidence</p>
               <div className="flex gap-4 overflow-x-auto pb-2">
                  {keyInBoxPhotos.map((p, i) => <img key={i} src={p.url} className="w-24 h-24 rounded-3xl object-cover border border-slate-100 shadow-md" />)}
                  <button onClick={() => { setCheckoutTarget('keyInBox'); checkoutKeyRef.current?.click(); }} className="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-teal-200 flex items-center justify-center text-slate-300 hover:bg-slate-100 transition-all"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
               </div>
            </div>

            <div className="space-y-6">
               <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.5em]">Phase 2: Secure Enclosure Confirmed</p>
               <div className="flex gap-4 overflow-x-auto pb-2">
                  {boxClosedPhotos.map((p, i) => <img key={i} src={p.url} className="w-24 h-24 rounded-3xl object-cover border border-slate-100 shadow-md" />)}
                  <button onClick={() => { setCheckoutTarget('boxClosed'); checkoutKeyRef.current?.click(); }} className="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-teal-200 flex items-center justify-center text-slate-300 hover:bg-slate-100 transition-all"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
               </div>
            </div>
            <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
         </div>

         <div className="flex flex-col sm:flex-row gap-4 pt-10">
            <button onClick={() => setCurrentStep('active')} className="flex-1 py-7 bg-white text-slate-400 font-black rounded-[32px] text-xs uppercase tracking-widest border border-slate-100 shadow-sm active:scale-95 transition-all">Go Back</button>
            <button onClick={handleFinishShift} disabled={isFinishing} className={`flex-[2] py-7 font-black rounded-[32px] uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${isFinishing ? 'bg-slate-300 text-white' : 'bg-teal-600 text-white shadow-lg'}`}>
                {isFinishing ? 'Processing...' : 'Secure & Clock out'}
                {!isFinishing && <span className="text-xl">✓</span>}
            </button>
         </div>
      </div>
    );
  }

  return <div className="p-40 text-center opacity-20 font-black uppercase tracking-[0.5em] animate-pulse text-slate-900">Synchronizing operational core...</div>;
};

export default CleanerPortal;
