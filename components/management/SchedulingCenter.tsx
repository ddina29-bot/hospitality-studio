
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Shift, Property, User, SpecialReport, AttributedPhoto, AuditReport, LeaveRequest, TabType } from '../../types';
import { SERVICE_TYPES } from '../../constants';

interface SchedulingCenterProps {
  shifts?: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  properties: Property[];
  users: User[];
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  setAuditReports?: React.Dispatch<React.SetStateAction<AuditReport[]>>;
  leaveRequests?: LeaveRequest[];
  initialSelectedShiftId?: string | null;
  onConsumedDeepLink?: () => void;
  setActiveTab?: (tab: TabType) => void;
}

const convertTo12h = (time24h: string) => {
  if (!time24h) return "10:00 AM";
  let [hours, minutes] = time24h.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

const convertTo24h = (time12h: string) => {
  if (!time12h) return "10:00";
  if (!time12h.includes(' ')) return time12h; 
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') {
    const h = parseInt(hours, 10);
    if (h < 12) hours = (h + 12).toString();
  }
  return `${hours.padStart(2, '0')}:${minutes}`;
};

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseShiftDate = (dateStr: string) => {
  if (!dateStr) return toLocalDateString(new Date());
  if (dateStr.includes('-')) return dateStr; // Already ISO
  // Assume "DD MMM" format like "24 OCT"
  const currentYear = new Date().getFullYear();
  const date = new Date(`${dateStr} ${currentYear}`);
  if (isNaN(date.getTime())) return toLocalDateString(new Date());
  return toLocalDateString(date);
};

const parseTimeToMinutes = (time12h: string) => {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) hours = 0;
  if (modifier === 'PM') hours += 12;
  return hours * 60 + minutes;
};

const getShiftAttributedPhotos = (shift: Shift): { url: string }[] => {
  const allPhotos: { url: string }[] = [];
  if (shift.tasks) {
    shift.tasks.forEach(task => {
      task.photos?.forEach(p => allPhotos.push({ url: p.url }));
    });
  }
  if (shift.checkoutPhotos) {
    if (shift.checkoutPhotos.keyInBox) {
      shift.checkoutPhotos.keyInBox.forEach(p => allPhotos.push({ url: p.url }));
    }
    if (shift.checkoutPhotos.boxClosed) {
      shift.checkoutPhotos.boxClosed.forEach(p => allPhotos.push({ url: p.url }));
    }
  }
  if (shift.messReport?.photos) shift.messReport.photos.forEach(url => allPhotos.push({ url }));
  
  if (shift.maintenanceReports) {
    shift.maintenanceReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  }
  if (shift.damageReports) {
    shift.damageReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  }
  if (shift.missingReports) {
    shift.missingReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  }

  if (shift.inspectionPhotos) shift.inspectionPhotos.forEach(url => allPhotos.push({ url }));
  return allPhotos;
};

const CustomTimePicker: React.FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => {
  return (
    <div className="space-y-1">
      <label className="text-[7px] font-black text-[#C5A059] uppercase tracking-[0.3em] opacity-80 mb-0.5 block px-1">{label}</label>
      <input 
        type="time" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all h-9"
      />
    </div>
  );
};

