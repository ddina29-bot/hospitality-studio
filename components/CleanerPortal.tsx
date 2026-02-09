
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Property, CleaningTask, Shift, User, AttributedPhoto, SpecialReport, SupplyItem } from '../types';
import { uploadFile } from '../services/storageService';

const FAKE_PHOTOS = {
  kitchen: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80",
  bedroom: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&w=600&q=80",
  bathroom: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
  living: "https://images.unsplash.com/photo-1583847268964-b28dc2f51ac9?auto=format&fit=crop&w=600&q=80",
  key: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
  general: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80"
};

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
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(() => {
    return initialSelectedShiftId || localStorage.getItem('cleaner_active_shift_id') || null;
  });
  
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
  
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messCameraRef = useRef<HTMLInputElement>(null);
  const reportCameraRef = useRef<HTMLInputElement>(null);
  const checkoutKeyRef = useRef<HTMLInputElement>(null);
  
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<'keyInBox' | 'boxClosed' | null>(null);

  // Simulation strictly restricted to testing accounts
  const simulationActive = useMemo(() => user.email === 'build@reset.studio', [user.email]);
  const realTodayISO = useMemo(() => getLocalISO(new Date()), []);
  const [viewedDateISO, setViewedDateISO] = useState(realTodayISO);

  const activeShift = useMemo(() => (shifts || []).find(s => s && s.id === selectedShiftId), [shifts, selectedShiftId]);
  const activeProperty = useMemo(() => activeShift ? properties.find(p => p.id === activeShift.propertyId) : null, [activeShift, properties]);

  useEffect(() => {
    if (selectedShiftId) {
      localStorage.setItem('cleaner_active_shift_id', selectedShiftId);
      const shift = shifts.find(s => s.id === selectedShiftId);
      if (shift) {
        if (shift.status === 'active') {
          setCurrentStep('active');
          setIsLocationVerified(true);
        } else if (shift.status === 'completed' && currentStep !== 'list') {
          if (currentStep !== 'review') {
            setCurrentStep('list');
            setSelectedShiftId(null);
            localStorage.removeItem('cleaner_active_shift_id');
          }
        }
      }
    }
  }, [selectedShiftId, shifts, currentStep]);

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

  const performanceStats = useMemo(() => {
    const myCompleted = shifts.filter(s => s.status === 'completed' && s.userIds.includes(user.id));
    const totalCompleted = myCompleted.length;
    const totalApproved = myCompleted.filter(s => s.approvalStatus === 'approved').length;
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
    return { score, monthlyJobs: monthlyCompleted.length, monthlyHours: Math.round(monthlyHours * 10) / 10 };
  }, [shifts, user.id]);

  useEffect(() => {
    if (selectedShiftId && currentStep === 'active' && activeProperty) {
      const storageKey = `shared_protocol_v10_${selectedShiftId}`;
      const savedTasks = localStorage.getItem(storageKey);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        if (activeShift?.serviceType === 'TO FIX') {
          setTasks([{ id: 'remedial-proof', label: 'Proof of Correction (Required)', isMandatory: true, minPhotos: 1, photos: simulationActive ? [{url: FAKE_PHOTOS.general, userId: 'system'}] : [] }]);
        } else if (activeShift?.serviceType === 'TO CHECK APARTMENT') {
          setTasks([
            { id: 'audit-general', label: 'Overall Presentation & Styling Audit', isMandatory: true, minPhotos: 1, photos: simulationActive ? [{url: FAKE_PHOTOS.general, userId: 'system'}] : [] },
            { id: 'audit-hygiene', label: 'Hygiene & Surface Sanitization Audit', isMandatory: true, minPhotos: 1, photos: simulationActive ? [{url: FAKE_PHOTOS.bathroom, userId: 'system'}] : [] },
            { id: 'audit-inventory', label: 'Linen & Welcome Pack Inventory Audit', isMandatory: true, minPhotos: 1, photos: simulationActive ? [{url: FAKE_PHOTOS.general, userId: 'system'}] : [] }
          ]);
        } else {
          setTasks(generateDynamicTasks(activeProperty, activeShift?.serviceType || '', simulationActive));
        }
      }
    }
  }, [selectedShiftId, currentStep, activeProperty, activeShift?.serviceType, simulationActive]);

  useEffect(() => {
    if (selectedShiftId && tasks.length > 0) {
      localStorage.setItem(`shared_protocol_v10_${selectedShiftId}`, JSON.stringify(tasks));
    }
  }, [tasks, selectedShiftId]);

  useEffect(() => {
    let interval: any;
    if ((currentStep === 'active' || currentStep === 'review' || currentStep === 'inspection') && activeShift?.actualStartTime) {
      const start = activeShift.actualStartTime;
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setTimer(elapsed > 0 ? elapsed : 0);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, activeShift?.actualStartTime]);

  const verifyLocation = () => {
    if (simulationActive) {
        showNotification("Simulation Active: GPS Bypassed", 'success');
        setIsLocationVerified(true);
        return;
    }
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
    const currentlyActive = shifts.find(s => s.status === 'active' && s.userIds.includes(user.id));
    if (currentlyActive && currentlyActive.id !== shift.id) {
        showNotification(`ACTIVE SHIFT ALERT: Finish ${currentlyActive.propertyName} first.`, 'error');
        return;
    }
    setSelectedShiftId(shift.id);
    localStorage.setItem('cleaner_active_shift_id', shift.id);
    setIsLocationVerified(false);
    setAttemptedNext(false);
    if (shift.status === 'active' || simulationActive) {
        setIsLocationVerified(true);
        setCurrentStep(shift.status === 'active' ? 'active' : 'overview');
    } else {
        setCurrentStep('overview');
    }
  };

  const handleStartShift = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'active', actualStartTime: Date.now() } as Shift) : s));
    setCurrentStep('active');
  };

  const isChecklistComplete = useMemo(() => {
    if (simulationActive) return true;
    const mandatoryTasks = tasks.filter(t => {
      if (!t.isMandatory) return false;
      if (activeShift?.isLinenShortage && (t.id.startsWith('room-task') || t.id === 'welcome-task')) return false;
      return true;
    });
    return mandatoryTasks.every(t => t.photos.length > 0);
  }, [tasks, activeShift?.isLinenShortage, simulationActive]);

  const handleFinishShift = () => {
    if (!selectedShiftId || isFinishing) return;
    if (!simulationActive && (keyInBoxPhotos.length < 1 || boxClosedPhotos.length < 1)) {
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
    localStorage.removeItem('cleaner_active_shift_id');
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
    if (reportModalType !== 'missing' && reportPhotos.length === 0) {
        showNotification("Camera photo required.", 'error');
        return;
    }
    const report: SpecialReport = { 
      id: `rep-${Date.now()}`, 
      description: reportDescription, 
      photos: reportPhotos, 
      timestamp: Date.now(), 
      status: 'open', 
      category: reportModalType === 'missing' ? missingCategory : undefined 
    };
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

  const generateDynamicTasks = (property: Property, serviceType: string, isBuild: boolean): CleaningTask[] => {
    const createPlaceholder = (id: string) => isBuild ? [{ url: getFakePhotoForTask(id), userId: 'system' }] : [];
    
    if (serviceType === 'REFRESH') {
      return [
        { id: 'refresh-dusting', label: 'DUSTING: All surfaces and electronics wiped', isMandatory: true, minPhotos: 1, photos: createPlaceholder('dusting') },
        { id: 'refresh-outside', label: 'OUTSIDE AREA: Swept and organized', isMandatory: true, minPhotos: 1, photos: createPlaceholder('general') },
        { id: 'refresh-floors', label: 'FLOORS: Vacuumed and washed', isMandatory: true, minPhotos: 1, photos: createPlaceholder('general') }
      ];
    }
    if (serviceType === 'BEDS ONLY') {
      const dynamicTasks: CleaningTask[] = [];
      const roomCount = property.rooms || 0;
      for (let i = 1; i <= roomCount; i++) {
        dynamicTasks.push({ id: `room-task-${i}`, label: `BEDROOM ${i}: Beds styled & made`, isMandatory: true, minPhotos: 1, photos: createPlaceholder('beds') });
      }
      dynamicTasks.push({ id: 'welcome-task', label: 'WELCOME PACK: Final styling', isMandatory: true, minPhotos: 1, photos: createPlaceholder('welcome') });
      return dynamicTasks;
    }

    const dynamicTasks: CleaningTask[] = [];
    dynamicTasks.push({ id: 'kitchen-task', label: 'KITCHEN: Surfaces & Appliances sanitized', isMandatory: true, minPhotos: 1, photos: createPlaceholder('kitchen') });
    dynamicTasks.push({ id: 'fridge-task', label: 'FRIDGE AND FREEZER IMPORTANT: Cleaned & Odor-free', isMandatory: true, minPhotos: 1, photos: createPlaceholder('kitchen') });
    const roomCount = property.rooms || 0;
    for (let i = 1; i <= roomCount; i++) {
      dynamicTasks.push({ id: `room-task-${i}`, label: `BEDROOM ${i}: Bed linens changed & styled`, isMandatory: true, minPhotos: 1, photos: createPlaceholder('beds') });
    }
    const bathCount = property.bathrooms || 0;
    for (let i = 1; i <= bathCount; i++) {
      dynamicTasks.push({ id: `bath-task-${i}`, label: `BATHROOM ${i}: Toilet & Shower deep cleaned`, isMandatory: true, minPhotos: 1, photos: createPlaceholder('bath') });
    }
    dynamicTasks.push({ id: 'living-task', label: 'LIVING/DINING AREA: Dusting & Mirror check', isMandatory: true, minPhotos: 1, photos: createPlaceholder('living') });
    dynamicTasks.push({ id: 'windows-task', label: 'WINDOWS AND WINDOW SILLS: Cleaned & Smudge-free', isMandatory: true, minPhotos: 1, photos: createPlaceholder('general') });
    dynamicTasks.push({ id: 'balcony-task', label: 'BALCONY/TERRACE: Cleaned', isMandatory: false, minPhotos: 0, photos: [] });
    dynamicTasks.push({ id: 'welcome-task', label: 'WELCOME PACK: Replenished', isMandatory: true, minPhotos: 1, photos: createPlaceholder('welcome') });
    dynamicTasks.push({ id: 'soaps-task', label: 'SOAP BOTTLES: Checked', isMandatory: false, minPhotos: 0, photos: [] });
    return dynamicTasks;
  };

  const getFakePhotoForTask = (taskId: string) => {
    if (taskId.includes('kitchen') || taskId.includes('fridge')) return FAKE_PHOTOS.kitchen;
    if (taskId.includes('bath')) return FAKE_PHOTOS.bathroom;
    if (taskId.includes('room') || taskId.includes('beds')) return FAKE_PHOTOS.bedroom;
    if (taskId.includes('welcome') || taskId.includes('inventory')) return FAKE_PHOTOS.general;
    if (taskId.includes('living') || taskId.includes('dusting')) return FAKE_PHOTOS.living;
    return FAKE_PHOTOS.general;
  };

  const handleSimulatePhoto = (target: 'task' | 'mess' | 'report' | 'checkout', tId?: string) => {
    const url = (target === 'checkout' && checkoutTarget === 'keyInBox') ? FAKE_PHOTOS.key : FAKE_PHOTOS.general;
    const attributed: AttributedPhoto = { url, userId: user.id };
    
    if (target === 'mess') setMessPhotos(prev => [...prev, url]);
    else if (target === 'report') setReportPhotos(prev => [...prev, url]);
    else if (target === 'checkout') {
        if (checkoutTarget === 'keyInBox') setKeyInBoxPhotos(prev => [...prev, attributed]);
        else if (checkoutTarget === 'boxClosed') setBoxClosedPhotos(prev => [...prev, attributed]);
    }
    else if (target === 'task') {
        const idToUpdate = tId || activeTaskId || tasks.find(t => t.photos.length === 0)?.id || tasks[0].id;
        setTasks(prev => prev.map(t => t.id === idToUpdate ? { ...t, photos: [...t.photos, attributed] } : t));
    }
    showNotification("Simulated Photo Attached Instantly", 'success');
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, target: 'task' | 'mess' | 'report' | 'checkout') => {
    if (simulationActive) return; 
    const file = e.target.files?.[0];
    if (!file || isProcessingPhoto) return;
    
    setIsProcessingPhoto(true);
    try {
      const finalUrl = await uploadFile(file);
      if (finalUrl) {
          const attributed: AttributedPhoto = { url: finalUrl, userId: user.id };
          if (target === 'mess') setMessPhotos(prev => [...prev, finalUrl]);
          else if (target === 'report') setReportPhotos(prev => [...prev, finalUrl]);
          else if (target === 'checkout') {
              if (checkoutTarget === 'keyInBox') setKeyInBoxPhotos(prev => [...prev, attributed]);
              else if (checkoutTarget === 'boxClosed') setBoxClosedPhotos(prev => [...prev, attributed]);
          }
          else if (target === 'task') {
            const tId = activeTaskId || tasks.find(t => t.photos.length === 0)?.id || tasks[0].id;
            setTasks(prev => prev.map(t => t.id === tId ? { ...t, photos: [...t.photos, attributed] } : t));
          }
      }
    } catch (error) { 
        console.error("Capture Logic Error:", error);
        showNotification("Capture failed. Try again.", 'error'); 
    } finally { 
        setIsProcessingPhoto(false);
        setActiveTaskId(null); 
        if (e.target) e.target.value = '';
    }
  };

  if (currentStep === 'list') {
    const isSupervisor = user.role === 'supervisor' || user.role === 'admin';
    const cleanTasks = activeQueue.filter(s => s.serviceType !== 'TO CHECK APARTMENT');
    const inspectionTasks = activeQueue.filter(s => s.serviceType === 'TO CHECK APARTMENT');

    return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-32 max-w-6xl mx-auto px-1 text-left relative">
        <header className="space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
            <div className="flex flex-col space-y-1">
              <p className="text-[#0D9488] font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px]">OPERATIONS TERMINAL ACTIVE</p>
              <h1 className="text-2xl md:text-4xl font-brand text-[#1E293B] tracking-tighter uppercase leading-none font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
            </div>
            <button onClick={() => setShowSupplyModal(true)} disabled={user.lastSupplyRequestDate && Date.now() - user.lastSupplyRequestDate < 86400000} className={`w-full md:w-auto px-6 md:px-8 py-3.5 md:py-4 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 bg-indigo-600 text-white hover:bg-indigo-700`}>
                <span className="text-xl">📦</span>
                <span>Request Supplies</span>
            </button>
          </div>

          <section className="bg-[#1E293B] rounded-3xl md:rounded-[40px] p-5 md:p-10 text-white shadow-2xl relative overflow-hidden group">
             <div className="relative z-10 flex flex-col lg:flex-row justify-between items-stretch gap-8 md:gap-10">
                <div className="flex-1 space-y-6 md:space-y-8">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#2DD4BF]">Monthly Intelligence</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
                        <div><p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Score</p><p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-[#F59E0B]">{performanceStats.score}%</p></div>
                        <div><p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Units</p><p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyJobs}</p></div>
                        <div><p className="text-[8px] font-black text-[#CBD5E1] uppercase tracking-widest">Hours</p><p className="text-3xl md:text-5xl font-bold font-brand tracking-tighter text-white">{performanceStats.monthlyHours}</p></div>
                    </div>
                </div>
             </div>
          </section>

          <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
            {weekDays.map((wd) => (
              <button key={wd.iso} onClick={() => setViewedDateISO(wd.iso)} className={`flex flex-col items-center min-w-[55px] md:min-w-[70px] py-3 md:py-4 rounded-2xl md:rounded-3xl border transition-all ${viewedDateISO === wd.iso ? 'bg-teal-600 border-teal-600 text-white shadow-xl scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-600/40 hover:bg-teal-50/10 shadow-sm'}`}>
                <span className={`text-[7px] md:text-[8px] font-black uppercase mb-0.5 md:mb-1 ${viewedDateISO === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                <span className={`text-xs md:text-sm font-black ${viewedDateISO === wd.iso ? 'text-white' : 'text-gray-700'}`}>{wd.dateNum}</span>
              </button>
            ))}
          </div>
        </header>

        <div className={`grid grid-cols-1 gap-6 md:gap-8 ${isSupervisor ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-[9px] md:text-[10px] font-black text-black/30 uppercase tracking-[0.4em] px-2">UNITS TO CLEAN ({cleanTasks.length})</h2>
            <div className="space-y-3 md:space-y-4">
                {cleanTasks.length === 0 ? <p className="p-10 text-center opacity-20 uppercase font-black tracking-widest text-[10px]">No sessions found</p> : cleanTasks.map(shift => (
                  <div key={shift.id} onClick={() => setSelectedIdAndStart(shift)} className={`p-4 md:p-6 rounded-2xl md:rounded-[32px] border transition-all relative overflow-hidden group active:scale-[0.98] ${shift.status === 'active' ? 'bg-teal-50 border-teal-600 shadow-lg ring-2 ring-teal-600/20' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 text-left">
                        <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-tight leading-tight">{shift.propertyName}</h3>
                        <p className="text-[8px] md:text-[9px] font-black text-teal-600 uppercase tracking-widest">{shift.startTime} • {shift.serviceType}</p>
                      </div>
                      {shift.status === 'active' && <span className="text-[7px] md:text-[8px] font-black bg-teal-600 text-white px-2 py-1 rounded-full animate-pulse uppercase">Live</span>}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {isSupervisor && (
             <div className="space-y-3 md:space-y-4">
                <h2 className="text-[9px] md:text-[10px] font-black text-black/30 uppercase tracking-[0.4em] px-2">UNITS TO INSPECT ({inspectionTasks.length})</h2>
                <div className="space-y-3 md:space-y-4">
                   {inspectionTasks.map(shift => (
                      <div key={shift.id} onClick={() => setSelectedIdAndStart(shift)} className="p-4 md:p-6 bg-white border border-gray-200 rounded-2xl md:rounded-[32px] hover:border-indigo-400 transition-all cursor-pointer">
                        <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-tight leading-tight">{shift.propertyName}</h3>
                        <p className="text-[8px] md:text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">Inspection Mission</p>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 'overview' && activeShift) {
    return (
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-5 duration-500 pb-32 max-w-2xl mx-auto px-1 text-left">
        <button onClick={() => { setSelectedShiftId(null); localStorage.removeItem('cleaner_active_shift_id'); setCurrentStep('list'); }} className="text-black/40 hover:text-black flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> BACK</button>
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-brand font-bold text-black uppercase tracking-tight leading-tight">{activeShift.propertyName}</h1>
          <p className="text-[9px] md:text-[10px] font-black text-teal-600 uppercase tracking-[0.3em]">MISSION BRIEFING</p>
        </div>
        <div className="bg-white border border-teal-100 p-5 md:p-8 rounded-[2.5rem] md:rounded-[40px] shadow-xl">
           <div className="bg-teal-50 p-5 md:p-6 rounded-3xl md:rounded-[32px] border border-teal-100 space-y-5 md:space-y-6">
              <div className="flex justify-between items-center border-b border-teal-200/40 pb-3">
                 <p className="text-[7px] md:text-[8px] font-black text-teal-700 uppercase tracking-widest">Keys & Access</p>
                 {!isLocationVerified && <span className="text-[6px] md:text-[7px] font-black bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full uppercase animate-pulse">GPS Locked</span>}
              </div>
              <div className="space-y-5 md:space-y-6">
                 <div className="bg-white p-4 md:p-5 rounded-2xl border border-teal-100 text-center shadow-inner">
                    <p className="text-[6px] md:text-[7px] font-black uppercase text-teal-800/40 mb-1">Keybox Secure Code</p>
                    <p className="text-2xl md:text-3xl font-mono font-bold text-teal-700 tracking-[0.2em]">{isLocationVerified ? activeProperty?.keyboxCode : '****'}</p>
                 </div>
              </div>
           </div>
           <div className="pt-6 space-y-4 mt-6">
              {!isLocationVerified ? (
                <button onClick={verifyLocation} disabled={isVerifying} className="w-full py-4 md:py-5 rounded-2xl md:rounded-3xl bg-black text-[#C5A059] font-black uppercase text-[10px] md:text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                  {isVerifying ? 'Locating...' : 'Verify GPS to Unlock'}
                </button>
              ) : (
                <button onClick={handleStartShift} className="w-full py-4 md:py-5 rounded-2xl md:rounded-3xl bg-teal-600 text-white font-black uppercase text-[10px] md:text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all hover:bg-teal-700">Initialize deployment</button>
              )}
           </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'active' && activeShift) {
    return (
      <div className="pb-32 animate-in fade-in duration-500 max-w-3xl mx-auto text-left">
         <div className={`p-6 md:p-10 mb-6 md:mb-8 rounded-b-[2.5rem] md:rounded-b-[60px] text-white shadow-2xl space-y-3 transition-colors ${activeShift.isLinenShortage ? 'bg-amber-600' : 'bg-[#0D9488]'}`}>
            <div className="flex justify-between items-start">
               <div className="space-y-0.5">
                  <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight leading-none">{activeShift.propertyName}</h2>
                  <div className="flex items-center gap-2">
                     <span className={`w-1.5 h-1.5 rounded-full animate-pulse bg-green-400`}></span>
                     <p className="text-[8px] md:text-[9px] font-black text-white/60 uppercase tracking-[0.3em]">Live Mission • {Math.floor(timer / 3600)}h {Math.floor((timer % 3600) / 60)}m</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="px-3 md:px-4 space-y-8 md:space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
               <button onClick={() => simulationActive ? handleSimulatePhoto('mess') : setShowMessReport(true)} className="h-20 md:h-24 bg-rose-50 border-2 border-rose-200 text-rose-700 flex flex-col items-center justify-center gap-1.5 md:gap-2 rounded-2xl md:rounded-[28px] transition-all active:scale-95 hover:bg-rose-100 shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-widest">Extra Hours</span>
               </button>
               <button onClick={() => simulationActive ? handleSimulatePhoto('report') : setReportModalType('maintenance')} className="h-20 md:h-24 bg-slate-50 border-2 border-slate-300 text-slate-700 flex flex-col items-center justify-center gap-1.5 md:gap-2 rounded-2xl md:rounded-[28px] transition-all active:scale-95 hover:bg-slate-100 shadow-sm">
                  <span className="text-[7px] font-black uppercase tracking-tight text-center leading-none">Maintenance & Damages</span>
               </button>
               <button onClick={() => simulationActive ? handleSimulatePhoto('report') : setReportModalType('missing')} className="h-20 md:h-24 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 flex flex-col items-center justify-center gap-1.5 md:gap-2 rounded-2xl md:rounded-[28px] transition-all active:scale-95 hover:bg-indigo-100 shadow-sm">
                  <span className="text-[8px] font-black uppercase tracking-widest">Missing</span>
               </button>
            </div>

            <div className="space-y-3.5 md:space-y-4">
               {tasks.map(task => {
                  const hasPhoto = task.photos.length > 0;
                  return (
                     <div key={task.id} className={`border rounded-3xl md:rounded-[32px] p-5 md:p-6 transition-all shadow-sm ${hasPhoto ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-4">
                           <div className="space-y-1 flex-1">
                              <p className={`text-xs md:text-sm font-bold uppercase leading-tight ${hasPhoto ? 'text-teal-900' : 'text-slate-700'}`}>{task.label}</p>
                              {hasPhoto ? <p className="text-[7px] md:text-[8px] font-black text-teal-600 uppercase tracking-[0.3em]">Satisfied</p> : <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Evidence Pending</p>}
                           </div>
                           <button 
                              onClick={() => { if(simulationActive) { handleSimulatePhoto('task', task.id); } else { setActiveTaskId(task.id); cameraInputRef.current?.click(); } }} 
                              className={`w-16 h-16 rounded-xl md:rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${hasPhoto ? 'bg-white border-teal-200 text-teal-400' : 'bg-slate-50 border-slate-200 text-slate-300'}`}
                           >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                           </button>
                        </div>
                     </div>
                  );
               })}
            </div>

            <div className="pb-10 pt-4">
               <button onClick={() => { if(isChecklistComplete) setCurrentStep('review'); else showNotification("Incomplete Checklist"); }} className={`w-full font-black py-5 md:py-6 rounded-2xl md:rounded-[32px] text-[10px] md:text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${isChecklistComplete ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 shadow-none'}`}>
                 {isChecklistComplete ? 'PROCEED TO CLOCK-OUT' : 'LOCKED: Checklist Pending'}
               </button>
            </div>
         </div>
         
         {!simulationActive && (
           <>
            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />
            <input type="file" ref={messCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'mess')} />
            <input type="file" ref={reportCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'report')} />
            <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
           </>
         )}

         {(reportModalType || showMessReport) && (
            <div className="fixed inset-0 bg-black/90 z-[1000] flex items-end sm:items-center justify-center p-2 sm:p-4 backdrop-blur-md">
               <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative text-center">
                  <h3 className="text-xl font-bold uppercase text-slate-900">{showMessReport ? 'Extra Hours Report' : 'Technical Report'}</h3>
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-medium outline-none h-32" placeholder="Details..." value={showMessReport ? messDescription : reportDescription} onChange={e => showMessReport ? setMessDescription(e.target.value) : setReportDescription(e.target.value)} />
                  <div className="flex gap-3">
                     <button onClick={() => { setShowMessReport(false); setReportModalType(null); }} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-xl uppercase text-[10px]">Cancel</button>
                     <button onClick={showMessReport ? handleSubmitMessReport : handleIncidentSubmit} className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl">Submit</button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  if (currentStep === 'review') {
    return (
      <div className="pb-32 px-2 md:px-4 pt-6 md:pt-10 max-w-2xl mx-auto text-left space-y-8 animate-in fade-in">
         <div className="space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-brand font-extrabold text-slate-900 uppercase tracking-tighter">Security Debrief</h2>
            <p className="text-[9px] md:text-[10px] font-black text-teal-600 uppercase tracking-[0.4em]">Final Checkout Protocol</p>
         </div>
         <div className="bg-white border border-slate-100 p-6 md:p-10 rounded-3xl space-y-8 shadow-2xl">
            <div className="space-y-4">
               <p className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Phase 1: Deployment Proof (Key in Box)</p>
               <button 
                  onClick={() => { setCheckoutTarget('keyInBox'); if(simulationActive) handleSimulatePhoto('checkout'); else checkoutKeyRef.current?.click(); }} 
                  className={`w-full py-4 rounded-xl font-black uppercase text-[10px] border-2 border-dashed ${keyInBoxPhotos.length > 0 ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
               >
                 {keyInBoxPhotos.length > 0 ? '✓ Photo Attached' : 'Capture Key Proof'}
               </button>
            </div>
            <div className="space-y-4">
               <p className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">Phase 2: Secure Enclosure (Box Closed)</p>
               <button 
                  onClick={() => { setCheckoutTarget('boxClosed'); if(simulationActive) handleSimulatePhoto('checkout'); else checkoutKeyRef.current?.click(); }} 
                  className={`w-full py-4 rounded-xl font-black uppercase text-[10px] border-2 border-dashed ${boxClosedPhotos.length > 0 ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
               >
                 {boxClosedPhotos.length > 0 ? '✓ Photo Attached' : 'Capture Box Proof'}
               </button>
            </div>
         </div>
         <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <button onClick={() => setCurrentStep('active')} className="flex-1 py-5 bg-white text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest border border-slate-100">Back</button>
            <button onClick={handleFinishShift} disabled={isFinishing} className={`flex-[2] py-5 font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 ${isFinishing ? 'bg-slate-300' : 'bg-teal-600 text-white'}`}>
                {isFinishing ? 'Processing...' : 'Secure & Clock out'}
            </button>
         </div>
      </div>
    );
  }

  return <div className="p-40 text-center opacity-20 font-black uppercase tracking-[0.5em] animate-pulse">Initialising Operation...</div>;
};

export default CleanerPortal;
