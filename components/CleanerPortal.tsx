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
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

interface CleanerPortalProps {
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
  shifts, setShifts, properties, users, initialSelectedShiftId, onConsumedDeepLink, authorizedInspectorIds = [], onClosePortal,
  inventoryItems = [], onAddSupplyRequest
}) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const isHousekeeping = currentUser.role === 'housekeeping';
  const isManagement = isAdmin || isHousekeeping;
  
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(initialSelectedShiftId || null);
  const [currentStep, setCurrentStep] = useState<'list' | 'overview' | 'active' | 'review' | 'inspection'>('list');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [timer, setTimer] = useState(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const [isLocationVerified, setIsLocationVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  
  // Checkout Key states
  const [keyInBoxPhotos, setKeyInBoxPhotos] = useState<AttributedPhoto[]>([]);
  const [boxClosedPhotos, setBoxClosedPhotos] = useState<AttributedPhoto[]>([]);

  // Reporting modals state
  const [showMessReport, setShowMessReport] = useState(false);
  const [messDescription, setMessDescription] = useState('');
  const [messPhotos, setMessPhotos] = useState<string[]>([]);

  const [reportModalType, setReportModalType] = useState<'maintenance' | 'damage' | 'missing' | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [missingCategory, setMissingCategory] = useState<'laundry' | 'apartment'>('apartment');

  // Supply Request State
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedSupplyItems, setSelectedSupplyItems] = useState<Record<string, number>>({});

  // Special Request Checkboxes state
  const [completedSpecialRequests, setCompletedSpecialRequests] = useState<Record<string, boolean>>({});

  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messCameraRef = useRef<HTMLInputElement>(null);
  const reportCameraRef = useRef<HTMLInputElement>(null);
  const checkoutKeyRef = useRef<HTMLInputElement>(null);
  
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<'keyInBox' | 'boxClosed' | null>(null);

  // Prevent multiple triggers of geofence breach
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
    if (isManagement) return null; 
    return (shifts || []).find(s => s.status === 'active' && s.userIds.includes(currentUser.id));
  }, [shifts, currentUser.id, isManagement]);

  const canPerformAudit = useMemo(() => {
    if (!currentUser.id) return false;
    if (currentUser.role === 'supervisor') return true;
    if (isAdmin) return true;
    if (isManagement) return (authorizedInspectorIds.includes(currentUser.id) || (activeShift && activeShift.userIds.includes(currentUser.id)));
    return false;
  }, [currentUser, activeShift, authorizedInspectorIds, isAdmin, isManagement]);

  const activeQueue = useMemo(() => {
    return (shifts || [])
      .filter(s => {
        if (!s.isPublished) return false;
        if (s.date !== viewedDateStr) return false;
        if (s.userIds.includes(currentUser.id)) return true;
        if (isManagement && s.status === 'completed' && s.approvalStatus === 'pending') return true;
        return false;
      })
      .sort((a, b) => {
        // Updated sorting logic: Prioritize time for non-completed tasks
        const isCompletedA = a.status === 'completed';
        const isCompletedB = b.status === 'completed';
        
        // Put completed items at the bottom
        if (isCompletedA && !isCompletedB) return 1;
        if (!isCompletedA && isCompletedB) return -1;
        
        // If both are active/pending, sort strictly by time
        if (!isCompletedA && !isCompletedB) {
            return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
        }
        
        // If both are completed, sort by time as well (or end time if desired, but sticking to start time for consistency)
        return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
      });
  }, [shifts, currentUser.id, isManagement, viewedDateStr]);

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
    if (isManagement) return; // Admins don't get auto-kicked
    if (hasTriggeredBreach.current) return; // Prevent double trigger

    hasTriggeredBreach.current = true;

    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
      ...s, 
      status: 'completed', 
      actualEndTime: Date.now(), 
      // Changed to PENDING so Admin sees it in verification queue to fix time
      approvalStatus: 'pending', 
      wasRejected: false,
      approvalComment: 'SYSTEM AUTO-STOP: Geofence Breach (User left property). Please verify actual hours.',
      tasks: tasks 
    } as Shift) : s));

    // Clear local storage
    localStorage.removeItem(`shared_protocol_v8_${selectedShiftId}`);
    localStorage.removeItem(`shared_special_reqs_v1_${selectedShiftId}`);
    localStorage.removeItem(`shared_checkout_keys_v1_${selectedShiftId}`);
    
    // Kick user back to list
    setSelectedShiftId(null);
    setCurrentStep('list');
    
    // Show alert
    alert("⚠️ LOCATION ALERT: You have left the property area (150m+). Shift has been auto-stopped and sent for review.");
  }, [selectedShiftId, setShifts, tasks, isManagement]);

  // GPS Monitor - Strict 150m Geofence Logic
  useEffect(() => {
    let watchId: number | null = null;
    
    // Reset trigger when entering a shift
    if (currentStep === 'active') {
        hasTriggeredBreach.current = false;
    }

    // Only run if shift is active, property has coordinates, and user is NOT admin/management
    if (currentStep === 'active' && activeProperty?.lat && activeProperty?.lng && !isManagement) {
      
      const targetLat = activeProperty.lat;
      const targetLng = activeProperty.lng;

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          
          const distanceKm = calculateDistance(targetLat, targetLng, currentLat, currentLng);

          // 0.15 km = 150 meters
          // Triggers if user walks away significantly
          if (distanceKm > 0.15) { 
            console.warn(`Geofence Breach Detected: ${distanceKm.toFixed(4)}km`);
            handleForceClockOut();
          }
        },
        (error) => console.warn("Geolocation watch error:", error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }
    
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentStep, activeProperty, handleForceClockOut, isManagement]);

  useEffect(() => {
    if (initialSelectedShiftId) {
      const shift = (shifts || []).find(s => s.id === initialSelectedShiftId);
      if (shift) {
        setSelectedShiftId(shift.id);
        const needsVerification = shift.status === 'completed' && shift.approvalStatus === 'pending';
        const isExplicitAudit = shift.serviceType === 'TO CHECK APARTMENT';
        if (canPerformAudit && (isExplicitAudit || needsVerification)) {
          setCurrentStep('inspection');
        } else {
          setCurrentStep(shift.status === 'active' ? 'active' : 'overview');
        }
        if (onConsumedDeepLink) onConsumedDeepLink();
      }
    }
  }, [initialSelectedShiftId, shifts, onConsumedDeepLink, canPerformAudit]);

  // Load Saved Tasks
  useEffect(() => {
    if (selectedShiftId && currentStep === 'active' && activeProperty) {
      const storageKey = `shared_protocol_v8_${selectedShiftId}`;
      const specialReqKey = `shared_special_reqs_v1_${selectedShiftId}`;
      const checkoutKey = `shared_checkout_keys_v1_${selectedShiftId}`;
      try {
        const savedTasks = localStorage.getItem(storageKey);
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        } else {
          if (activeShift?.serviceType === 'TO FIX') {
            setTasks([{ id: 'remedial-proof', label: 'Proof of Correction (Required)', isMandatory: true, minPhotos: 1, photos: [] }]);
          } else {
            setTasks(generateDynamicTasks(activeProperty));
          }
        }
        const savedSpecial = localStorage.getItem(specialReqKey);
        if (savedSpecial) setCompletedSpecialRequests(JSON.parse(savedSpecial));
        const savedCheckout = localStorage.getItem(checkoutKey);
        if (savedCheckout) {
          const parsed = JSON.parse(savedCheckout);
          setKeyInBoxPhotos(parsed.keyInBox || []);
          setBoxClosedPhotos(parsed.boxClosed || []);
        }
      } catch (e) { console.error(e); }
    }
  }, [selectedShiftId, currentStep, activeProperty, activeShift?.serviceType]);

  // Persist Tasks
  useEffect(() => {
    if (selectedShiftId && tasks.length > 0) {
      try { localStorage.setItem(`shared_protocol_v8_${selectedShiftId}`, JSON.stringify(tasks)); } catch (e) { console.warn(e); }
    }
    if (selectedShiftId) {
      try { 
        localStorage.setItem(`shared_special_reqs_v1_${selectedShiftId}`, JSON.stringify(completedSpecialRequests));
        localStorage.setItem(`shared_checkout_keys_v1_${selectedShiftId}`, JSON.stringify({ keyInBox: keyInBoxPhotos, boxClosed: boxClosedPhotos }));
      } catch (e) { console.warn(e); }
    }
  }, [tasks, completedSpecialRequests, keyInBoxPhotos, boxClosedPhotos, selectedShiftId]);

  // Timer
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
        showNotification("Property coordinates missing. Proceeding with caution.", 'success');
        setIsLocationVerified(true);
        return;
    }

    setIsVerifying(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const distance = calculateDistance(
                activeProperty.lat!,
                activeProperty.lng!,
                position.coords.latitude,
                position.coords.longitude
            );
            
            // Check-in allowed within 200m
            if (distance <= 0.2) {
                setIsLocationVerified(true);
                showNotification("Location Verified Successfully", 'success');
            } else {
                showNotification(`Location Error: You are ${distance.toFixed(2)}km away. Must be closer.`, 'error');
            }
            setIsVerifying(false);
        },
        (error) => {
            console.error(error);
            showNotification("GPS Signal Required. Please enable location services.", 'error');
            setIsVerifying(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const setSelectedIdAndStart = (shift: Shift) => {
    if (currentlyActiveShift && currentlyActiveShift.id !== shift.id) {
        showNotification(`ACTIVE SHIFT ALERT: You must clock out of ${currentlyActiveShift.propertyName} first.`, 'error');
        return;
    }
    
    const isCompleted = shift.status === 'completed';
    const canEnter = !isCompleted || (isManagement && shift.approvalStatus === 'pending');
    
    if (!canEnter) return;

    setSelectedShiftId(shift.id);
    setIsLocationVerified(false);
    
    const needsVerification = shift.status === 'completed' && shift.approvalStatus === 'pending';
    const isExplicitAudit = shift.serviceType === 'TO CHECK APARTMENT';
    if (canPerformAudit && (isExplicitAudit || needsVerification)) {
      setCurrentStep('inspection');
    } else {
      if (shift.status === 'active') setCurrentStep('active');
      else setCurrentStep('overview');
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, target: 'task' | 'mess' | 'report' | 'checkout') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser.id || isProcessingPhoto) return;
    setIsProcessingPhoto(true);
    try {
      const url = await uploadFile(file);
      if (url) {
        const attributed: AttributedPhoto = { url: url, userId: currentUser.id };
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
          if (selectedShiftId) {
             setShifts(prev => prev.map(s => s.id === selectedShiftId ? { ...s, tasks: newTasks } : s));
          }
        }
      }
    } catch (error) { console.error(error); showNotification("Photo upload failed.", 'error'); } finally { setIsProcessingPhoto(false); }
  };

  const handleStartShift = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'active', actualStartTime: Date.now() } as Shift) : s));
    setCurrentStep('active');
  };

  const handleProceedToClockOut = () => {
    const missingMandatory = tasks.filter(t => t.isMandatory && t.photos.length < t.minPhotos);
    if (missingMandatory.length > 0) {
      showNotification(`MANDATORY ACTION REQUIRED: Please verify ${missingMandatory[0].label} with a photo before proceeding.`, 'error');
      return;
    }
    setCurrentStep('review');
  };

  const handleFinishShift = () => {
    if (!selectedShiftId) return;
    if (keyInBoxPhotos.length < 1 || boxClosedPhotos.length < 1) {
      showNotification("SECURITY PROTOCOL: Keybox evidence photos are required to clock out.", 'error');
      return;
    }
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
        ...s, 
        status: 'completed', 
        actualEndTime: Date.now(), 
        approvalStatus: 'pending', 
        tasks: tasks,
        checkoutPhotos: { keyInBox: keyInBoxPhotos, boxClosed: boxClosedPhotos }
    } as Shift) : s));
    
    localStorage.removeItem(`shared_protocol_v8_${selectedShiftId}`);
    localStorage.removeItem(`shared_special_reqs_v1_${selectedShiftId}`);
    localStorage.removeItem(`shared_checkout_keys_v1_${selectedShiftId}`);
    
    if (isManagement && onClosePortal) onClosePortal();
    else { setCurrentStep('list'); setSelectedShiftId(null); }
  };

  const handleForceFinish = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
        ...s, 
        status: 'completed', 
        actualEndTime: Date.now(), 
        approvalStatus: 'pending', 
        approvalComment: 'ADMIN FORCE CHECKOUT',
        tasks: tasks,
        checkoutPhotos: { keyInBox: keyInBoxPhotos, boxClosed: boxClosedPhotos }
    } as Shift) : s));
    
    localStorage.removeItem(`shared_protocol_v8_${selectedShiftId}`);
    localStorage.removeItem(`shared_special_reqs_v1_${selectedShiftId}`);
    localStorage.removeItem(`shared_checkout_keys_v1_${selectedShiftId}`);
    
    if (isManagement && onClosePortal) onClosePortal();
    else { setCurrentStep('list'); setSelectedShiftId(null); }
  };

  const handleSubmitMessReport = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? {
      ...s,
      messReport: {
        description: messDescription,
        photos: messPhotos,
        status: 'pending'
      }
    } : s));
    setShowMessReport(false);
    setMessDescription('');
    setMessPhotos([]);
    showNotification("Request for extra time submitted.", 'success');
  };

  const handleReportSubmit = () => {
    if (!selectedShiftId || !reportModalType) return;
    
    if (!reportDescription.trim()) {
        showNotification("Please describe the issue.", 'error');
        return;
    }
    if ((reportModalType === 'maintenance' || reportModalType === 'damage') && reportPhotos.length === 0) {
        showNotification("A photo from camera is required for this report.", 'error');
        return;
    }

    // Set status to 'open' explicitly to ensure visibility
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
    setMissingCategory('apartment');
    showNotification("Incident reported successfully.", 'success');
  };

  // --- RENDER ---

  if (currentStep === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto px-2 text-left relative">
        {notification && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[1000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[90vw] animate-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
            <p className="text-xs font-bold leading-tight">{notification.message}</p>
          </div>
        )}

        <header className="space-y-6">
          <div className="flex flex-col space-y-1">
            <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">Field Operations</p>
            <h1 className="text-2xl font-serif-brand text-black tracking-tight uppercase leading-none font-bold">
              Deployment Schedule
            </h1>
          </div>
          
          {/* Calendar Strip */}
          <div className="flex justify-between items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {weekDays.map((wd) => (
              <button
                key={wd.iso}
                onClick={() => setViewedDateISO(wd.iso)}
                className={`flex flex-col items-center min-w-[60px] py-3 rounded-2xl border transition-all ${
                  viewedDateISO === wd.iso 
                    ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-lg scale-105' 
                    : 'bg-white border-gray-200 text-gray-400 hover:border-[#C5A059]/40'
                }`}
              >
                <span className={`text-[8px] font-black uppercase mb-1 ${viewedDateISO === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                <span className={`text-sm font-bold ${viewedDateISO === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse"></span>
            <h2 className="text-[9px] font-black text-black/30 uppercase tracking-[0.4em]">ASSIGNED UNITS ({activeQueue.length})</h2>
          </div>

          {activeQueue.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[32px] opacity-40">
              <p className="text-[10px] font-black uppercase text-black tracking-widest">No deployments for this date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeQueue.map(shift => {
                const isActive = shift.status === 'active';
                const isCompleted = shift.status === 'completed';
                const isPendingReview = isCompleted && shift.approvalStatus === 'pending';
                const isRejected = shift.approvalStatus === 'rejected';
                
                return (
                  <div 
                    key={shift.id}
                    onClick={() => setSelectedIdAndStart(shift)}
                    className={`p-6 rounded-[32px] border transition-all relative overflow-hidden group active:scale-[0.98] ${
                      isPendingReview ? 'bg-blue-50 border-blue-200 shadow-md cursor-pointer' :
                      isActive ? 'bg-[#FDF8EE] border-[#C5A059] shadow-lg ring-2 ring-[#C5A059]/20 cursor-pointer' :
                      isCompleted ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' :
                      'bg-white border-gray-200 hover:border-[#C5A059]/40 cursor-pointer shadow-sm'
                    }`}
                  >
                    {isActive && <div className="absolute top-0 left-0 w-1 h-full bg-[#C5A059]"></div>}
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-black uppercase tracking-tight">{shift.propertyName}</h3>
                        <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-widest">{shift.startTime} • {shift.serviceType}</p>
                        {shift.correctionStatus === 'fixing' && (
                           <span className="inline-block bg-red-100 text-red-600 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-red-200">Correction Required</span>
                        )}
                        {shift.serviceType === 'TO CHECK APARTMENT' && (
                           <span className="inline-block bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-purple-200">Audit Task</span>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {isActive ? (
                          <span className="text-[8px] font-black bg-[#C5A059] text-black px-3 py-1 rounded-full animate-pulse border border-[#C5A059]">IN PROGRESS</span>
                        ) : isPendingReview ? (
                          <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">IN REVIEW</span>
                        ) : isCompleted ? (
                          <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">DONE</span>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-[#C5A059] group-hover:text-black group-hover:border-[#C5A059] transition-all">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- OVERVIEW / START SHIFT VIEW ---
  if (currentStep === 'overview' && activeShift) {
    return (
      <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 pb-32 max-w-2xl mx-auto px-4 text-left">
        <button onClick={() => { setSelectedShiftId(null); setCurrentStep('list'); }} className="text-black/40 hover:text-black flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back to Schedule
        </button>

        <div className="space-y-2">
          <h1 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight leading-tight">{activeShift.propertyName}</h1>
          <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.3em]">Deployment Briefing</p>
        </div>

        <div className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] space-y-8 shadow-xl">
           <div className="grid grid-cols-2 gap-8">
              <div>
                 <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest mb-1">Service Protocol</p>
                 <p className="text-sm font-bold text-black uppercase">{activeShift.serviceType}</p>
              </div>
              <div>
                 <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest mb-1">Scheduled Time</p>
                 <p className="text-sm font-bold text-black uppercase">{activeShift.startTime}</p>
              </div>
           </div>

           {activeProperty?.accessNotes && (
             <div className="bg-white/60 p-5 rounded-2xl border border-[#D4B476]/10">
                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest mb-2 flex items-center gap-2">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Access Protocol
                </p>
                <p className="text-xs text-black italic leading-relaxed">{activeProperty.accessNotes}</p>
             </div>
           )}

           {activeProperty?.keyboxCode && (
             <div className="flex gap-4">
                <div className="flex-1 bg-black text-[#C5A059] p-4 rounded-2xl text-center">
                   <p className="text-[7px] font-black uppercase tracking-widest mb-1 opacity-60">Main Entrance</p>
                   <p className="text-xl font-mono font-bold tracking-widest">{activeProperty.mainEntranceCode || '---'}</p>
                </div>
                <div className="flex-1 bg-[#C5A059] text-black p-4 rounded-2xl text-center">
                   <p className="text-[7px] font-black uppercase tracking-widest mb-1 opacity-60">Keybox Code</p>
                   <p className="text-xl font-mono font-bold tracking-widest">{activeProperty.keyboxCode}</p>
                </div>
             </div>
           )}

           <div className="pt-4 space-y-4">
              <button 
                onClick={verifyLocation}
                disabled={isVerifying || isLocationVerified}
                className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-2 transition-all ${isLocationVerified ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-gray-200 text-black/60 hover:bg-gray-50'}`}
              >
                 {isVerifying ? 'LOCATING...' : isLocationVerified ? 'LOCATION CONFIRMED' : 'VERIFY GPS LOCATION'}
              </button>

              <button 
                onClick={handleStartShift}
                disabled={!isLocationVerified && !isManagement}
                className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl transition-all active:scale-95 ${!isLocationVerified && !isManagement ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-black text-[#C5A059] hover:bg-zinc-900'}`}
              >
                 START SHIFT
              </button>
              {!isLocationVerified && !isManagement && <p className="text-[8px] text-red-500 text-center font-bold uppercase tracking-widest">GPS Verification Required to Start</p>}
           </div>
        </div>
      </div>
    );
  }

  // --- ACTIVE SHIFT VIEW ---
  if (currentStep === 'active' && activeShift) {
    return (
      <div className="pb-40 px-4 pt-4 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
         <header className="flex justify-between items-center sticky top-0 bg-[#F9FAFB]/95 backdrop-blur-sm py-4 z-40 border-b border-gray-200">
            <div>
               <h2 className="text-lg font-bold text-black uppercase tracking-tight">{activeShift.propertyName}</h2>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">LIVE • {Math.floor(timer / 3600)}h {Math.floor((timer % 3600) / 60)}m</p>
               </div>
            </div>
            <button onClick={() => setReportModalType('maintenance')} className="bg-red-50 text-red-600 p-3 rounded-full border border-red-100 shadow-sm active:scale-95">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
         </header>

         {/* Tasks List */}
         <div className="space-y-6">
            {tasks.map(task => {
               const hasPhoto = task.photos.length > 0;
               return (
                  <div key={task.id} className={`bg-white border rounded-[28px] p-6 transition-all ${hasPhoto ? 'border-green-200 bg-green-50/30' : 'border-gray-200 shadow-sm'}`}>
                     <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                           <p className="text-sm font-bold text-black uppercase leading-tight">{task.label}</p>
                           {task.isMandatory && <span className="text-[7px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-widest">Evidence Required</span>}
                        </div>
                        {hasPhoto && <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                     </div>
                     
                     <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {task.photos.map((p, i) => (
                           <img key={i} src={p.url} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shadow-sm" alt="Evidence" />
                        ))}
                        <button 
                           onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }}
                           className="w-16 h-16 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#C5A059] hover:text-[#C5A059] transition-all shrink-0"
                        >
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                     </div>
                  </div>
               );
            })}
         </div>
         <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />

         {/* Action Bar */}
         <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 flex gap-3 justify-center z-50">
            <button onClick={() => setShowMessReport(true)} className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl text-[9px] uppercase tracking-widest border border-red-100 active:scale-95">REQUEST TIME</button>
            <button onClick={handleProceedToClockOut} className="flex-[2] bg-black text-[#C5A059] font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.3em] shadow-xl active:scale-95">FINISH SHIFT</button>
         </div>

         {/* Report Modal */}
         {(reportModalType || showMessReport) && (
            <div className="fixed inset-0 bg-black/80 z-[1000] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in slide-in-from-bottom-10">
               <div className="bg-white w-full max-w-md rounded-[40px] p-8 space-y-6">
                  <div className="text-center space-y-2">
                     <h3 className="text-xl font-bold text-black uppercase">{showMessReport ? 'Request Extra Time' : `Report ${reportModalType}`}</h3>
                     <p className="text-[9px] text-black/40 font-black uppercase tracking-widest">Incident Documentation</p>
                  </div>
                  
                  {!showMessReport && (
                     <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        {['maintenance', 'damage', 'missing'].map(t => (
                           <button key={t} onClick={() => setReportModalType(t as any)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${reportModalType === t ? 'bg-black text-white shadow-md' : 'text-black/40'}`}>{t}</button>
                        ))}
                     </div>
                  )}

                  {reportModalType === 'missing' && (
                     <div className="flex gap-2">
                        <button onClick={() => setMissingCategory('apartment')} className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase border ${missingCategory === 'apartment' ? 'bg-[#C5A059] text-black border-[#C5A059]' : 'bg-white border-gray-200 text-gray-400'}`}>Apartment Item</button>
                        <button onClick={() => setMissingCategory('laundry')} className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase border ${missingCategory === 'laundry' ? 'bg-[#C5A059] text-black border-[#C5A059]' : 'bg-white border-gray-200 text-gray-400'}`}>Laundry Item</button>
                     </div>
                  )}

                  <textarea 
                     className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium outline-none focus:border-[#C5A059] h-32 resize-none"
                     placeholder={showMessReport ? "Describe why extra time is needed (e.g. extremely dirty kitchen)..." : "Describe the issue..."}
                     value={showMessReport ? messDescription : reportDescription}
                     onChange={e => showMessReport ? setMessDescription(e.target.value) : setReportDescription(e.target.value)}
                  />

                  <div className="flex gap-2 overflow-x-auto pb-2">
                     {(showMessReport ? messPhotos : reportPhotos).map((url, i) => (
                        <img key={i} src={url} className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                     ))}
                     <button onClick={() => (showMessReport ? messCameraRef : reportCameraRef).current?.click()} className="w-16 h-16 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                     </button>
                  </div>
                  <input type="file" ref={showMessReport ? messCameraRef : reportCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, showMessReport ? 'mess' : 'report')} />

                  <div className="flex gap-3 pt-4">
                     <button onClick={() => { setShowMessReport(false); setReportModalType(null); }} className="flex-1 py-4 bg-gray-100 text-black/40 font-black uppercase rounded-2xl text-[9px] tracking-widest">Cancel</button>
                     <button onClick={showMessReport ? handleSubmitMessReport : handleReportSubmit} className="flex-[2] py-4 bg-black text-white font-black uppercase rounded-2xl text-[9px] tracking-widest shadow-xl">Submit Report</button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  // --- REVIEW & CLOCK OUT (Keys) ---
  if (currentStep === 'review') {
    return (
      <div className="pb-40 px-4 pt-10 max-w-2xl mx-auto text-left space-y-10 animate-in fade-in duration-500">
         <div className="space-y-2">
            <h2 className="text-2xl font-serif-brand font-bold text-black uppercase">Shift Handover</h2>
            <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Mandatory Security Protocol</p>
         </div>

         <div className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] space-y-8 shadow-xl">
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">1. Key in Box Evidence</p>
                  {keyInBoxPhotos.length > 0 && <span className="text-green-600 text-[10px] font-bold">✓ DONE</span>}
               </div>
               <div className="flex gap-3 overflow-x-auto pb-2">
                  {keyInBoxPhotos.map((p, i) => <img key={i} src={p.url} className="w-20 h-20 rounded-xl object-cover border border-[#D4B476]/20" />)}
                  <button onClick={() => { setCheckoutTarget('keyInBox'); checkoutKeyRef.current?.click(); }} className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-[#D4B476]/40 flex items-center justify-center text-[#C5A059] hover:bg-[#C5A059]/10 transition-all">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </button>
               </div>
            </div>

            <div className="h-px bg-[#D4B476]/20 w-full"></div>

            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">2. Box Closed & Scrambled</p>
                  {boxClosedPhotos.length > 0 && <span className="text-green-600 text-[10px] font-bold">✓ DONE</span>}
               </div>
               <div className="flex gap-3 overflow-x-auto pb-2">
                  {boxClosedPhotos.map((p, i) => <img key={i} src={p.url} className="w-20 h-20 rounded-xl object-cover border border-[#D4B476]/20" />)}
                  <button onClick={() => { setCheckoutTarget('boxClosed'); checkoutKeyRef.current?.click(); }} className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-[#D4B476]/40 flex items-center justify-center text-[#C5A059] hover:bg-[#C5A059]/10 transition-all">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </button>
               </div>
            </div>
            
            <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
         </div>

         <div className="flex gap-4">
            <button onClick={() => setCurrentStep('active')} className="flex-1 py-5 bg-gray-100 text-black/40 font-black rounded-2xl uppercase text-[9px] tracking-widest">Back</button>
            <button onClick={handleFinishShift} className="flex-[2] py-5 bg-black text-[#C5A059] font-black rounded-2xl uppercase text-[10px] tracking-[0.4em] shadow-xl active:scale-95 transition-all">CLOCK OUT</button>
         </div>
      </div>
    );
  }

  // --- INSPECTION / AUDIT MODE ---
  if (currentStep === 'inspection' && activeShift) {
     return (
        <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in text-left">
           <header className="space-y-2">
              <h2 className="text-2xl font-serif-brand font-bold text-black uppercase">Quality Audit</h2>
              <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Supervisor Inspection Mode</p>
           </header>

           <div className="bg-white border border-gray-200 p-6 rounded-[32px] space-y-6 shadow-xl">
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-black/40 uppercase tracking-widest">Original Cleaner Evidence</h4>
                 <div className="grid grid-cols-3 gap-2">
                    {activeShift.tasks?.flatMap(t => t.photos).map((p, i) => (
                       <img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-full h-24 object-cover rounded-xl border border-gray-100 cursor-zoom-in" />
                    ))}
                    {(!activeShift.tasks?.some(t => t.photos.length > 0)) && <p className="text-xs text-gray-400 italic col-span-3">No photos provided.</p>}
                 </div>
              </div>

              <div className="h-px bg-gray-100 w-full"></div>

              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-black/40 uppercase tracking-widest">Audit Findings (Optional)</h4>
                 <textarea 
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-[#C5A059] h-24"
                    placeholder="Enter notes if work is rejected..."
                    value={messDescription} // Re-using mess state for simplicity in audit notes
                    onChange={e => setMessDescription(e.target.value)}
                 />
              </div>

              <div className="flex gap-4">
                 <button onClick={handleForceFinish} className="flex-1 bg-green-600 text-white font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest shadow-lg">APPROVE & CLOSE</button>
                 <button onClick={handleForceFinish} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[9px] tracking-widest shadow-lg">REJECT & FLAG</button>
              </div>
           </div>
        </div>
     );
  }

  return <div className="p-20 text-center opacity-20 font-black uppercase tracking-widest">Loading Portal...</div>;
};

export default CleanerPortal;