const CustomDatePicker: React.FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? new Date(value) : null;
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const monthName = viewDate.toLocaleString('default', { month: 'short' });
  const year = viewDate.getFullYear();
  const days = useMemo(() => {
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const offset = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
    const arr = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let i = 1; i <= totalDays; i++) arr.push(i);
    return arr;
  }, [viewDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const toIso = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="relative space-y-1" ref={containerRef}>
      <label className="text-[7px] font-black text-[#C5A059] uppercase tracking-[0.3em] opacity-80 mb-0.5 block px-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold tracking-widest flex justify-between items-center cursor-pointer hover:border-[#C5A059] h-9"
      >
        <span>{selectedDate ? formatDate(selectedDate) : 'DATE'}</span>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-100 rounded-lg shadow-2xl z-[500] p-2 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-1.5 px-1">
            <h4 className="text-[#C5A059] font-bold text-[10px] uppercase tracking-tighter">{monthName} {year}</h4>
            <div className="flex gap-0.5">
              <button type="button" onClick={handlePrevMonth} className="p-0.5 hover:bg-gray-50 rounded text-black/40"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button type="button" onClick={handleNextMonth} className="p-0.5 hover:bg-gray-50 rounded text-black/40"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <span key={d} className="text-[6px] font-black text-black/20 uppercase">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center gap-0.5">
            {days.map((day, i) => {
              if (day === null) return <div key={i} />;
              const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === viewDate.getMonth() && selectedDate?.getFullYear() === viewDate.getFullYear();
              return (
                <button 
                  key={i}
                  type="button"
                  onClick={() => { onChange(toIso(day)); setIsOpen(false); }}
                  className={`aspect-square flex items-center justify-center text-[8px] font-bold rounded transition-all ${
                    isSelected ? 'bg-[#C5A059] text-black' : 'text-black/60 hover:bg-gray-50'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ shifts = [], setShifts, properties, users, showToast, setAuditReports, leaveRequests = [], initialSelectedShiftId, onConsumedDeepLink, setActiveTab }) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [reviewShift, setReviewShift] = useState<Shift | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showPersonnelPicker, setShowPersonnelPicker] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  
  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('studio_custom_service_types');
    return saved ? JSON.parse(saved) : SERVICE_TYPES;
  });

  const [isFieldLocked, setIsFieldLocked] = useState(false);
  const [isSupervisorOnlyPicker, setIsSupervisorOnlyPicker] = useState(false);
  const [originalCleanerIds, setOriginalCleanerIds] = useState<string[] | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(window.innerWidth < 768 ? 'list' : 'grid');

  const propertyPickerRef = useRef<HTMLDivElement>(null);
  const personnelPickerRef = useRef<HTMLDivElement>(null);
  const driverPickerRef = useRef<HTMLDivElement>(null);
  const serviceTypePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('studio_custom_service_types', JSON.stringify(availableServiceTypes));
  }, [availableServiceTypes]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setViewMode('list');
      else setViewMode('grid');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (initialSelectedShiftId) {
      const shift = shifts.find(s => s.id === initialSelectedShiftId);
      if (shift) {
        if (shift.approvalStatus === 'rejected') {
            handleRescheduleFix(shift);
        } else {
            setReviewShift(shift);
        }
        if (onConsumedDeepLink) onConsumedDeepLink();
      }
    }
  }, [initialSelectedShiftId]);

  const activeManagedProperties = useMemo(() => properties.filter(p => p.status !== 'disabled'), [properties]);

  const filteredProperties = useMemo(() => {
    if (!propertySearch) return activeManagedProperties;
    return activeManagedProperties.filter(p => p.name.toLowerCase().includes(propertySearch.toLowerCase()) || p.address.toLowerCase().includes(propertySearch.toLowerCase()));
  }, [activeManagedProperties, propertySearch]);

  const filteredServiceTypes = useMemo(() => {
    const query = serviceTypeSearch.toLowerCase();
    return availableServiceTypes.filter(t => t.toLowerCase().includes(query));
  }, [availableServiceTypes, serviceTypeSearch]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  const getEmptyShift = () => ({
    propertyId: '', userIds: [], date: toLocalDateString(new Date()),
    startTime: '10:00', endTime: '14:00', serviceType: SERVICE_TYPES[0], notes: '',
    fixWorkPayment: 0, isPublished: false, inspectionPhotos: [], approvalComment: '',
    excludeLaundry: false
  });

  const [shiftForm, setShiftForm] = useState<Partial<Shift>>(getEmptyShift());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (propertyPickerRef.current && !propertyPickerRef.current.contains(e.target as Node)) {
        setShowPropertyPicker(false);
        setPropertySearch('');
      }
      if (personnelPickerRef.current && !personnelPickerRef.current.contains(e.target as Node)) {
        setShowPersonnelPicker(false);
        setStaffSearch('');
      }
      if (driverPickerRef.current && !driverPickerRef.current.contains(e.target as Node)) {
        setShowDriverPicker(false);
        setDriverSearch('');
      }
      if (serviceTypePickerRef.current && !serviceTypePickerRef.current.contains(e.target as Node)) {
        setShowServiceTypePicker(false);
        setServiceTypeSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isReactivating = selectedShift?.approvalStatus === 'rejected' || selectedShift?.serviceType === 'TO CHECK APARTMENT';
  
  const activeDrivers = useMemo(() => (users || []).filter(u => u.role === 'driver' && u.status === 'active'), [users]);
  
  const cleaners = useMemo(() => {
    let list = (users || []).filter(u => u && u.status === 'active');
    if (isSupervisorOnlyPicker) {
      return list.filter(u => ['supervisor', 'admin', 'housekeeping'].includes(u.role));
    }
    return list.filter(u => ['cleaner', 'supervisor'].includes(u.role));
  }, [users, isSupervisorOnlyPicker]);
  
  const filteredCleaners = useMemo(() => {
    if (!staffSearch) return cleaners;
    return cleaners.filter(u => u.name.toLowerCase().includes(staffSearch.toLowerCase()));
  }, [cleaners, staffSearch]);

  const filteredDrivers = useMemo(() => {
    if (!driverSearch) return activeDrivers;
    return activeDrivers.filter(u => u.name.toLowerCase().includes(driverSearch.toLowerCase()));
  }, [activeDrivers, driverSearch]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); return d; }), [currentWeekStart]);

  const hasUnpublishedShifts = useMemo(() => {
    const weekDateStrings = weekDates.map(d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
    return (shifts || []).some(s => weekDateStrings.includes(s.date) && !s.isPublished);
  }, [shifts, weekDates]);

  const navigateWeek = (weeks: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (weeks * 7));
    setCurrentWeekStart(newStart);
  };

  const publishCurrentWeek = () => {
    const weekDateStrings = weekDates.map(d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
    setShifts(prev => prev.map(s => weekDateStrings.includes(s.date) ? { ...s, isPublished: true } : s));
    if (showToast) showToast(`CURRENT WEEK PUBLISHED`, 'success');
  };

  const handleOpenNewShift = (userId?: string, dateStr?: string) => {
    setIsFieldLocked(false);
    setIsSupervisorOnlyPicker(false);
    setOriginalCleanerIds(null);
    setShiftForm({
      ...getEmptyShift(),
      userIds: userId ? [userId] : [],
      date: dateStr || toLocalDateString(new Date())
    });
    setSelectedShift(null);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setDriverSearch('');
    setServiceTypeSearch('');
  };

  const handleEditShift = (shift: Shift) => {
    setIsFieldLocked(false);
    setIsSupervisorOnlyPicker(shift.serviceType === 'TO CHECK APARTMENT');
    setOriginalCleanerIds(null);
    setShiftForm({
      ...shift,
      startTime: convertTo24h(shift.startTime),
      endTime: convertTo24h(shift.endTime || '14:00'),
      date: parseShiftDate(shift.date)
    });
    setSelectedShift(shift);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setDriverSearch('');
    setServiceTypeSearch('');
  };

  const handleDeleteShift = (id: string) => {
    if (!id) return;
    setShifts(prev => prev.filter(s => s.id !== id));
    setShowShiftModal(false);
    setReviewShift(null);
    setSelectedShift(null);
    if (showToast) showToast(`SHIFT REMOVED`, 'info');
  };

  const handleRescheduleFix = (originalShift: Shift) => {
    setIsFieldLocked(true);
    setIsSupervisorOnlyPicker(false);
    
    let targetUserIds = originalShift.userIds;
    const originalCleanerPhotos: string[] = [];

    const cleanerShift = shifts
        .filter(s => s.propertyId === originalShift.propertyId && s.serviceType !== 'TO CHECK APARTMENT' && s.status === 'completed')
        .sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0))[0];
    
    if (originalShift.serviceType === 'TO CHECK APARTMENT' && cleanerShift) {
        targetUserIds = cleanerShift.userIds;
    }

    if (cleanerShift) {
      cleanerShift.tasks?.forEach(t => t.photos?.forEach(p => originalCleanerPhotos.push(p.url)));
    }

    setOriginalCleanerIds(targetUserIds);

    setShiftForm({
      ...getEmptyShift(),
      propertyId: originalShift.propertyId,
      userIds: targetUserIds,
      serviceType: 'TO FIX',
      notes: `[REMEDIAL] Fix required for ${originalShift.propertyName}. Findings: ${originalShift.approvalComment}`,
      approvalComment: originalShift.approvalComment,
      inspectionPhotos: originalShift.inspectionPhotos,
      originalCleaningPhotos: originalCleanerPhotos,
      date: parseShiftDate(originalShift.date),
      isPublished: true,
      excludeLaundry: originalShift.excludeLaundry || false
    });
    
    setSelectedShift(originalShift); 
    setReviewShift(null);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setDriverSearch('');
    setServiceTypeSearch('');
  };

  const handleSendSupervisor = (originalShift: Shift) => {
    setIsFieldLocked(true);
    setIsSupervisorOnlyPicker(true);
    setOriginalCleanerIds(null);
    setShiftForm({
      ...getEmptyShift(),
      propertyId: originalShift.propertyId,
      userIds: [], 
      serviceType: 'TO CHECK APARTMENT',
      notes: `[SUPERVISOR AUDIT] Independent check required for ${originalShift.propertyName}.`,
      date: parseShiftDate(originalShift.date),
      isPublished: true,
      excludeLaundry: originalShift.excludeLaundry || false
    });
    setSelectedShift(null);
    setReviewShift(null);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setDriverSearch('');
    setServiceTypeSearch('');
  };

  const handleSaveShift = (e: React.FormEvent | null, publishScope: 'draft' | 'day' | 'week' | boolean = 'draft') => {
    e?.preventDefault?.();
    if (!shiftForm.propertyId || !shiftForm.userIds?.length || !shiftForm.date || !shiftForm.serviceType) return;
    
    if (!availableServiceTypes.includes(shiftForm.serviceType)) {
      setAvailableServiceTypes(prev => [...prev, shiftForm.serviceType!]);
    }

    const prop = properties.find(p => p.id === shiftForm.propertyId);
    const dateObj = new Date(shiftForm.date as string);
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    const startTime12h = convertTo12h(shiftForm.startTime || '10:00');
    const endTime12h = convertTo12h(shiftForm.endTime || '14:00');
    
    let scope = publishScope;
    if (scope === true) scope = 'day';
    if (scope === false) scope = 'draft';

    const autoPublish = shiftForm.serviceType === 'TO FIX' || shiftForm.serviceType === 'TO CHECK APARTMENT';
    
    let isShiftPublished = false;
    if (scope === 'day' || scope === 'week') isShiftPublished = true;
    else if (scope === 'draft') isShiftPublished = false;
    else {
        isShiftPublished = autoPublish || (selectedShift ? selectedShift.isPublished : false);
    }

    const constructNewShift = (id: string): Shift => ({
        id,
        propertyId: shiftForm.propertyId!,
        userIds: shiftForm.userIds!,
        propertyName: prop?.name || 'Unknown',
        date: dateFormatted,
        startTime: startTime12h,
        endTime: endTime12h,
        serviceType: shiftForm.serviceType!,
        notes: shiftForm.notes || '',
        approvalComment: shiftForm.approvalComment,
        inspectionPhotos: shiftForm.inspectionPhotos,
        originalCleaningPhotos: shiftForm.originalCleaningPhotos,
        status: 'pending',
        approvalStatus: 'pending',
        fixWorkPayment: shiftForm.fixWorkPayment || 0,
        isPublished: isShiftPublished,
        excludeLaundry: shiftForm.excludeLaundry || false
    });

    setShifts(prev => {
        let newShifts = [...prev];
        if (selectedShift && isReactivating) {
             const newId = `${shiftForm.serviceType === 'TO CHECK APARTMENT' ? 'audit' : 'fix'}-${Date.now()}`;
             newShifts.unshift(constructNewShift(newId));
             
             if (shiftForm.serviceType === 'TO FIX') {
                 newShifts = newShifts.map(s => {
                     if (s.id === selectedShift.id && s.serviceType === 'TO CHECK APARTMENT') {
                         return { ...s, approvalStatus: 'approved' as const, decidedBy: currentUser.name };
                     }
                     const isTargetCleanerShift = s.propertyId === shiftForm.propertyId && s.approvalStatus === 'rejected' && s.serviceType !== 'TO CHECK APARTMENT';
                     if (isTargetCleanerShift) {
                         return { ...s, correctionStatus: 'fixing' as const };
                     }
                     return s;
                 });
             }
        } else if (selectedShift) {
             newShifts = newShifts.map(s => s.id === selectedShift.id ? constructNewShift(selectedShift.id) : s);
        } else {
             const newId = `s-${Date.now()}`;
             newShifts.unshift(constructNewShift(newId));
        }

        if (scope === 'day') {
             newShifts = newShifts.map(s => s.date === dateFormatted ? { ...s, isPublished: true } : s);
        } else if (scope === 'week') {
             const d = new Date(dateObj);
             const day = d.getDay();
             const diff = d.getDate() - day + (day === 0 ? -6 : 1);
             const weekStart = new Date(d.setDate(diff));
             const weekDatesStrs = [];
             for(let i=0; i<7; i++) {
                 const wd = new Date(weekStart);
                 wd.setDate(wd.getDate() + i);
                 weekDatesStrs.push(wd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
             }
             newShifts = newShifts.map(s => weekDatesStrs.includes(s.date) ? { ...s, isPublished: true } : s);
        }
        return newShifts;
    });

    if (showToast) {
       if (scope === 'week') showToast('WEEK SCHEDULE PUBLISHED', 'success');
       else if (scope === 'day') showToast('DAY SCHEDULE PUBLISHED', 'success');
       else if (isShiftPublished) showToast('SHIFT PUBLISHED', 'success');
       else showToast('DRAFT SAVED', 'info');
    }
    
    setShowShiftModal(false);
    setSelectedShift(null);
  };

  const hasConflict = (shift: Shift) => {
    const start = parseTimeToMinutes(shift.startTime);
    const end = parseTimeToMinutes(shift.endTime || '14:00');
    return (shifts || []).some(other => {
      if (other.id === shift.id || other.date !== shift.date) return false;
      const hasSharedUser = shift.userIds.some(uid => other.userIds.includes(uid));
      if (!hasSharedUser) return false;
      const otherStart = parseTimeToMinutes(other.startTime);
      const otherEnd = parseTimeToMinutes(other.endTime || '14:00');
      return (start < otherEnd && end > otherStart);
    });
  };

  const handleReviewDecision = (status: 'approved' | 'rejected') => {
    if (!reviewShift) return;
    if (status === 'rejected' && !rejectionReason.trim() && !reviewShift.approvalComment) { 
      alert("A reason is mandatory for rejection."); 
      return; 
    }
    
    const auditorName = currentUser.name || 'Management';
    const finalComment = status === 'approved' ? (reviewShift.approvalComment || 'Quality Verified.') : (rejectionReason || reviewShift.approvalComment || 'Remediation Required.');

    setShifts((prev: Shift[]): Shift[] => {
        let next: Shift[] = prev.map(s => {
            if (s.id === reviewShift.id) {
                const isAuditTask = s.serviceType === 'TO CHECK APARTMENT';
                return { 
                    ...s, 
                    approvalStatus: 'approved' as const, 
                    decidedBy: auditorName,
                    approvalComment: finalComment,
                    userIds: isAuditTask ? [currentUser.id] : s.userIds
                };
            }
            return s;
        });

        if (reviewShift.serviceType === 'TO CHECK APARTMENT') {
            const cleanerShift = next
                .filter(s => s.propertyId === reviewShift.propertyId && s.serviceType !== 'TO CHECK APARTMENT' && s.status === 'completed')
                .sort((a, b) => (b.actualEndTime || 0) - (a.actualEndTime || 0))[0];
            
            if (cleanerShift) {
                next = next.map(s => s.id === cleanerShift.id ? {
                    ...s,
                    approvalStatus: status,
                    wasRejected: status === 'rejected' ? true : s.wasRejected,
                    approvalComment: finalComment,
                    decidedBy: auditorName
                } : s);
            }
        } else {
            next = next.map(s => s.id === reviewShift.id ? {
                ...s,
                approvalStatus: status,
                wasRejected: status === 'rejected' ? true : s.wasRejected,
                approvalComment: finalComment,
                decidedBy: auditorName
            } : s);
        }
        return next;
    });

    if (showToast) showToast(status === 'approved' ? 'WORK AUTHORIZED' : 'WORK REJECTED', 'success');
    setReviewShift(null);
    setRejectionReason('');
  };

  const getShiftsForUserAndDay = (userId: string, dayDate: Date) => {
    const isoStr = toLocalDateString(dayDate);
    const shortStr = dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    return (shifts || []).filter(s => s.userIds?.includes(userId) && (s.date === shortStr || s.date === isoStr));
  };

  const getShiftsForDay = (dayDate: Date) => {
    const isoStr = toLocalDateString(dayDate);
    const shortStr = dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    const query = search.toLowerCase();
    return (shifts || []).filter(s => (s.date === shortStr || s.date === isoStr) && (!query || s.propertyName?.toLowerCase().includes(query) || s.userIds?.some(id => users.find(u => u.id === id)?.name.toLowerCase().includes(query))));
  };

  const isUserOnLeave = (userId: string, date: Date) => {
    return leaveRequests.some(l => {
      if (l.userId !== userId || l.status !== 'approved') return false;
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return d >= start && d <= end;
    });
  };

  const labelStyle = "text-[7px] font-black text-[#C5A059] uppercase tracking-[0.4em] opacity-80 mb-0.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] h-10 transition-all";

  const handleCloseMonitor = () => {
    setReviewShift(null);
    if (setActiveTab) setActiveTab('dashboard');
  };

  const isTeamSameAsOriginal = useMemo(() => {
    if (!originalCleanerIds || !shiftForm.userIds) return true;
    if (originalCleanerIds.length !== shiftForm.userIds.length) return false;
    const s1 = [...originalCleanerIds].sort();
    const s2 = [...shiftForm.userIds].sort();
    return s1.every((val, index) => val === s2[index]);
  }, [originalCleanerIds, shiftForm.userIds]);

  const showFixPaymentInput = shiftForm.serviceType === 'TO FIX' && !isTeamSameAsOriginal;

  const categorizedGridUsers = useMemo(() => {
    const query = search.toLowerCase();
    
    const filtered = users.filter(u => {
      if (u.role === 'driver') return false; 
      const matchesSearch = u.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      
      const isManagement = ['admin', 'housekeeping'].includes(u.role);
      if (isManagement) {
        return shifts.some(s => s.userIds.includes(u.id));
      }
      return ['cleaner', 'supervisor'].includes(u.role);
    });

    return [
      { title: 'CLEANING TEAM', members: filtered.filter(u => ['cleaner', 'supervisor'].includes(u.role)) },
      { title: 'MANAGEMENT OVERRIDES', members: filtered.filter(u => ['admin', 'housekeeping'].includes(u.role)) }
    ].filter(g => g.members.length > 0);
  }, [users, search, shifts]);

  const isUserActiveNow = (userId: string) => {
    // Check if user has ANY active shift right now
    return shifts.some(s => s.userIds.includes(userId) && s.status === 'active');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left pb-24 max-w-full overflow-hidden">
      <header className="space-y-4 px-1">
        <h2 className="text-2xl font-serif-brand text-[#1A1A1A] uppercase font-bold tracking-tight">SCHEDULE</h2>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
           <div className="flex bg-gray-50 rounded-lg border border-gray-300 overflow-hidden shadow-sm h-10 w-fit">
              <button onClick={() => navigateWeek(-1)} className="px-4 flex items-center text-black/40 hover:text-black border-r border-gray-300 transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button onClick={() => setCurrentWeekStart(new Date())} className="px-6 flex items-center text-[9px] font-black text-[#C5A059] uppercase tracking-widest border-r border-gray-300 transition-colors hover:bg-gray-100">TODAY</button>
              <button onClick={() => navigateWeek(1)} className="px-4 flex items-center text-black/40 hover:text-black transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg></button>
           </div>
           <div className="flex flex-col sm:flex-row sm:items-center gap-3">
             <div className="bg-gray-50 border border-gray-300 px-4 py-2.5 rounded-xl shadow-inner">
                <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-[0.15em] whitespace-nowrap">
                  {weekDates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} — {weekDates[6].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                </p>
             </div>
             {hasUnpublishedShifts && (
               <div className="flex items-center gap-2 bg-red-600/10 border border-red-500/30 px-4 py-2.5 rounded-xl animate-pulse">
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">DRAFT SHIFTS IN QUEUE</span>
               </div>
             )}
           </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
           <div className="relative flex-1">
             <input type="text" placeholder="SEARCH STAFF / UNITS..." className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 text-[10px] text-[#1A1A1A] outline-none focus:border-[#C5A059] uppercase tracking-widest font-black placeholder:text-black/10 h-11 shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
             <div className="absolute left-3.5 top-3.5 text-black/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>
           <div className="flex gap-2">
             <button onClick={() => handleOpenNewShift()} className="flex-1 md:flex-none bg-[#C5A059] text-black px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest h-11 shadow-lg active:scale-95 transition-all hover:bg-[#d4b476]">New Shift</button>
             <button onClick={publishCurrentWeek} className="flex-1 md:flex-none bg-black text-white px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest h-11 shadow-lg hover:bg-zinc-800 active:scale-95 transition-all">Publish week</button>
           </div>
        </div>
      </header>

      {viewMode === 'grid' ? (
        <div className="bg-white rounded-[32px] border border-gray-300 overflow-hidden shadow-2xl mt-2 relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="p-4 text-left w-48 border-r border-gray-400 bg-[#C5A059] text-black sticky left-0 z-20 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.4)]">
                    <span className="text-[9px] font-black text-black/60 uppercase tracking-[0.2em]">Personnel</span>
                  </th>
                  {weekDates.map((date, idx) => (
                    <th key={idx} className="p-3 text-center border-r border-gray-300 min-w-[160px] bg-white">
                      <p className="text-[8px] font-black text-black/20 uppercase tracking-widest mb-1">{date.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                      <p className="text-sm font-serif-brand font-bold text-black uppercase tracking-tight">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {categorizedGridUsers.map((group, groupIdx) => (
                  <React.Fragment key={groupIdx}>
                    <tr className="bg-[#C5A059]">
                       <td className="p-2 border-r border-[#A68342] bg-[#C5A059] sticky left-0 z-10 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.5)]">
                          <span className="text-[8px] font-black text-black uppercase tracking-[0.4em] px-2">{group.title}</span>
                       </td>
                       {weekDates.map((_, i) => (
                         <td key={i} className="border-r border-[#A68342]"></td>
                       ))}
                    </tr>
                    {group.members.map(cleaner => {
                      const isActiveNow = isUserActiveNow(cleaner.id);
                      return (
                      <tr key={cleaner.id} className={`group hover:bg-gray-50/50 ${isActiveNow ? 'bg-green-50/30' : ''}`}>
                        <td className={`p-4 border-r border-gray-400 bg-white sticky left-0 z-10 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.3)] transition-colors ${isActiveNow ? 'bg-green-50/10' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif-brand text-xs font-bold relative ${isActiveNow ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059]'}`}>
                                {cleaner.name.charAt(0)}
                                {isActiveNow && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-bold uppercase leading-tight truncate ${isActiveNow ? 'text-green-700' : 'text-black'}`}>{cleaner.name}</p>
                              {isActiveNow ? (
                                <p className="text-[7px] font-black text-green-600 uppercase tracking-widest mt-0.5 animate-pulse">● CLOCKED IN</p>
                              ) : (
                                <p className="text-[7px] font-black text-black/20 uppercase tracking-widest mt-0.5">{cleaner.role}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {weekDates.map((date, idx) => {
                          const dayShifts = getShiftsForUserAndDay(cleaner.id, date);
                          const dateStr = toLocalDateString(date);
                          const onLeave = isUserOnLeave(cleaner.id, date);
                          return (
                            <td key={idx} className={`p-2 border-r border-gray-300 align-top group-hover:bg-gray-50/30 relative group/cell transition-colors ${onLeave ? 'bg-gray-50/80' : ''}`}>
                              <div className="space-y-2 min-h-[50px] relative pb-8">
                                {onLeave ? (
                                  <div className="bg-gray-200/50 border border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center text-center animate-in fade-in">
                                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400 mb-1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                     <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-tight">ON APPROVED LEAVE</p>
                                  </div>
                                ) : (
                                  dayShifts.map(s => {
                                    const isPendingAudit = s.status === 'completed' && s.approvalStatus === 'pending';
                                    const isActive = s.status === 'active';
                                    const isApproved = s.approvalStatus === 'approved';
                                    const isRejected = s.approvalStatus === 'rejected';
                                    return (
                                      <div key={s.id} onClick={() => { if (isPendingAudit || isActive || isApproved || isRejected) setReviewShift(s); else { handleEditShift(s); } }} className={`border rounded-xl p-2 cursor-pointer transition-all relative shadow-sm ${hasConflict(s) ? 'border-red-500 bg-red-50' : isActive ? 'bg-[#C5A059] border-[#C5A059] text-black font-black ring-2 ring-[#C5A059]/30 shadow-[0_0_15px_rgba(197,160,89,0.4)]' : isPendingAudit ? 'bg-[#3B82F6] border-[#3B82F6] text-white' : isApproved ? 'bg-green-100 border-green-500 text-green-700 font-bold' : isRejected ? 'bg-red-100 border-red-500 text-red-700 font-bold shadow-red-500/20 shadow-md' : 'bg-[#FDF8EE] border-[#C5A059]/40'}`}>
                                        {!s.isPublished && <span className="absolute top-1 right-1 text-[5px] font-black text-black/30 tracking-widest bg-gray-100 px-1 rounded">DRAFT</span>}
                                        {isActive && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-black rounded-full animate-pulse"></span>}
                                        <p className={`text-[9px] font-black uppercase truncate pr-4 ${isActive ? 'text-black' : isPendingAudit ? 'text-white' : isApproved ? 'text-green-700' : isRejected ? 'text-red-700' : 'text-black'}`}>{s.propertyName}</p>
                                        <p className={`text-[7px] font-bold uppercase mt-1 ${isActive ? 'text-black/60' : isPendingAudit ? 'text-white/60' : isApproved ? 'text-green-700/60' : isRejected ? 'text-red-700/60' : 'text-black/20'}`}>{s.startTime} — {s.endTime}</p>
                                      </div>
                                    );
                                  })
                                )}
                                {!onLeave && (
                                  <div className="absolute bottom-1 left-1 opacity-0 group-hover/cell:opacity-100 transition-all pointer-events-none">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenNewShift(cleaner.id, dateStr); }} className="w-8 h-8 rounded-full border border-[#C5A059]/30 text-[#C5A059] bg-white flex items-center justify-center hover:bg-[#C5A059] hover:text-white transition-all pointer-events-auto shadow-xl" title="Add Another Shift">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-20 mt-2">
          {weekDates.map((date, idx) => {
            const dayShifts = getShiftsForDay(date);
            if (dayShifts.length === 0) return null;
            return (
              <section key={idx} className="space-y-4 px-1 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-4">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C5A059] whitespace-nowrap">{date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase()}</h3>
                   <div className="h-px flex-1 bg-gray-300"></div>
                </div>
                <div className="space-y-4">
                  {dayShifts.map(s => {
                    const assignedStaff = s.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(' & ');
                    const isPendingAudit = s.status === 'completed' && s.approvalStatus === 'pending';
                    const isActive = s.status === 'active';
                    const isApproved = s.approvalStatus === 'approved';
                    const isRejected = s.approvalStatus === 'rejected';
                    const isScheduled = s.status === 'pending';
                    return (
                      <div key={s.id} onClick={() => { if (isPendingAudit || isActive || isApproved || isRejected) setReviewShift(s); else { handleEditShift(s); } }} className={`bg-white p-6 rounded-[28px] border flex flex-col gap-5 shadow-sm transition-all active:scale-[0.98] ${isActive ? 'border-[#C5A059] bg-[#FDF8EE] ring-2 ring-[#C5A059]/20' : isPendingAudit ? 'border-[#3B82F6]' : isApproved ? 'border-green-50 bg-green-50/50' : isRejected ? 'border-red-500 bg-red-50/50 shadow-lg shadow-red-500/10' : isScheduled ? 'border-[#C5A059]/40 bg-[#FDF8EE]' : 'border-gray-300'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="text-left space-y-1.5">
                             <h4 className={`text-base font-bold uppercase tracking-tight ${isRejected ? 'text-red-700' : isApproved ? 'text-green-700' : 'text-[#1A1A1A]'}`}>{s.propertyName}</h4>
                             <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest">{s.startTime} — {s.endTime} • {s.serviceType}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                             {isActive && <span className="bg-[#C5A059] text-black text-[8px] font-black px-3 py-1 rounded-lg uppercase shadow-lg flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></span>Monitoring Live</span>}
                             {isPendingAudit && !isActive && <span className="bg-[#3B82F6] text-white text-[8px] font-black px-3 py-1 rounded-lg uppercase animate-pulse shadow-lg shadow-[#3B82F6]/20">Audit Required</span>}
                             {isApproved && <span className="bg-green-600 text-white text-[8px] font-black px-4 py-1.5 rounded-lg uppercase shadow-md">✓ VERIFIED</span>}
                             {isRejected && <span className="bg-red-600 text-white text-[8px] font-black px-4 py-1.5 rounded-lg uppercase shadow-md animate-pulse">! REJECTED</span>}
                             {isScheduled && !isPendingAudit && !isApproved && !isRejected && !isActive && <span className="bg-[#C5A059] text-white text-[8px] font-black px-3 py-1 rounded-lg uppercase shadow-lg shadow-[#C5A059]/20">Scheduled</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-300">
                           <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center text-[9px] font-black text-[#C5A059]">S</div>
                              <p className="text-[10px] font-bold text-black/60 uppercase truncate max-w-[200px]">{assignedStaff}</p>
                           </div>
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ... Existing Modals (Shift Modal, Review Modal, Zoomed Image) ... */}
      {/* (Rest of the component code for modals is unchanged, omitting for brevity as it was correct in previous version) */}
      
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-white border border-gray-100 rounded-[32px] w-full max-w-xl p-8 space-y-6 shadow-2xl relative text-left overflow-y-auto max-h-[90vh] custom-scrollbar">
            <button onClick={() => setShowShiftModal(false)} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors z-10"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <div className="space-y-1">
              <h2 className="text-xl font-serif-brand font-bold text-[#1A1A1A] uppercase">{selectedShift ? 'Update shift' : 'New shift'}</h2>
              <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Operations Management System</p>
            </div>
            <form onSubmit={(e) => handleSaveShift(e)} className="space-y-5">
              <div className="space-y-1 relative" ref={propertyPickerRef}>
                <label className={labelStyle}>Assign Apartment</label>
                <div onClick={() => !isFieldLocked && !isReactivating && setShowPropertyPicker(!showPropertyPicker)} className={`${inputStyle} flex items-center justify-between cursor-pointer ${ (isFieldLocked || isReactivating) ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                  <span className="text-[10px] font-bold">
                    {shiftForm.propertyId ? properties.find(p => p.id === shiftForm.propertyId)?.name.toUpperCase() : 'SELECT UNIT...'}
                  </span>
                  {!isFieldLocked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>}
                </div>
                {showPropertyPicker && !isFieldLocked && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-[400] bg-white border border-gray-100 rounded-2xl p-2 space-y-2 shadow-2xl max-h-72 overflow-hidden flex flex-col animate-in slide-in-from-top-2">
                    <div className="relative shrink-0">
                      <input type="text" autoFocus placeholder="Filter units..." className="w-full bg-gray-50 border border-gray-100 rounded-xl px-10 py-2.5 text-[10px] text-[#1A1A1A] outline-none focus:border-[#C5A059]" value={propertySearch} onChange={e => setPropertySearch(e.target.value)} />
                      <div className="absolute left-3.5 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
                      {filteredProperties.length === 0 ? (
                        <p className="text-[9px] text-black/20 p-4 italic text-center">No matching assets</p>
                      ) : filteredProperties.map(p => (
                        <div key={p.id} onClick={() => { setShiftForm({...shiftForm, propertyId: p.id}); setShowPropertyPicker(false); setPropertySearch(''); }} className={`px-4 py-3 rounded-xl cursor-pointer transition-all ${shiftForm.propertyId === p.id ? 'bg-[#C5A059] text-black font-black' : 'text-black/60 hover:bg-gray-50'}`}>
                          <p className="text-[10px] uppercase tracking-wider font-bold">{p.name}</p>
                          <p className="text-[8px] opacity-40 truncate font-black">{p.address}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1 relative" ref={personnelPickerRef}>
                  <label className={labelStyle}>Assign User {isSupervisorOnlyPicker && '(INSPECTORS ONLY)'}</label>
                  <div onClick={() => setShowPersonnelPicker(!showPersonnelPicker)} className={inputStyle + " flex items-center justify-between cursor-pointer"}>
                    <span className="text-[10px] font-bold">{(shiftForm.userIds?.filter(id => users.find(u => u.id === id)?.role !== 'driver').length || 0) === 0 ? 'SELECT USER...' : `${shiftForm.userIds?.filter(id => users.find(u => u.id === id)?.role !== 'driver').length} USER(S) SELECTED`}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {showPersonnelPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-[400] bg-white border border-gray-100 rounded-2xl p-2 space-y-2 shadow-2xl max-h-72 overflow-hidden flex flex-col animate-in slide-in-from-top-2">
                      <div className="relative shrink-0">
                        <input type="text" autoFocus placeholder="Search users..." className="w-full bg-gray-50 border border-gray-100 rounded-xl px-10 py-2.5 text-[10px] text-[#1A1A1A] outline-none focus:border-[#C5A059]" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
                        <div className="absolute left-3.5 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
                        {filteredCleaners.length === 0 ? (
                          <p className="text-[9px] text-black/20 p-4 italic text-center">No matching personnel</p>
                        ) : filteredCleaners.map(u => (
                          <div key={u.id} onClick={() => { const current = shiftForm.userIds || []; setShiftForm({...shiftForm, userIds: current.includes(u.id) ? current.filter(id => id !== u.id) : [...current, u.id]}); }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all ${shiftForm.userIds?.includes(u.id) ? 'bg-[#C5A059] text-black font-black' : 'text-black/60 hover:bg-gray-50'}`}>
                            <span className="text-[10px] uppercase tracking-wider font-bold">{u.name}</span>
                            {shiftForm.userIds?.includes(u.id) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {activeDrivers.length > 1 && (
                  <div className="flex-1 space-y-1 relative" ref={driverPickerRef}>
                    <label className={labelStyle}>Assign Driver</label>
                    <div onClick={() => setShowDriverPicker(!showDriverPicker)} className={inputStyle + " flex items-center justify-between cursor-pointer"}>
                      <span className="text-[10px] font-bold">{(shiftForm.userIds?.filter(id => users.find(u => u.id === id)?.role === 'driver').length || 0) === 0 ? 'SELECT DRIVER...' : `${shiftForm.userIds?.filter(id => users.find(u => u.id === id)?.role === 'driver').length} DRIVER SELECTED`}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    {showDriverPicker && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-[400] bg-white border border-gray-100 rounded-2xl p-2 space-y-2 shadow-2xl max-h-72 overflow-hidden flex flex-col animate-in slide-in-from-top-2">
                        <div className="relative shrink-0">
                          <input type="text" autoFocus placeholder="Search drivers..." className="w-full bg-gray-50 border border-gray-100 rounded-xl px-10 py-2.5 text-[10px] text-[#1A1A1A] outline-none focus:border-[#C5A059]" value={driverSearch} onChange={e => setDriverSearch(e.target.value)} />
                          <div className="absolute left-3.5 top-3 text-black/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y2="16.65"/></svg></div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
                          {filteredDrivers.length === 0 ? (
                            <p className="text-[9px] text-black/20 p-4 italic text-center">No drivers found</p>
                          ) : filteredDrivers.map(u => (
                            <div key={u.id} onClick={() => { 
                              const others = (shiftForm.userIds || []).filter(id => users.find(user => user.id === id)?.role !== 'driver');
                              const currentDriver = (shiftForm.userIds || []).find(id => users.find(user => user.id === id)?.role === 'driver');
                              const newIds = currentDriver === u.id ? others : [...others, u.id];
                              setShiftForm({...shiftForm, userIds: newIds});
                              setShowDriverPicker(false);
                            }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all ${shiftForm.userIds?.includes(u.id) ? 'bg-[#C5A059] text-black font-black' : 'text-black/60 hover:bg-gray-50'}`}>
                              <span className="text-[10px] uppercase tracking-wider font-bold">{u.name}</span>
                              {shiftForm.userIds?.includes(u.id) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {showFixPaymentInput && (
                <div className="space-y-1 animate-in slide-in-from-top-2">
                  <label className={labelStyle}>Fix Work Manual Pay Amount (€)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[10px] text-black/20">€</span>
                    <input 
                      type="number" 
                      step="0.01"
                      className={`${inputStyle} pl-8`}
                      placeholder="ENTER AMOUNT..."
                      value={shiftForm.fixWorkPayment || ''}
                      onChange={e => setShiftForm({...shiftForm, fixWorkPayment: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <p className="text-[8px] text-[#C5A059] font-black uppercase tracking-widest mt-1 opacity-60">* Different cleaner assigned. Manual fixed rate required.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CustomDatePicker label="Date" value={shiftForm.date || ''} onChange={(v) => setShiftForm({...shiftForm, date: v})} />
                <CustomTimePicker label="Start Time" value={shiftForm.startTime || '10:00'} onChange={(v) => setShiftForm({...shiftForm, startTime: v})} />
                <CustomTimePicker label="End Time" value={shiftForm.endTime || '14:00'} onChange={(v) => setShiftForm({...shiftForm, endTime: v})} />
              </div>

              <div className="space-y-1 relative" ref={serviceTypePickerRef}>
                <div className="flex justify-between items-end">
                  <label className={labelStyle}>Cleaning Protocol Type</label>
                  <label className="flex items-center gap-2 cursor-pointer mb-1.5 px-1 group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-[#C5A059] rounded"
                      checked={shiftForm.excludeLaundry || false}
                      onChange={e => setShiftForm({...shiftForm, excludeLaundry: e.target.checked})}
                    />
                    <span className="text-[7px] font-black text-black/40 uppercase tracking-widest group-hover:text-[#C5A059] transition-colors">(exclude laundry)</span>
                  </label>
                </div>
                <input 
                  disabled={isFieldLocked}
                  className={`${inputStyle} ${isFieldLocked ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                  placeholder="SEARCH OR ENTER PROTOCOL..."
                  value={shiftForm.serviceType ? shiftForm.serviceType.toUpperCase() : serviceTypeSearch}
                  onChange={(e) => { setShiftForm({...shiftForm, serviceType: e.target.value.toUpperCase()}); setServiceTypeSearch(e.target.value); setShowServiceTypePicker(true); }}
                  onFocus={() => !isFieldLocked && setShowServiceTypePicker(true)}
                />
                {showServiceTypePicker && !isFieldLocked && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-[400] bg-white border border-gray-100 rounded-2xl p-2 space-y-1 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                    {filteredServiceTypes.map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => { setShiftForm({...shiftForm, serviceType: t}); setShowServiceTypePicker(false); setServiceTypeSearch(''); }}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all ${shiftForm.serviceType === t ? 'bg-[#C5A059] text-black font-black' : 'text-black/60 hover:bg-gray-50'}`}
                      >
                        <p className="text-[10px] uppercase tracking-wider font-bold">{t}</p>
                      </button>
                    ))}
                    {!availableServiceTypes.includes(serviceTypeSearch.toUpperCase()) && serviceTypeSearch.trim() && (
                      <button 
                        type="button"
                        onClick={() => { const val = serviceTypeSearch.toUpperCase(); setShiftForm({...shiftForm, serviceType: val}); setAvailableServiceTypes(prev => [...prev, val]); setShowServiceTypePicker(false); setServiceTypeSearch(''); }}
                        className="w-full text-left px-4 py-3 rounded-xl bg-[#F6E6C2] text-black font-black transition-all hover:bg-[#E2C994] border border-[#C5A059]/20"
                      >
                         <p className="text-[10px] uppercase tracking-wider">ADD NEW: {serviceTypeSearch.toUpperCase()}</p>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className={labelStyle}>Shift Notes (Instructional)</label>
                <textarea className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[#1A1A1A] text-[10px] h-24 outline-none focus:border-[#C5A059] italic" placeholder="E.G. Baby cot setup in Room 2..." value={shiftForm.notes} onChange={e => setShiftForm({...shiftForm, notes: e.target.value})} />
              </div>
              <div className="pt-6 space-y-4">
                 {selectedShift ? (
                   <div className="flex items-center gap-4">
                      <button type="button" onClick={() => { if (selectedShift?.id) handleDeleteShift(selectedShift.id); }} className="w-14 h-14 rounded-2xl border border-red-500/20 flex items-center justify-center text-red-600 hover:bg-red-50 transition-all shrink-0 shadow-sm group" title="Void Shift"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:scale-110 transition-transform"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                      <button type="button" onClick={() => handleSaveShift(null, 'draft')} className="flex-1 px-8 py-4 border border-gray-200 rounded-2xl text-black/40 font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">SAVE DRAFT</button>
                      <button type="button" onClick={() => handleSaveShift(null, 'day')} className="flex-1 bg-[#C5A059] text-black font-black py-4 px-8 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl hover:bg-[#d4b476]">PUBLISH</button>
                   </div>
                 ) : (
                   <div className="flex gap-3">
                     <button type="button" onClick={() => setShowShiftModal(false)} className="px-6 border border-red-100 text-red-400 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all">CANCEL</button>
                     <button type="button" onClick={() => handleSaveShift(null, 'draft')} className="flex-1 border border-gray-200 text-black/60 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">SAVE DRAFT</button>
                     <button type="submit" onClick={() => handleSaveShift(null, 'day')} className="flex-1 bg-[#C5A059] text-black font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg hover:bg-[#d4b476]">PUBLISH</button>
                   </div>
                 )}
              </div>
            </form>
          </div>
        </div>
      )}

      {reviewShift && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          {/* ... existing review modal content ... */}
          <div className={`${reviewShift.status === 'active' ? 'bg-[#F6E6C2]' : 'bg-white'} border border-gray-100 rounded-[40px] w-full max-w-5xl p-8 md:p-12 space-y-8 my-auto shadow-2xl relative text-left`}>
            <button onClick={() => setReviewShift(null)} className="absolute top-10 right-10 text-black/20 hover:text-black transition-colors z-10"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <h2 className="text-2xl font-serif-brand font-bold text-[#1A1A1A] uppercase tracking-tight">{reviewShift.status === 'active' ? 'Live Monitoring' : 'Audit'}: {reviewShift.propertyName}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="space-y-6">
                  {reviewShift.serviceType === 'TO FIX' ? (
                    <div className="space-y-8">
                       <div className="bg-red-50 p-6 rounded-3xl border border-red-200 space-y-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600">PHASE 1: ORIGINAL FAILED CLEAN EVIDENCE</p>
                          <div className="grid grid-cols-4 gap-2.5">
                            {reviewShift.originalCleaningPhotos && reviewShift.originalCleaningPhotos.length > 0 ? (
                              reviewShift.originalCleaningPhotos.map((url, i) => (
                                <img key={i} src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border border-red-100 cursor-zoom-in hover:scale-105 transition-all" alt="Original Failure" />
                              ))
                            ) : (
                              <p className="col-span-4 text-[8px] text-red-300 uppercase font-black py-4 text-center italic">No archival photos attached.</p>
                            )}
                          </div>
                       </div>

                       <div className="bg-[#FDF8EE] p-6 rounded-3xl border border-[#D4B476]/30 space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#8B6B2E]">PHASE 2: SUPERVISOR INSPECTION REPORT</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-orange-50 italic text-[11px] leading-relaxed">
                            "{reviewShift.approvalComment || 'Correction required per visual audit.'}"
                          </div>
                          <div className="grid grid-cols-4 gap-2.5">
                            {reviewShift.inspectionPhotos && reviewShift.inspectionPhotos.length > 0 ? (
                              reviewShift.inspectionPhotos.map((url, i) => (
                                <img key={i} src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border border-orange-100 cursor-zoom-in hover:scale-105 transition-all" alt="Supervisor Evidence" />
                              ))
                            ) : (
                              <p className="col-span-4 text-[8px] text-orange-300 uppercase font-black py-4 text-center italic">No audit photos documented.</p>
                            )}
                          </div>
                       </div>

                       <div className="bg-green-50 p-6 rounded-3xl border border-green-200 space-y-4 shadow-inner">
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-green-600">PHASE 3: REMEDIAL CORRECTION EVIDENCE</p>
                          <div className="grid grid-cols-4 gap-2.5">
                            {getShiftAttributedPhotos(reviewShift)
                              .filter(p => !reviewShift.inspectionPhotos?.includes(p.url) && !reviewShift.originalCleaningPhotos?.includes(p.url))
                              .map((photo, i) => (
                               <img key={i} src={photo.url} onClick={() => setZoomedImage(photo.url)} className="aspect-square rounded-xl object-cover border border-green-100 cursor-zoom-in hover:scale-105 transition-all" alt="Remedial Correction" />
                            ))}
                            {getShiftAttributedPhotos(reviewShift).filter(p => !reviewShift.inspectionPhotos?.includes(p.url) && !reviewShift.originalCleaningPhotos?.includes(p.url)).length === 0 && (
                              <div className="col-span-4 py-8 text-center text-[10px] uppercase font-black opacity-20 animate-pulse">Waiting for correction photos...</div>
                            )}
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className={`${reviewShift.status === 'active' ? 'bg-[#F9F1D8]' : 'bg-gray-50'} p-6 rounded-3xl border border-black/5 shadow-inner`}>
                        <p className={`${labelStyle} ${reviewShift.status === 'active' ? 'text-black' : ''}`}>Staff Evidence Stream {reviewShift.status === 'active' && '(LIVE UPDATING)'}</p>
                        <div className="grid grid-cols-4 gap-2.5 mt-4">
                          {getShiftAttributedPhotos(reviewShift).length === 0 ? (
                            <div className="col-span-4 py-10 text-center opacity-20 italic text-[10px] uppercase text-black font-black">No evidence photos transmitted yet.</div>
                          ) : getShiftAttributedPhotos(reviewShift).filter(p => !reviewShift.inspectionPhotos?.includes(p.url)).map((photo, i) => (
                            <img key={i} src={photo.url} onClick={() => setZoomedImage(photo.url)} className="aspect-square rounded-xl object-cover border border-gray-200 cursor-zoom-in hover:border-[#C5A059] transition-all" alt="Deployment Evidence" />
                          ))}
                        </div>
                      </div>
                      {(reviewShift.approvalComment || (reviewShift.inspectionPhotos && reviewShift.inspectionPhotos.length > 0)) && (
                        <div className={`${reviewShift.status === 'active' ? 'bg-[#F9F1D8]' : 'bg-gray-50'} p-6 rounded-3xl border border-[#C5A059]/20 space-y-4 shadow-sm`}>
                          <div className="flex items-center justify-between">
                              <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${reviewShift.status === 'active' ? 'text-black' : 'text-[#C5A059]'}`}>SUPERVISOR AUDIT FINDINGS</p>
                              {reviewShift.decidedBy && <span className="text-[7px] font-black text-black/30 uppercase italic">AUDITOR: {reviewShift.decidedBy}</span>}
                          </div>
                          <div className="space-y-4">
                              <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                <p className="text-sm text-[#1A1A1A] font-serif-brand italic leading-relaxed">"{reviewShift.approvalComment || 'No qualitative audit notes documented.'}"</p>
                              </div>
                              {reviewShift.inspectionPhotos && reviewShift.inspectionPhotos.length > 0 && (
                                <div className="pt-2">
                                  <p className="text-[8px] text-black/30 uppercase font-black mb-3">Auditor Photographic Evidence:</p>
                                  <div className="grid grid-cols-4 gap-2.5">
                                      {reviewShift.inspectionPhotos.map((url, i) => (
                                        <img key={i} src={url} onClick={() => setZoomedImage(url)} className="aspect-square rounded-xl object-cover border-2 border-white shadow-md cursor-zoom-in hover:border-[#C5A059] transition-all shadow-sm" alt="Audit Evidence" />
                                      ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
               </div>

               <div className={`${reviewShift.status === 'active' ? 'bg-[#F9F1D8]/60' : 'bg-gray-50'} p-8 rounded-[40px] border border-black/5 space-y-8 flex flex-col justify-center shadow-inner`}>
                  <div className="text-center space-y-2 text-black">
                    <p className={`text-[10px] font-black uppercase tracking-[0.6em] ${reviewShift.status === 'active' ? 'text-black' : 'text-[#C5A059]'}`}>{reviewShift.status === 'active' ? 'MONITORING CONSOLE' : 'VERDICT TERMINAL'}</p>
                    <div className={`h-px w-1/4 mx-auto ${reviewShift.status === 'active' ? 'bg-black/10' : 'bg-gray-200'}`}></div>
                  </div>
                  {reviewShift.status === 'active' ? (
                    <div className="text-center py-10 space-y-6">
                       <div className="inline-flex items-center gap-3 bg-green-50 text-green-600 border border-green-500/20 px-6 py-3 rounded-full shadow-lg">
                          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                          <p className="text-xs font-black uppercase tracking-widest text-green-600">Cleaner is currently on-site</p>
                       </div>
                       <button onClick={handleCloseMonitor} className="w-full py-6 bg-[#C5A059] hover:bg-[#E2C994] text-black font-black rounded-2xl uppercase text-[11px] tracking-[0.3em] shadow-xl transition-all active:scale-95">Close Monitor</button>
                    </div>
                  ) : reviewShift.approvalStatus === 'pending' ? (
                    <div className="space-y-6">
                      {reviewShift.serviceType === 'TO CHECK APARTMENT' ? (
                        <div className="space-y-6">
                            <p className="text-[10px] text-center text-black/40 italic px-4 uppercase font-bold tracking-widest leading-relaxed">Management Decision Required Based on Supervisor's Inspection Report.</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleReviewDecision('approved')} className="w-full py-5 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-lg active:scale-95 transition-all hover:bg-green-700">APPROVE CLEANER</button>
                                <button onClick={() => handleReviewDecision('rejected')} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-lg active:scale-95 transition-all hover:bg-red-700">REJECT CLEANER</button>
                                <div className="py-2 flex items-center gap-4">
                                    <div className="h-px flex-1 bg-black/5"></div>
                                    <span className="text-[8px] font-black text-black/20 uppercase">Remediation</span>
                                    <div className="h-px flex-1 bg-black/5"></div>
                                </div>
                                <button onClick={() => handleRescheduleFix(reviewShift)} className="w-full py-5 bg-black text-[#C5A059] border border-[#C5A059]/30 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all hover:bg-zinc-900">SCHEDULE TO FIX</button>
                            </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className={labelStyle}>Audit Context / Rejection Reason</label>
                                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Final decision notes or remediation instructions..." className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-[#1A1A1A] text-xs h-32 outline-none focus:border-[#C5A059] italic placeholder:text-black/5" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button onClick={() => handleReviewDecision('approved')} className="flex-1 py-5 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-lg active:scale-95 transition-all hover:bg-green-700">AUTHORIZE</button>
                                    <button onClick={() => handleReviewDecision('rejected')} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-lg active:scale-95 transition-all hover:bg-red-700">REJECT</button>
                                </div>
                                <button onClick={() => handleSendSupervisor(reviewShift)} className="w-full py-4 bg-black text-[#C5A059] border border-[#C5A059]/30 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all hover:bg-zinc-900">SEND SUPERVISOR</button>
                            </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 space-y-8 animate-in zoom-in-95">
                       <div className={`text-5xl font-serif-brand font-bold uppercase tracking-tighter ${reviewShift.approvalStatus === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{reviewShift.approvalStatus}</div>
                       <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                          <p className="text-black/40 italic font-serif-brand text-sm leading-relaxed">"{reviewShift.approvalComment}"</p>
                       </div>
                       <div className="flex flex-col gap-4">
                          <button onClick={() => setReviewShift(null)} className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.5em] underline underline-offset-8 hover:text-black transition-all">CLOSE</button>
                          {reviewShift.approvalStatus === 'rejected' && reviewShift.correctionStatus !== 'fixing' && (
                            <button onClick={() => handleRescheduleFix(reviewShift)} className="mt-4 bg-black text-[#C5A059] py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl hover:bg-zinc-900 transition-all active:scale-95 border border-[#C5A059]/20">RESCHEDULE TO FIX</button>
                          )}
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
      {zoomedImage && <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in" onClick={() => setZoomedImage(null)}><img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-[40px] border border-white/10 shadow-2xl" alt="Zoomed Evidence" /></div>}
    </div>
  );
};

export default SchedulingCenter;
