
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Property, CleaningTask, Shift, User, AttributedPhoto, SpecialReport, SupplyItem } from '../types';
import { uploadFile } from '../services/storageService';

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
  onAddSupplyRequest?: (items: Record<string, number>) => void;
}

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

  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionPhotos, setInspectionPhotos] = useState<string[]>([]);

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
  const inspectionCameraRef = useRef<HTMLInputElement>(null);
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
        const getStatusWeight = (s: Shift) => {
          if (s.status === 'active') return 0;
          if (s.status === 'pending') return 1;
          if (s.status === 'completed' && s.approvalStatus === 'pending') return 2;
          return 3;
        };
        const weightA = getStatusWeight(a);
        const weightB = getStatusWeight(b);
        if (weightA !== weightB) return weightA - weightB;
        return parseTimeValue(a.startTime) - parseTimeValue(b.startTime);
      });
  }, [shifts, currentUser.id, isManagement, viewedDateStr]);

  const linkedCleanerShift = useMemo(() => {
    if (!activeShift) return null;
    if (activeShift.serviceType === 'TO CHECK APARTMENT') {
        return shifts
          .filter(s => s.propertyId === activeShift.propertyId && s.serviceType !== 'TO CHECK APARTMENT' && s.status === 'completed')
          .sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0))[0];
    }
    if (activeShift.status === 'completed' && activeShift.approvalStatus === 'pending') {
        return activeShift;
    }
    return null;
  }, [activeShift, shifts]);

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
    if (isManagement) return;

    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ 
      ...s, 
      status: 'completed', 
      actualEndTime: Date.now(), 
      approvalStatus: 'rejected',
      wasRejected: true,
      approvalComment: 'AUTOMATIC REJECTION: GEOFENCE BREACH DETECTED >50M FROM PROPERTY.',
      tasks: tasks 
    } as Shift) : s));

    localStorage.removeItem(`shared_protocol_v8_${selectedShiftId}`);
    localStorage.removeItem(`shared_special_reqs_v1_${selectedShiftId}`);
    localStorage.removeItem(`shared_checkout_keys_v1_${selectedShiftId}`);
    
    setSelectedShiftId(null);
    setCurrentStep('list');
    showNotification("⚠️ SECURITY ALERT: You left the property perimeter. Shift terminated.", 'error');
  }, [selectedShiftId, setShifts, tasks, isManagement]);

  useEffect(() => {
    let watchId: number | null = null;
    if (currentStep === 'active' && activeProperty?.lat && activeProperty?.lng && !isManagement) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const distance = calculateDistance(
            activeProperty.lat!, 
            activeProperty.lng!, 
            position.coords.latitude, 
            position.coords.longitude
          );
          if (distance > 0.05) {
            console.warn(`Geofence Breach: ${distance.toFixed(4)}km`);
            handleForceClockOut();
          }
        },
        (error) => console.warn("Geolocation watch error:", error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
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
    setIsVerifying(true);
    if (!navigator.geolocation) {
      showNotification("GPS not supported on this device.", 'error');
      setIsVerifying(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        if (activeProperty?.lat && activeProperty?.lng) {
          const distance = calculateDistance(activeProperty.lat, activeProperty.lng, userLat, userLng);
          if (distance < 0.3) {
             setIsLocationVerified(true);
             setIsVerifying(false);
             showNotification("Location Verified. Access Granted.", 'success');
          } else {
             showNotification(`GPS ERROR: You are ${Math.round(distance * 1000)}m away. Move closer to unlock codes.`, 'error');
             setIsVerifying(false);
          }
        } else {
          setIsLocationVerified(true);
          setIsVerifying(false);
        }
      },
      (error) => {
        showNotification("GPS Error: Please enable location services.", 'error');
        setIsVerifying(false);
      },
      { enableHighAccuracy: true }
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

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, target: 'task' | 'inspection' | 'mess' | 'report' | 'checkout') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser.id || isProcessingPhoto) return;
    setIsProcessingPhoto(true);
    try {
      const url = await uploadFile(file);
      if (url) {
        const attributed: AttributedPhoto = { url: url, userId: currentUser.id };
        if (target === 'inspection') setInspectionPhotos(prev => [...prev, url]);
        else if (target === 'mess') setMessPhotos(prev => [...prev, url]);
        else if (target === 'report') setReportPhotos(prev => [...prev, url]);
        else if (target === 'checkout') {
            if (checkoutTarget === 'keyInBox') setKeyInBoxPhotos(prev => [...prev, attributed]);
            else if (checkoutTarget === 'boxClosed') setBoxClosedPhotos(prev => [...prev, attributed]);
        }
        else if (target === 'task') {
          setTasks(prevTasks => {
            const tId = activeTaskId || prevTasks[0].id;
            return prevTasks.map(t => t.id === tId ? { ...t, photos: [...t.photos, attributed] } : t);
          });
        }
      }
    } catch (error) {
      console.error("Failed to process photo:", error);
      showNotification("Photo upload failed. Please try again.", 'error');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
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

  const handleAdminDirectDecision = (decision: 'approved' | 'rejected' | 'remedial') => {
    if (!selectedShiftId) return;
    if (!inspectionNotes.trim() && inspectionPhotos.length === 0 && decision !== 'approved') {
      showNotification("DECISION BLOCKED: Please provide rejection notes or evidence photos.", 'error');
      return;
    }
    const finalApprovalStatus = decision === 'approved' ? 'approved' : 'rejected';
    setShifts((prev: Shift[]): Shift[] => {
        let next = prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'completed' as const, actualEndTime: Date.now(), approvalStatus: 'approved' as const, approvalComment: inspectionNotes, inspectionPhotos: inspectionPhotos, decidedBy: currentUser.name, userIds: s.serviceType === 'TO CHECK APARTMENT' ? [currentUser.id] : s.userIds } as Shift) : s);
        if (linkedCleanerShift) {
            next = next.map(s => s.id === linkedCleanerShift.id ? ({ ...s, approvalStatus: finalApprovalStatus as 'approved' | 'rejected', wasRejected: finalApprovalStatus === 'rejected', approvalComment: inspectionNotes, inspectionPhotos: inspectionPhotos, decidedBy: currentUser.name } as Shift) : s);
        }
        return next;
    });
    setInspectionNotes(''); setInspectionPhotos([]);
    if (onClosePortal) onClosePortal();
    else { setCurrentStep('list'); setSelectedShiftId(null); }
  };

  const handleSupervisorReport = () => {
    if (!selectedShiftId) return;
    if (!inspectionNotes.trim() && inspectionPhotos.length === 0) {
      showNotification("SUBMISSION BLOCKED: Verification notes or photos are required.", 'error');
      return;
    }
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({ ...s, status: 'completed' as const, actualEndTime: Date.now(), approvalStatus: 'pending' as const, approvalComment: inspectionNotes, inspectionPhotos: inspectionPhotos, decidedBy: currentUser.name, userIds: s.serviceType === 'TO CHECK APARTMENT' ? [currentUser.id] : s.userIds } as Shift) : s));
    if (linkedCleanerShift) {
        setShifts(prev => prev.map(s => s.id === linkedCleanerShift.id ? ({ ...s, approvalComment: inspectionNotes, inspectionPhotos: inspectionPhotos, decidedBy: currentUser.name } as Shift) : s));
    }
    setInspectionNotes(''); setInspectionPhotos([]);
    if (isManagement && onClosePortal) onClosePortal();
    else { setCurrentStep('list'); setSelectedShiftId(null); }
  };

  const handleSubmitMessReport = () => {
    if (!messDescription.trim()) { showNotification("REPORT INCOMPLETE: Please describe the mess condition.", 'error'); return; }
    if (messPhotos.length < 1) { showNotification("EVIDENCE REQUIRED: At least 1 photo of the mess is mandatory.", 'error'); return; }
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? ({
      ...s,
      messReport: { description: messDescription, photos: messPhotos, status: 'pending' }
    } as Shift) : s));
    setShowMessReport(false);
    setMessDescription('');
    setMessPhotos([]);
  };

  const handleReportSubmit = () => {
    if (!reportDescription.trim()) { showNotification("DETAILS MISSING: Please describe the issue.", 'error'); return; }
    if ((reportModalType === 'maintenance' || reportModalType === 'damage') && reportPhotos.length === 0) {
       showNotification(`EVIDENCE REQUIRED: Photos are mandatory for ${reportModalType} reports.`, 'error');
       return;
    }
    const field = reportModalType === 'maintenance' ? 'maintenanceReports' : reportModalType === 'damage' ? 'damageReports' : 'missingReports';
    let finalDescription = reportDescription;
    if (reportModalType === 'missing') {
        const categoryLabel = missingCategory === 'laundry' ? '[FOR LAUNDRY]' : '[FROM APARTMENT]';
        finalDescription = `${categoryLabel} ${reportDescription}`;
    }
    const report: SpecialReport = { 
        id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: finalDescription, 
        photos: reportPhotos, 
        timestamp: Date.now(),
        status: 'open',
        category: reportModalType === 'missing' ? missingCategory : undefined
    };
    setShifts(prev => prev.map(s => {
      if (s.id === selectedShiftId) {
        const currentReports = s[field] || [];
        return { ...s, [field]: [...currentReports, report] };
      }
      return s;
    }));
    setReportModalType(null);
    setReportDescription('');
    setReportPhotos([]);
    showNotification(`${reportModalType?.toUpperCase()} REPORT LOGGED`, 'success');
  };

  const handleUpdateSupplyQty = (id: string, delta: number) => {
    setSelectedSupplyItems(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleSubmitSupplyRequest = () => {
    if (Object.values(selectedSupplyItems).every(v => v === 0)) return;
    if (onAddSupplyRequest) {
        onAddSupplyRequest(selectedSupplyItems);
        showNotification('Request sent to logistics', 'success');
    }
    setShowSupplyModal(false);
    setSelectedSupplyItems({});
  };

  // ... (RENDER - same structure, using new activeQueue) ...
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
            <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px] leading-none mb-2">Deployments Terminal</p>
            <h1 className="text-2xl md:text-3xl font-serif-brand font-bold text-black uppercase tracking-tight leading-none">Your Schedule</h1>
          </div>
          <div className="bg-white border border-gray-100 p-2 rounded-[28px] shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar custom-scrollbar">
            {weekDays.map((wd) => (
              <button key={wd.iso} onClick={() => setViewedDateISO(wd.iso)} className={`flex flex-col items-center min-w-[55px] py-3 rounded-2xl border transition-all ${viewedDateISO === wd.iso ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-[#C5A059]/40'}`}>
                <span className={`text-[7px] font-black uppercase mb-1 ${viewedDateISO === wd.iso ? 'text-white/80' : 'text-gray-300'}`}>{wd.dayName}</span>
                <span className={`text-sm font-bold ${viewedDateISO === wd.iso ? 'text-white' : 'text-gray-600'}`}>{wd.dateNum}</span>
              </button>
            ))}
          </div>
        </header>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2 mb-2">
            <p className="text-[9px] font-black text-black/20 uppercase tracking-[0.4em]">{viewedDateStr}</p>
            <div className="h-px flex-1 bg-gray-50"></div>
          </div>
          {activeQueue.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-gray-50 rounded-[32px] opacity-10 italic text-[10px] uppercase font-bold tracking-[0.4em]">No shifts listed for this date.</div>
          ) : (
            activeQueue.map(s => {
              const isThisShiftActive = s.status === 'active';
              const isCompleted = s.status === 'completed';
              const isApproved = s.approvalStatus === 'approved';
              const isRejected = s.approvalStatus === 'rejected';
              const isToFix = s.serviceType === 'TO FIX';
              const canEnter = (!isCompleted && (!currentlyActiveShift || currentlyActiveShift.id === s.id)) || (isManagement && s.approvalStatus === 'pending');
              return (
                <button key={s.id} onClick={() => canEnter && setSelectedIdAndStart(s)} disabled={!canEnter} className={`p-6 bg-white border rounded-3xl text-left transition-all shadow-md group flex justify-between items-center ${!canEnter ? 'opacity-60 cursor-not-allowed border-gray-100 shadow-none' : 'border-gray-100 hover:border-[#C5A059]'} ${isThisShiftActive ? 'border-2 border-[#C5A059] ring-4 ring-[#C5A059]/10' : ''} ${isToFix && canEnter ? 'border-orange-200 bg-orange-50' : ''}`}>
                  <div className="space-y-2 flex-1 min-w-0">
                     <div className="flex items-center gap-3">
                        <h3 className={`text-base font-serif-brand font-bold uppercase truncate pr-4 leading-tight ${isCompleted && isApproved ? 'text-black/40' : 'text-black'}`}>{s.propertyName}</h3>
                        {isThisShiftActive && <span className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-pulse shadow-[0_0_8px_rgba(197,160,89,1)]"></span>}
                     </div>
                     <div className="flex flex-col gap-1.5">
                       <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isCompleted && isApproved ? 'text-black/30' : 'text-[#C5A059]'}`}>{s.startTime} • {s.serviceType}</p>
                       <div className="flex flex-col gap-1.5 pt-1">
                         {isToFix && <span className="w-fit text-[7px] bg-orange-600 text-white px-2.5 py-1 rounded font-black uppercase shadow-sm">REMEDIAL ACTION REQ.</span>}
                         {isThisShiftActive && <span className="w-fit text-[7px] bg-[#C5A059] text-black px-2.5 py-1 rounded font-black uppercase shadow-sm border border-[#C5A059]/30">ACTIVE</span>}
                         {isApproved && <span className="w-fit text-[7px] text-green-600 font-black uppercase tracking-widest">QUALITY APPROVED</span>}
                         {isRejected && (
                           <div className="space-y-1.5">
                             <span className="w-fit text-[7px] bg-red-600 text-white px-2.5 py-1 rounded font-black uppercase shadow-lg border border-red-700">REJECTED</span>
                             {s.approvalComment && <p className="text-[10px] text-red-600 italic font-medium leading-relaxed max-w-[90%] pr-4">Reason: "{s.approvalComment}"</p>}
                           </div>
                         )}
                         {currentlyActiveShift && currentlyActiveShift.id !== s.id && !isCompleted && (
                            <div className="flex items-center gap-2 opacity-40">
                               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                               <span className="text-[7px] font-bold text-black uppercase italic">Clock out {currentlyActiveShift.propertyName} first</span>
                            </div>
                         )}
                       </div>
                     </div>
                  </div>
                  {!canEnter ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 group-hover:text-[#C5A059] transition-colors shrink-0"><polyline points="9 18 15 12 9 6"/></svg>}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // OVERVIEW
  if (currentStep === 'overview' && activeShift && activeProperty) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeProperty.address)}`;
      return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto text-left px-2 relative">
            <button onClick={() => setCurrentStep('list')} className="text-[10px] font-black text-black/30 hover:text-black uppercase tracking-widest flex items-center gap-2 mb-4 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg> Back to List
            </button>
            <header className="space-y-4">
                <div onClick={() => setZoomedImage(activeProperty.entrancePhoto || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80')} className="relative h-64 w-full rounded-[40px] overflow-hidden shadow-2xl border border-gray-100 cursor-zoom-in group">
                    <img src={activeProperty.entrancePhoto || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80'} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="Entrance reference" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-8 left-8 right-8 text-left">
                        <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.4em] mb-2">Entrance Reference Photo</p>
                        <h2 className="text-2xl font-serif-brand font-bold text-white uppercase leading-tight">{activeProperty.name}</h2>
                    </div>
                </div>
            </header>
            <section className="space-y-6">
                <div className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-left space-y-1">
                        <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Site Telemetry</p>
                        <h4 className="text-sm font-bold text-black uppercase">Property Identification</h4>
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-black/60 uppercase font-black">{activeProperty.address}</p>
                            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#C5A059] font-black uppercase tracking-widest flex items-center gap-2 hover:underline">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Open in Google Maps
                            </a>
                        </div>
                    </div>
                    {!isLocationVerified ? (
                        <button onClick={verifyLocation} disabled={isVerifying} className="w-full md:w-auto bg-[#C5A059] text-black font-black px-10 py-5 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                            {isVerifying ? <><span className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>VERIFYING...</> : 'VERIFY LOCATION'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 bg-green-50 text-green-600 px-6 py-3 rounded-2xl border border-green-200">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            <span className="text-[9px] font-black uppercase tracking-widest">POSITION VERIFIED</span>
                        </div>
                    )}
                </div>
                {isLocationVerified && (
                    <div className="animate-in slide-in-from-top-4 duration-700 space-y-4">
                        {activeProperty.keyboxPhoto && (
                            <div onClick={() => setZoomedImage(activeProperty.keyboxPhoto!)} className="relative h-56 w-full rounded-[40px] overflow-hidden shadow-xl border border-gray-100 mb-2 cursor-zoom-in group">
                                <img src={activeProperty.keyboxPhoto} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="Keybox reference" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                                <div className="absolute bottom-6 left-8 text-left">
                                    <p className="text-[8px] font-black text-white/80 uppercase tracking-[0.4em] mb-1">Access Protocol Evidence</p>
                                    <h2 className="text-lg font-bold text-white uppercase tracking-tight">Keybox Location Reference</h2>
                                </div>
                            </div>
                        )}
                        <div className="bg-[#FDF8EE] p-8 rounded-[40px] border border-[#D4B476]/30 space-y-8 shadow-xl">
                            <div className="grid grid-cols-2 gap-8 text-left">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">Entrance Code</p>
                                    <p className="text-xl font-bold text-black font-mono tracking-tighter">{activeProperty.mainEntranceCode || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">Apt / Keybox Code</p>
                                    <p className="text-xl font-bold text-black font-mono tracking-tighter">{activeProperty.keyboxCode}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8 border-t border-black/5 pt-6 text-left">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">Unit Floor</p>
                                    <p className="text-sm font-bold text-black uppercase tracking-widest">{activeProperty.floor || 'Level 0'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest">Apartment No.</p>
                                    <p className="text-sm font-bold text-black uppercase tracking-widest">{activeProperty.apartmentNumber || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="border-t border-black/5 pt-6 text-left">
                                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-widest mb-2">Internal Access Protocols (Added by Management)</p>
                                <p className="text-xs text-black/60 italic leading-relaxed">"{activeProperty.accessNotes}"</p>
                            </div>
                        </div>
                        <div className="flex justify-center pt-2">
                            <button onClick={handleStartShift} className="bg-[#C5A059] text-black font-black py-4 px-12 rounded-2xl uppercase tracking-[0.4em] text-[11px] shadow-xl active:scale-95 transition-all mt-4">CLOCK IN</button>
                        </div>
                    </div>
                )}
            </section>
            {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
        </div>
      );
  }

  // ACTIVE STEP
  if (currentStep === 'active' && activeShift) {
      return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto text-left px-2 relative">
            {notification && (
                <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[1000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[90vw] animate-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                    <p className="text-xs font-bold leading-tight">{notification.message}</p>
                </div>
            )}
            <header className="flex flex-col gap-4 bg-[#C5A059] p-8 rounded-[40px] text-black shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1 opacity-60">Deployment Active</p>
                        <h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight">{activeShift.propertyName}</h3>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-2xl font-bold font-mono tracking-tighter">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
                        <p className="text-[7px] font-black uppercase tracking-widest opacity-60">Clocked In</p>
                        {activeShift.messReport ? (
                            <div className={`mt-2 text-[7px] font-black py-1.5 px-3 rounded-lg uppercase tracking-[0.2em] border ${activeShift.messReport.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white/50 border-white/20'}`}>
                                {activeShift.messReport.status === 'approved' ? 'EXTRA TIME APPROVED' : 'EXTRA REQUEST PENDING'}
                            </div>
                        ) : (
                            <button onClick={() => setShowMessReport(true)} className="mt-2 bg-[#FDF8EE] text-red-600 text-[7px] font-black py-1.5 px-3 rounded-lg uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform">Request Extra Time</button>
                        )}
                    </div>
                </div>
            </header>
            
            {activeShift.notes && (
                <section className="bg-white border border-[#D4B476]/30 p-6 rounded-[32px] shadow-sm">
                    <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-2 px-1">Scheduling Intelligence & Notes</p>
                    <div className="bg-[#FDF8EE]/50 p-5 rounded-2xl border border-[#D4B476]/10">
                        <p className="text-[11px] text-black/80 font-medium leading-relaxed italic">"{activeShift.notes}"</p>
                    </div>
                </section>
            )}

            {activeShift.serviceType === 'TO FIX' ? (
                <div className="space-y-8">
                    <section className="bg-orange-50 border border-orange-200 rounded-[32px] p-8 space-y-6 shadow-sm">
                        <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600">Remedial Fix Requirements</p></div>
                        <div className="bg-white p-6 rounded-2xl border border-orange-100 italic font-serif-brand text-black/70 text-sm leading-relaxed">"{activeShift.approvalComment || 'Address reported deficiencies in evidence photos.'}"</div>
                        {activeShift.inspectionPhotos && activeShift.inspectionPhotos.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                                {activeShift.inspectionPhotos.map((url, i) => (<img key={i} src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border-2 border-white shadow-md cursor-zoom-in" alt="Inspection Proof" />))}
                            </div>
                        )}
                    </section>
                    <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm space-y-6">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-black/30">Action Confirmation</p>
                        <button onClick={() => { setActiveTaskId('remedial-proof'); cameraInputRef.current?.click(); }} disabled={isProcessingPhoto} className={`w-full border border-gray-200 rounded-2xl py-8 flex flex-col items-center justify-center gap-3 transition-all shadow-inner ${isProcessingPhoto ? 'bg-gray-100 opacity-50' : 'bg-gray-50 text-[#8B6B2E] hover:bg-white'}`}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">{isProcessingPhoto ? 'PROCESSING...' : 'Attach Proof of Correction'}</span>
                        </button>
                        {tasks.length > 0 && tasks[0].photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {tasks[0].photos.map((p, i) => (<img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-20 h-20 rounded-xl object-cover border border-white shadow-md cursor-zoom-in" alt="Correction proof" />))}
                            </div>
                        )}
                        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />
                    </section>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em] px-1">Deployment Checklist</p>
                    {tasks.map(task => (
                        <div key={task.id} className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-md space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <p className="text-[11px] font-bold text-black uppercase tracking-tight">{task.label}</p>
                                    {task.isMandatory && <p className="text-[7px] text-red-600 font-black uppercase tracking-widest mt-1 animate-pulse">Photo from camera mandatory</p>}
                                </div>
                                <button onClick={() => { setActiveTaskId(task.id); cameraInputRef.current?.click(); }} disabled={isProcessingPhoto} className={`p-3 rounded-xl border transition-all ${task.photos.length >= task.minPhotos ? 'bg-green-50 border-green-500/20 text-green-600' : 'bg-gray-50 border border-gray-200 text-black/40 hover:border-[#C5A059]'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
                            </div>
                            {task.photos.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {task.photos.map((p, i) => (<img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shadow-sm cursor-zoom-in" alt="Task Proof" />))}
                                </div>
                            )}
                        </div>
                    ))}
                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'task')} />
                </div>
            )}

            {/* Field Reports & Requests Grid */}
            <div className="space-y-4 pt-4">
               <p className="text-[8px] font-black text-black/30 uppercase tracking-[0.4em] px-1">Operational Actions</p>
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setReportModalType('maintenance')} className="bg-blue-50 border border-blue-100 text-blue-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-blue-100">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                     <span className="text-[9px] font-black uppercase tracking-widest">Maintenance</span>
                  </button>
                  <button onClick={() => setReportModalType('damage')} className="bg-orange-50 border border-orange-100 text-orange-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-orange-100">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                     <span className="text-[9px] font-black uppercase tracking-widest">Damage</span>
                  </button>
                  <button onClick={() => setReportModalType('missing')} className="bg-purple-50 border border-purple-100 text-purple-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-purple-100">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                     <span className="text-[9px] font-black uppercase tracking-widest">Missing Item</span>
                  </button>
                  <button onClick={() => setShowSupplyModal(true)} className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-green-100">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                     <span className="text-[9px] font-black uppercase tracking-widest">Request Supplies</span>
                  </button>
               </div>
            </div>

            <button onClick={handleProceedToClockOut} className="w-full bg-black text-[#C5A059] font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-sm shadow-xl active:scale-95 transition-all mt-10">Proceed to Clock Out</button>
            
            {/* Report Mess Modal */}
            {showMessReport && (
                <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white border border-red-100 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
                        <button onClick={() => setShowMessReport(false)} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <header className="space-y-1"><h2 className="text-2xl font-serif-brand font-bold text-red-600 uppercase tracking-tight">Report Mess</h2><p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Mandatory Evidence for Extra Time Request</p></header>
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 block px-1">Describe the condition</label><textarea className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-[11px] h-32 outline-none focus:border-[#C5A059] italic" placeholder="E.G. Excessive trash in kitchen, stained carpets, furniture moved..." value={messDescription} onChange={e => setMessDescription(e.target.value)} /></div>
                            <div className="space-y-4">
                                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 block px-1">Capture Evidence (Camera Only)</p>
                                <button onClick={() => messCameraRef.current?.click()} disabled={isProcessingPhoto} className={`w-full h-32 rounded-3xl border-2 border-dashed border-[#D4B476]/30 bg-[#FDF8EE] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#C5A059] transition-all overflow-hidden ${isProcessingPhoto ? 'opacity-50' : ''}`}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">{isProcessingPhoto ? 'PROCESSING...' : 'CAPTURE MESS'}</span></button>
                                <input type="file" ref={messCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'mess')} />
                                {messPhotos.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{messPhotos.map((url, i) => (<img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-20 h-20 rounded-xl object-cover border border-red-100 shadow-sm cursor-zoom-in" alt="Mess Evidence" />))}</div>)}
                            </div>
                            <div className="flex gap-3 pt-4"><button onClick={handleSubmitMessReport} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all">REPORT</button><button onClick={() => setShowMessReport(false)} className="px-8 border border-gray-100 text-black/40 font-black py-4 rounded-2xl uppercase tracking-widest text-[9px]">CANCEL</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Report Modal (Maintenance / Damage / Missing) */}
            {reportModalType && (
                <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white border border-[#D4B476]/30 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
                        <button onClick={() => { setReportModalType(null); setReportPhotos([]); setReportDescription(''); }} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <header className="space-y-1">
                           <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">Report {reportModalType}</h2>
                           <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Field Incident Logging</p>
                        </header>
                        <div className="space-y-6">
                            {reportModalType === 'missing' && (
                                <div className="flex gap-4 p-1 bg-gray-50 rounded-xl">
                                   <button onClick={() => setMissingCategory('apartment')} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${missingCategory === 'apartment' ? 'bg-[#C5A059] text-black shadow-md' : 'text-black/40 hover:bg-gray-100'}`}>From Apartment</button>
                                   <button onClick={() => setMissingCategory('laundry')} className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${missingCategory === 'laundry' ? 'bg-[#C5A059] text-black shadow-md' : 'text-black/40 hover:bg-gray-100'}`}>For Laundry</button>
                                </div>
                            )}
                            <div className="space-y-2"><label className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 block px-1">Description</label><textarea className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-[11px] h-32 outline-none focus:border-[#C5A059] italic" placeholder="Provide details..." value={reportDescription} onChange={e => setReportDescription(e.target.value)} /></div>
                            <div className="space-y-4">
                                <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em] mb-1.5 block px-1">Evidence Photo {(reportModalType === 'damage' || reportModalType === 'maintenance') && '(Mandatory)'}</p>
                                <button onClick={() => reportCameraRef.current?.click()} disabled={isProcessingPhoto} className={`w-full h-24 rounded-3xl border-2 border-dashed border-[#D4B476]/30 bg-[#FDF8EE] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#C5A059] transition-all overflow-hidden ${isProcessingPhoto ? 'opacity-50' : ''}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">{isProcessingPhoto ? '...' : 'ADD PHOTO'}</span></button>
                                <input type="file" ref={reportCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'report')} />
                                {reportPhotos.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{reportPhotos.map((url, i) => (<img key={i} src={url} onClick={() => setZoomedImage(url)} className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm cursor-zoom-in" alt="Evidence" />))}</div>)}
                            </div>
                            <button onClick={handleReportSubmit} className="w-full bg-black text-[#C5A059] font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all">SUBMIT REPORT</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Supply Request Modal */}
            {showSupplyModal && (
                <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white border border-[#D4B476]/30 rounded-[48px] w-full max-w-lg p-8 md:p-12 space-y-8 shadow-2xl relative text-left my-auto animate-in zoom-in-95">
                        <button onClick={() => setShowSupplyModal(false)} className="absolute top-8 right-8 text-black/20 hover:text-black"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <header className="space-y-1">
                           <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">Request Supplies</h2>
                           <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Select items needed for next shift</p>
                        </header>
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                           {inventoryItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                 <div className="flex items-center gap-3">
                                    <img src={item.photo} className="w-10 h-10 rounded-lg object-cover" alt={item.name} />
                                    <div>
                                       <p className="text-[10px] font-bold text-black uppercase">{item.name}</p>
                                       <p className="text-[7px] font-black text-black/40 uppercase tracking-widest">{item.unit}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <button onClick={() => handleUpdateSupplyQty(item.id, -1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-black">-</button>
                                    <span className="w-4 text-center text-xs font-bold">{selectedSupplyItems[item.id] || 0}</span>
                                    <button onClick={() => handleUpdateSupplyQty(item.id, 1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-black">+</button>
                                 </div>
                              </div>
                           ))}
                        </div>
                        <button onClick={handleSubmitSupplyRequest} className="w-full bg-black text-[#C5A059] font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-xl active:scale-95 transition-all">SEND REQUEST</button>
                    </div>
                </div>
            )}

            {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
        </div>
      );
  }

  // REVIEW & INSPECTION STEPS
  if ((currentStep === 'review' || currentStep === 'inspection') && activeShift) {
    // ... same as provided in previous full code block for brevity ...
    // Just ensuring we use the same structure
    const totalPhotos = tasks.reduce((sum, t) => sum + t.photos.length, 0);
    const keyInBoxDone = keyInBoxPhotos.length >= 1;
    const boxClosedDone = boxClosedPhotos.length >= 1;
    const cleanerName = linkedCleanerShift?.userIds?.[0] ? users.find(u => u.id === linkedCleanerShift.userIds[0])?.name : 'Personnel';
    const cleanerPhotos: string[] = [];
    linkedCleanerShift?.tasks?.forEach(t => t.photos.forEach(p => cleanerPhotos.push(p.url)));

    if (currentStep === 'inspection') {
        return (
          <div className="space-y-10 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto text-left px-2 relative">
            {/* Same Inspection UI */}
            <button onClick={() => isManagement && onClosePortal ? onClosePortal() : setCurrentStep('list')} className="text-[10px] font-black text-black/30 hover:text-black uppercase tracking-widest flex items-center gap-2 mb-4"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>Abort Verification</button>
            <header className="flex justify-between items-center bg-[#C5A059] p-6 rounded-[32px] text-black shadow-2xl"><div><p className="text-[8px] font-black text-black/60 uppercase tracking-[0.4em] mb-1">Unit Verification Terminal</p><h3 className="text-xl font-serif-brand font-bold uppercase tracking-tight">{activeProperty?.name}</h3></div><div className="text-right"><p className="text-xl font-bold font-mono text-black">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p><p className="text-[7px] font-black uppercase tracking-widest text-black/40">Audit Timer</p></div></header>
            <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-md space-y-6"><div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-widest text-black/40">Evidence provided by staff</h4><span className="text-[8px] font-black uppercase bg-[#FDF8EE] text-[#8B6B2E] px-2 py-1 rounded border border-[#D4B476]/20">By: {cleanerName}</span></div><div className="grid grid-cols-4 gap-3">{cleanerPhotos.length > 0 ? cleanerPhotos.map((url, i) => (<img key={i} src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border border-gray-100 shadow-sm cursor-zoom-in hover:scale-105 transition-all" alt="Cleaner Proof" />)) : (<div className="col-span-4 py-8 text-center text-[10px] uppercase font-black opacity-10 italic">No proof photos found from cleaner.</div>)}</div></section>
            <section className="bg-gray-50 border border-gray-200 rounded-[40px] p-8 space-y-8 shadow-inner">
                <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A68342]">Administrative Verification</p>
                    <div className="grid grid-cols-4 gap-4">
                        {inspectionPhotos.map((url, i) => (<div key={i} className="relative group"><img src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border-2 border-white shadow-md cursor-zoom-in" alt="Admin Evidence" /><button onClick={() => setInspectionPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">×</button></div>))}
                        <button onClick={() => inspectionCameraRef.current?.click()} disabled={isProcessingPhoto} className={`aspect-square rounded-2xl border-2 border-dashed border-[#D4B476]/40 flex flex-col items-center justify-center gap-2 transition-all bg-white ${isProcessingPhoto ? 'opacity-50' : 'text-[#8B6B2E]/40 hover:border-[#8B6B2E] hover:text-[#8B6B2E]'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span className="text-[7px] font-black uppercase tracking-widest">{isProcessingPhoto ? '...' : 'Add Photo'}</span></button>
                    </div>
                    <div className="space-y-2"><label className="text-[8px] font-black uppercase tracking-[0.3em] text-black/40 px-1">Verification Findings & Feedback</label><textarea className="w-full bg-white border border-gray-200 rounded-2xl p-6 text-xs h-32 outline-none focus:border-[#C5A059] italic shadow-sm" placeholder="Detail any defects, missing items, or quality feedback for the staff..." value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} /></div>
                </div>
                <div className="pt-2">
                    {isAdmin ? (
                      <div className="space-y-4">
                         <p className="text-[10px] text-center text-[#8B6B2E] font-black uppercase tracking-[0.4em]">ADMIN DECISION PANEL</p>
                         <div className="grid grid-cols-2 gap-3"><button onClick={() => handleAdminDirectDecision('approved')} className="bg-green-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[9px] shadow-lg hover:bg-green-700 transition-all">APPROVE CLEAN</button><button onClick={() => handleAdminDirectDecision('rejected')} className="bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[9px] shadow-lg hover:bg-red-700 transition-all">REJECT CLEAN</button></div>
                         <button onClick={() => handleAdminDirectDecision('remedial')} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-widest text-[9px] border border-[#C5A059]/20 shadow-xl">REJECT & SCHEDULE FIX</button>
                      </div>
                    ) : (<><button onClick={handleSupervisorReport} className="w-full bg-black text-[#C5A059] font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-xs shadow-xl active:scale-95 hover:bg-zinc-900 transition-all border border-[#C5A059]/20">SUBMIT VERIFICATION TO MANAGEMENT</button><p className="text-[8px] text-center text-black/20 uppercase tracking-widest font-black mt-4 italic">Final decisions are logged for payroll verification.</p></>)}
                </div>
            </section>
            <input type="file" ref={inspectionCameraRef} className="hidden" accept="image/*" onChange={(e) => handleCapture(e, 'inspection')} />
            {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
          </div>
        );
    }

    return (
      <div className="space-y-10 animate-in fade-in duration-700 pb-32 max-w-2xl mx-auto text-left px-2 relative">
        <button onClick={() => setCurrentStep('active')} className="text-[10px] font-black text-black/30 hover:text-black uppercase tracking-widest flex items-center gap-2 mb-4"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>Back to Work</button>
        <header className="space-y-2"><p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[10px]">Submission Core</p><h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">Final Summary</h2></header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm space-y-1"><p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Session Duration</p><p className="text-2xl font-serif-brand font-bold text-black">{Math.floor(timer / 60)}m {timer % 60}s</p></div>
           <div className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm space-y-1"><p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Evidence Count</p><p className="text-2xl font-serif-brand font-bold text-black">{totalPhotos} Photos</p></div>
        </div>
        <section className="bg-[#FDF8EE] border border-[#D4B476]/30 p-8 rounded-[40px] shadow-xl space-y-6">
           <p className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-[0.4em]">Checkout Checklist</p>
           <div className="space-y-4">
              <div className="flex items-center gap-4 group"><div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg></div><span className="text-[11px] font-bold text-black uppercase">All Windows & Terraces Locked</span></div>
              <div className="flex items-center gap-4 group"><div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg></div><span className="text-[11px] font-bold text-black uppercase">Appliances & Lights Switched Off</span></div>
           </div>
        </section>
        <section className="bg-white border border-[#D4B476]/40 p-8 rounded-[40px] shadow-2xl space-y-8 animate-in slide-in-from-bottom-2">
           <div className="space-y-1"><p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Final Key Verification</p><p className="text-[8px] font-bold text-red-600 uppercase tracking-widest italic animate-pulse">Photo from camera mandatory for clock out</p></div>
           <div className="space-y-8">
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[11px] font-bold text-black uppercase">1. Key placed in box</span><span className="text-[7px] text-black/40 uppercase">Open keybox view</span></div><button onClick={() => { setCheckoutTarget('keyInBox'); checkoutKeyRef.current?.click(); }} className={`p-3 rounded-xl border transition-all ${keyInBoxDone ? 'bg-green-50 border-green-500/20 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:border-red-500'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button></div>
                 {keyInBoxPhotos.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{keyInBoxPhotos.map((p, i) => (<img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-20 h-20 rounded-xl object-cover border border-gray-100 shadow-sm cursor-zoom-in" alt="Key in box" />))}</div>)}
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[11px] font-bold text-black uppercase">2. Keybox closed & code at 0000</span><span className="text-[7px] text-black/40 uppercase">Verify secure lock</span></div><button onClick={() => { setCheckoutTarget('boxClosed'); checkoutKeyRef.current?.click(); }} className={`p-3 rounded-xl border transition-all ${boxClosedDone ? 'bg-green-50 border-green-500/20 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:border-red-500'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button></div>
                 {boxClosedPhotos.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{boxClosedPhotos.map((p, i) => (<img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="w-20 h-20 rounded-xl object-cover border border-gray-100 shadow-sm cursor-zoom-in" alt="Keybox closed" />))}</div>)}
              </div>
           </div>
        </section>
        <div className="pt-4 space-y-4">
           <button onClick={handleFinishShift} className={`w-full font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-sm shadow-xl transition-all active:scale-95 ${(keyInBoxDone && boxClosedDone) ? 'bg-[#C5A059] text-black hover:bg-[#D4B476]' : 'bg-gray-100 text-black/20 border border-gray-200 cursor-not-allowed'}`}>CLOCK OUT</button>
           <p className="text-[8px] text-center text-black/20 uppercase font-black tracking-widest leading-relaxed">By clocking out, you certify that all SOPs <br/>have been followed and evidence is true.</p>
        </div>
        <input type="file" ref={checkoutKeyRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleCapture(e, 'checkout')} />
        {zoomedImage && <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" /></div>}
      </div>
    );
  }

  return null;
};

export default CleanerPortal;
