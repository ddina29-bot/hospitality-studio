import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Shift, Property, User, AuditReport, LeaveRequest, TabType } from '../../types';
import { SERVICE_TYPES } from '../../constants';

// --- HELPER FUNCTIONS ---

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
  if (dateStr.includes('-')) return dateStr; 
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

const getTimeFromTimestamp = (ts: number | undefined) => {
    if (!ts) return '';
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

const updateTimestampWithTime = (originalTs: number | undefined, timeStr: string, dateStr: string) => {
    if (!timeStr) return originalTs;
    const [h, m] = timeStr.split(':').map(Number);
    let d: Date;
    if (dateStr.includes('-')) {
        d = new Date(dateStr);
    } else {
        const currentYear = new Date().getFullYear();
        d = new Date(`${dateStr} ${currentYear}`);
    }
    d.setHours(h, m, 0, 0);
    return d.getTime();
};

const getShiftAttributedPhotos = (shift: Shift): { url: string }[] => {
  const allPhotos: { url: string }[] = [];
  if (shift.tasks) shift.tasks.forEach(task => task.photos?.forEach(p => allPhotos.push({ url: p.url })));
  if (shift.checkoutPhotos?.keyInBox) shift.checkoutPhotos.keyInBox.forEach(p => allPhotos.push({ url: p.url }));
  if (shift.checkoutPhotos?.boxClosed) shift.checkoutPhotos.boxClosed.forEach(p => allPhotos.push({ url: p.url }));
  if (shift.messReport?.photos) shift.messReport.photos.forEach(url => allPhotos.push({ url }));
  if (shift.maintenanceReports) shift.maintenanceReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  if (shift.damageReports) shift.damageReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  if (shift.missingReports) shift.missingReports.forEach(r => r.photos?.forEach(url => allPhotos.push({ url })));
  if (shift.inspectionPhotos) shift.inspectionPhotos.forEach(url => allPhotos.push({ url }));
  return allPhotos;
};

const CustomTimePicker: React.FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => {
  return (
    <div className="space-y-1">
      <label className="text-[7px] font-black text-black uppercase tracking-[0.3em] opacity-80 mb-0.5 block px-1">{label}</label>
      <input 
        type="time" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-teal-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest outline-none focus:border-[#0D9488] transition-all h-9"
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
      <label className="text-[7px] font-black text-black uppercase tracking-[0.3em] opacity-80 mb-0.5 block px-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-teal-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold tracking-widest flex justify-between items-center cursor-pointer hover:border-[#0D9488] h-9"
      >
        <span>{selectedDate ? formatDate(selectedDate) : 'DATE'}</span>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-100 rounded-lg shadow-2xl z-[500] p-2 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-1.5 px-1">
            <h4 className="text-black font-bold text-[10px] uppercase tracking-tighter">{monthName} {year}</h4>
            <div className="flex gap-0.5">
              <button type="button" onClick={handlePrevMonth} className="p-0.5 hover:bg-teal-50 rounded text-slate-400"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button type="button" onClick={handleNextMonth} className="p-0.5 hover:bg-teal-50 rounded text-slate-400"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <span key={d} className="text-[6px] font-black text-slate-200 uppercase">{d}</span>
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
                    isSelected ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-teal-50'
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

interface SchedulingCenterProps {
  shifts: Shift[];
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

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ 
  shifts = [], 
  setShifts, 
  properties, 
  users, 
  showToast, 
  setAuditReports, 
  leaveRequests = [], 
  initialSelectedShiftId, 
  onConsumedDeepLink, 
  setActiveTab 
}) => {
  const currentUser = JSON.parse(localStorage.getItem('current_user_obj') || '{}');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [reviewShift, setReviewShift] = useState<Shift | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showPersonnelPicker, setShowPersonnelPicker] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  
  const [shiftForm, setShiftForm] = useState<Partial<Shift>>({});
  const [isReactivating, setIsReactivating] = useState(false);

  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('studio_custom_service_types');
    return saved ? JSON.parse(saved) : SERVICE_TYPES;
  });

  const [isFieldLocked, setIsFieldLocked] = useState(false);
  const [originalCleanerIds, setOriginalCleanerIds] = useState<string[] | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(window.innerWidth < 768 ? 'list' : 'grid');

  const propertyPickerRef = useRef<HTMLDivElement>(null);
  const personnelPickerRef = useRef<HTMLDivElement>(null);
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
    if (initialSelectedShiftId && shifts.length > 0) {
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
  }, [initialSelectedShiftId, shifts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (propertyPickerRef.current && !propertyPickerRef.current.contains(e.target as Node)) setShowPropertyDropdown(false);
        if (personnelPickerRef.current && !personnelPickerRef.current.contains(e.target as Node)) setShowPersonnelPicker(false);
        if (serviceTypePickerRef.current && !serviceTypePickerRef.current.contains(e.target as Node)) setShowServiceTypePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setShowPropertyDropdown = (val: boolean) => setShowPropertyPicker(val);

  const activeManagedProperties = useMemo(() => properties.filter(p => p.status !== 'disabled'), [properties]);

  const filteredProperties = useMemo(() => {
    const query = propertySearch.toLowerCase();
    if (!query) return activeManagedProperties;
    return activeManagedProperties.filter(p => p.name.toLowerCase().includes(query) || p.address.toLowerCase().includes(query));
  }, [activeManagedProperties, propertySearch]);

  const filteredServiceTypes = useMemo(() => {
    const query = serviceTypeSearch.toLowerCase();
    return availableServiceTypes.filter(t => t.toLowerCase().includes(query));
  }, [availableServiceTypes, serviceTypeSearch]);

  const filteredCleaners = useMemo(() => {
    const query = staffSearch.toLowerCase();
    return users.filter(u => 
      ['cleaner', 'supervisor'].includes(u.role) && 
      u.status === 'active' && 
      u.name.toLowerCase().includes(query)
    );
  }, [users, staffSearch]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentWeekStart]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + (direction * 7));
      return d;
    });
  };

  const hasUnpublishedShifts = useMemo(() => {
    const weekDateStrs = weekDates.map(d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
    return shifts.some(s => !s.isPublished && weekDateStrs.includes(s.date));
  }, [shifts, weekDates]);

  const getEmptyShift = () => ({
    propertyId: '', userIds: [], date: toLocalDateString(new Date()),
    startTime: '10:00', endTime: '14:00', serviceType: SERVICE_TYPES[0], notes: '',
    fixWorkPayment: 0, isPublished: false, inspectionPhotos: [], approvalComment: '',
    excludeLaundry: false
  });

  const handleOpenNewShift = (userId?: string, dateStr?: string) => {
    setShiftForm({
      ...getEmptyShift(),
      userIds: userId ? [userId] : [],
      date: dateStr || parseShiftDate(new Date().toISOString())
    });
    setIsReactivating(false);
    setSelectedShift(null);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setServiceTypeSearch('');
    setIsFieldLocked(false);
  };

  const handleEditShift = (shift: Shift) => {
    setShiftForm({ ...shift, userIds: [...(shift.userIds || [])] });
    setSelectedShift(shift);
    setIsReactivating(false);
    setShowShiftModal(true);
    setPropertySearch('');
    setStaffSearch('');
    setServiceTypeSearch('');
    setIsFieldLocked(false);
  };

  const publishCurrentWeek = () => {
    const weekDateStrs = weekDates.map(d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase());
    setShifts(prev => prev.map(s => {
      if (weekDateStrs.includes(s.date) && !s.isPublished) {
        return { ...s, isPublished: true };
      }
      return s;
    }));
    if (showToast) showToast('WEEK PUBLISHED', 'success');
  };

  const handleSaveShift = (e: React.FormEvent | null, publishScope: 'draft' | 'day' | boolean = 'draft') => {
    e?.preventDefault?.();
    if (!shiftForm.propertyId || !shiftForm.date || !shiftForm.serviceType) return;
    
    if (selectedShift && selectedShift.userIds && selectedShift.userIds.length > 0 && (!shiftForm.userIds || shiftForm.userIds.length === 0)) {
        if (!window.confirm("WARNING: You are about to remove ALL staff from this shift. Continue?")) {
            return;
        }
    }

    if (!shiftForm.userIds) shiftForm.userIds = [];

    const dateObj = new Date(shiftForm.date as string);
    const conflictingLeave = shiftForm.userIds
      .map(uid => ({ uid, leave: getUserLeaveStatus(uid, dateObj) }))
      .find(res => res.leave?.status === 'approved');

    if (conflictingLeave) {
       const u = users.find(u => u.id === conflictingLeave.uid);
       const leaveReason = conflictingLeave.leave?.type.toUpperCase();
       alert(`SCHEDULING BLOCKED:\n\n${u?.name || 'User'} is on approved ${leaveReason} for this date.\n\nPlease assign a different staff member.`);
       return;
    }

    if (!availableServiceTypes.includes(shiftForm.serviceType)) {
      setAvailableServiceTypes(prev => [...prev, shiftForm.serviceType!]);
    }

    const prop = properties.find(p => p.id === shiftForm.propertyId);
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    const startTime12h = convertTo12h(shiftForm.startTime || '10:00');
    const endTime12h = convertTo12h(shiftForm.endTime || '14:00');
    
    let scope = publishScope;
    if (scope === true) scope = 'day';
    if (scope === false) scope = 'draft';

    const autoPublish = shiftForm.serviceType === 'TO FIX' || shiftForm.serviceType === 'TO CHECK APARTMENT';
    
    let isShiftPublished = false;
    if (scope === 'day') isShiftPublished = true;
    else if (scope === 'draft') isShiftPublished = false;
    else {
        isShiftPublished = autoPublish || (selectedShift ? selectedShift.isPublished : false);
    }

    const constructNewShift = (id: string): Shift => ({
        id,
        propertyId: shiftForm.propertyId!,
        userIds: [...(shiftForm.userIds || [])],
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
        }
        return newShifts;
    });

    if (showToast) {
       if (scope === 'day') showToast('DAY SCHEDULE PUBLISHED', 'success');
       else if (isShiftPublished) showToast('SHIFT PUBLISHED', 'success');
       else showToast('DRAFT SAVED', 'info');
    }
    
    setShowShiftModal(false);
    setSelectedShift(null);
  };

  const handleRescheduleFix = (originalShift: Shift, remedialNotes?: string) => {
    setIsFieldLocked(true);
    setIsReactivating(true);
    
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
      userIds: targetUserIds ? [...targetUserIds] : [],
      serviceType: 'TO FIX',
      notes: `[REMEDIAL] Fix required for ${originalShift.propertyName}. Findings: ${remedialNotes || originalShift.approvalComment || 'Quality standard not met.'}`,
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
    setServiceTypeSearch('');
  };

  const handleSendSupervisor = (originalShift: Shift) => {
    setIsFieldLocked(true);
    setIsReactivating(false);
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
    setServiceTypeSearch('');
  };

  const handleDeleteShift = (id: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this shift? This cannot be undone.")) return;
    setShifts(prev => prev.filter(s => s.id !== id));
    setShowShiftModal(false);
    setReviewShift(null);
    setSelectedShift(null);
    if (showToast) showToast(`SHIFT REMOVED`, 'info');
  };

  const handleReviewDecision = (status: 'approved' | 'rejected') => {
    if (!reviewShift) return;
    if (status === 'rejected' && !rejectionReason.trim() && !reviewShift.approvalComment) { 
      alert("A reason is mandatory for rejection."); 
      return; 
    }
    const auditorName = currentUser.name || 'Management';
    const finalComment = status === 'approved' ? (reviewShift.approvalComment || 'Quality Verified.') : (rejectionReason || reviewShift.approvalComment || 'Remediation Required.');
    const finalShift = { ...reviewShift };
    setShifts((prev: Shift[]): Shift[] => {
        let next: Shift[] = prev.map(s => {
            if (s.id === finalShift.id) {
                const isAuditTask = s.serviceType === 'TO CHECK APARTMENT';
                return { 
                    ...s, 
                    approvalStatus: status, 
                    decidedBy: auditorName,
                    approvalComment: finalComment,
                    userIds: isAuditTask ? [currentUser.id] : s.userIds,
                    actualStartTime: finalShift.actualStartTime || s.actualStartTime,
                    actualEndTime: finalShift.actualEndTime || s.actualEndTime
                };
            }
            return s;
        });
        if (finalShift.serviceType === 'TO CHECK APARTMENT') {
            const cleanerShift = next
                .filter(s => s.propertyId === finalShift.propertyId && s.serviceType !== 'TO CHECK APARTMENT' && s.status === 'completed')
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
            next = next.map(s => s.id === finalShift.id ? {
                ...s,
                approvalStatus: status,
                wasRejected: status === 'rejected' ? true : s.wasRejected,
                approvalComment: finalComment,
                decidedBy: auditorName,
                actualStartTime: finalShift.actualStartTime || s.actualStartTime,
                actualEndTime: finalShift.actualEndTime || s.actualEndTime
            } : s);
        }
        return next;
    });
    if (showToast) showToast(status === 'approved' ? 'WORK AUTHORIZED' : 'WORK REPORTED', 'success');
    if (status !== 'rejected') setReviewShift(null); // Keep active if rejecting & fixing next
    setRejectionReason('');
  };

  const getUserLeaveStatus = (userId: string, date: Date) => {
    const targetDateStr = toLocalDateString(date);
    return leaveRequests.find(l => {
      if (l.userId !== userId || l.status === 'rejected') return false;
      return targetDateStr >= l.startDate && targetDateStr <= l.endDate;
    });
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

  const isUserActiveNow = (userId: string) => {
    return shifts.some(s => s.userIds.includes(userId) && s.status === 'active');
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

  const categorizedGridUsers = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      return ['cleaner', 'supervisor'].includes(u.role);
    });
    return [
      { title: 'TEAM', members: filtered }
    ].filter(g => g.members.length > 0);
  }, [users, search]);

  const labelStyle = "text-[7px] font-black text-black uppercase tracking-[0.4em] opacity-80 mb-0.5 block px-1";
  const inputStyle = "w-full bg-teal-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest outline-none focus:border-[#0D9488] h-10 transition-all";

  const reviewDuration = useMemo(() => {
      if (!reviewShift?.actualStartTime || !reviewShift?.actualEndTime) return 0;
      return (reviewShift.actualEndTime - reviewShift.actualStartTime) / (1000 * 60 * 60);
  }, [reviewShift?.actualStartTime, reviewShift?.actualEndTime]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-left pb-24 max-w-full overflow-hidden bg-white min-h-screen">
      <header className="space-y-4 px-1">
        <h2 className="text-2xl font-serif-brand text-black uppercase font-bold tracking-tight">SCHEDULE</h2>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Manage staff assignments, service types, and deployment dates.</p>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
           <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm h-10 w-fit">
              <button onClick={() => navigateWeek(-1)} className="px-4 flex items-center text-slate-400 hover:text-slate-600 border-r border-slate-200 transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button onClick={() => setCurrentWeekStart(new Date())} className="px-6 flex items-center text-[9px] font-black text-black uppercase tracking-widest border-r border-slate-200 transition-colors hover:bg-teal-50">TODAY</button>
              <button onClick={() => navigateWeek(1)} className="px-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
           </div>
           <div className="flex flex-col sm:flex-row sm:items-center gap-3">
             <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-inner">
                <p className="text-[10px] font-black text-black uppercase tracking-[0.15em] whitespace-nowrap">
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
             <input type="text" placeholder="SEARCH STAFF / UNITS..." className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-[10px] text-[#1A1A1A] outline-none focus:border-[#0D9488] uppercase tracking-widest font-black placeholder:text-slate-300 h-11 shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
             <div className="absolute left-3.5 top-3.5 text-slate-300"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
           </div>
           <div className="flex gap-2">
             <button onClick={() => handleOpenNewShift()} className="flex-1 md:flex-none bg-teal-600 text-white px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest h-11 shadow-lg active:scale-95 transition-all hover:bg-teal-700">NEW SHIFT</button>
             <button onClick={publishCurrentWeek} className="flex-1 md:flex-none bg-teal-50 text-teal-700 border border-teal-200 px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest h-11 shadow-sm hover:bg-teal-100 active:scale-95 transition-all">Publish week</button>
           </div>
        </div>

        {/* Status Legend Row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 pt-3 border-t border-slate-100 mt-1">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-100 border border-slate-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">In Draft</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-50 border border-teal-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Scheduled</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-100 border border-violet-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Active</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-100 border border-amber-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Waiting for Verification</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-100 border border-emerald-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Approved</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-100 border border-rose-200"></div>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Reported</span>
           </div>
        </div>
      </header>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl mt-2 relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[1200px]">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="p-4 text-left w-48 border-r border-slate-300 bg-teal-600 text-white sticky left-0 z-20 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.4)]">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">Personnel</span>
                  </th>
                  {weekDates.map((date, idx) => (
                    <th key={idx} className="p-3 text-center border-r border-slate-200 min-w-[160px] bg-white">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{date.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                      <p className="text-sm font-serif-brand font-bold text-[#1A1A1A] uppercase tracking-tight">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categorizedGridUsers.map((group, groupIdx) => (
                  <React.Fragment key={groupIdx}>
                    <tr className="bg-white border-b border-slate-100">
                       <td className="p-2 border-r border-slate-100 bg-white sticky left-0 z-10 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.5)]">
                          <span className="text-[8px] font-black text-black uppercase tracking-[0.4em] px-2">{group.title}</span>
                       </td>
                       {weekDates.map((_, i) => (
                         <td key={i} className="border-r border-slate-50"></td>
                       ))}
                    </tr>
                    {group.members.map(cleaner => {
                      const isActiveNow = isUserActiveNow(cleaner.id);
                      return (
                      <tr key={cleaner.id} className={`group hover:bg-teal-50/10 ${isActiveNow ? 'bg-teal-50/20' : ''}`}>
                        <td className={`p-4 border-r border-slate-300 bg-white sticky left-0 z-10 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.3)] transition-colors ${isActiveNow ? 'bg-teal-50/10' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif-brand text-xs font-bold relative ${isActiveNow ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-teal-50 border border-teal-100 text-teal-700'}`}>
                                {cleaner.name.charAt(0)}
                                {isActiveNow && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-bold uppercase leading-tight truncate ${isActiveNow ? 'text-green-700' : 'text-teal-700'}`}>{cleaner.name}</p>
                              {isActiveNow ? (
                                <p className="text-[7px] font-black text-green-600 uppercase tracking-widest mt-0.5 animate-pulse">● CLOCKED IN</p>
                              ) : (
                                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{cleaner.role}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {weekDates.map((date, idx) => {
                          const dayShifts = getShiftsForUserAndDay(cleaner.id, date);
                          const dateStr = toLocalDateString(date);
                          const userLeave = getUserLeaveStatus(cleaner.id, date);
                          return (
                            <td key={idx} className={`p-2 border-r border-slate-200 align-top group-hover:bg-teal-50/20 relative group/cell transition-colors ${userLeave ? (userLeave.status === 'approved' ? 'bg-slate-50/80' : 'bg-orange-50/10') : ''}`}>
                              <div className="space-y-2 min-h-[50px] relative pb-8">
                                {userLeave ? (
                                  <div className={`${userLeave.status === 'approved' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-3 flex flex-col items-center justify-center text-center animate-in fade-in h-full relative z-10 min-h-[60px] shadow-sm`}>
                                     <p className={`text-[8px] font-black uppercase tracking-widest leading-tight mb-1 ${userLeave.status === 'approved' ? 'text-red-600' : 'text-orange-600'}`}>
                                        {userLeave.status === 'approved' ? 'UNAVAILABLE' : 'REQUESTING'}
                                     </p>
                                     <p className={`text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${userLeave.status === 'approved' ? 'text-red-400 bg-white/80 border border-red-100' : 'text-orange-400 bg-white/80 border border-orange-100'}`}>
                                        {userLeave.type}
                                     </p>
                                  </div>
                                ) : (
                                  dayShifts.map(s => {
                                    const isPendingAudit = s.status === 'completed' && s.approvalStatus === 'pending';
                                    const isActive = s.status === 'active';
                                    const isApproved = s.approvalStatus === 'approved';
                                    const isReported = s.approvalStatus === 'rejected';
                                    const isDraft = !s.isPublished;
                                    
                                    let colorClass = 'bg-white border-slate-100 text-[#1A1A1A]';
                                    if (isReported) colorClass = 'bg-rose-100 border-rose-200 text-rose-800';
                                    else if (isApproved) colorClass = 'bg-emerald-100 border-emerald-200 text-emerald-800';
                                    else if (isPendingAudit) colorClass = 'bg-amber-100 border-amber-200 text-amber-800';
                                    else if (isActive) colorClass = 'bg-violet-100 border-violet-200 text-violet-700 font-black shadow-md';
                                    else if (isDraft) colorClass = 'bg-slate-100 border-slate-200 text-slate-600';
                                    else colorClass = 'bg-teal-50 border-teal-200 text-teal-700';

                                    return (
                                      <div key={s.id} onClick={() => { if (isPendingAudit || isActive || isApproved || isReported) setReviewShift(s); else { handleEditShift(s); } }} className={`border rounded-xl p-2 cursor-pointer transition-all relative shadow-sm ${hasConflict(s) ? 'border-red-500 bg-red-50' : colorClass}`}>
                                        {isActive && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse"></span>}
                                        <p className={`text-[9px] font-black uppercase truncate pr-4`}>{s.propertyName}</p>
                                        <p className={`text-[7px] font-bold uppercase mt-1 opacity-70`}>{s.startTime} — {s.endTime}</p>
                                      </div>
                                    );
                                  })
                                )}
                                {(!userLeave || userLeave.status !== 'approved') && (
                                  <div className="absolute bottom-1 left-1 opacity-0 group-hover/cell:opacity-100 transition-all pointer-events-none">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenNewShift(cleaner.id, dateStr); }} className="w-8 h-8 rounded-full border border-teal-100 text-black bg-white flex items-center justify-center hover:bg-teal-600 hover:text-white transition-all pointer-events-auto shadow-xl" title="Add Another Shift">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" cy="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-black whitespace-nowrap">{date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase()}</h3>
                   <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="space-y-4">
                  {dayShifts.map(s => {
                    const assignedStaff = s.userIds.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(' & ');
                    const isPendingAudit = s.status === 'completed' && s.approvalStatus === 'pending';
                    const isActive = s.status === 'active';
                    const isApproved = s.approvalStatus === 'approved';
                    const isReported = s.approvalStatus === 'rejected';
                    const isDraft = !s.isPublished;
                    
                    let colorClass = 'bg-white border-slate-100';
                    if (isReported) colorClass = 'bg-rose-100 border-rose-200 text-rose-800';
                    else if (isApproved) colorClass = 'bg-emerald-100 border-emerald-200 text-emerald-800';
                    else if (isPendingAudit) colorClass = 'bg-amber-100 border-amber-200 text-amber-800';
                    else if (isActive) colorClass = 'bg-violet-100 border-violet-200 text-violet-700';
                    else if (isDraft) colorClass = 'bg-slate-100 border-slate-200 text-slate-600';
                    else colorClass = 'bg-teal-50 border-teal-200 text-teal-700';

                    return (
                      <div key={s.id} onClick={() => { if (isPendingAudit || isActive || isApproved || isReported) setReviewShift(s); else { handleEditShift(s); } }} className={`bg-white p-6 rounded-[28px] border flex flex-col gap-5 shadow-sm transition-all active:scale-[0.98] ${colorClass}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="text-left space-y-1.5">
                             <h4 className={`text-base font-bold uppercase tracking-tight`}>{s.propertyName}</h4>
                             <p className={`text-[10px] font-black uppercase tracking-widest opacity-70`}>{s.startTime} — {s.endTime} • {s.serviceType}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                             {isActive && <span className="bg-violet-600 text-white px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest animate-pulse border border-violet-700 shadow-sm">Active</span>}
                             {isPendingAudit && <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm">Audit Required</span>}
                             {isApproved && <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm">Approved</span>}
                             {isReported && <span className="bg-rose-600 text-white px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm">Reported</span>}
                             {isDraft && <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest border border-slate-300">Draft</span>}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-dashed border-black/5 flex justify-between items-center">
                           <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                 {s.userIds.map((uid, i) => (
                                    <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white bg-white text-black`}>
                                       {users.find(u => u.id === uid)?.name.charAt(0)}
                                    </div>
                                 ))}
                              </div>
                              <span className={`text-[9px] font-bold uppercase truncate max-w-[150px] opacity-60`}>{assignedStaff}</span>
                           </div>
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`opacity-20`}><polyline points="9 18 15 12 9 6"/></svg>
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

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 overflow-y-auto">
           <div className="bg-white border border-slate-200 rounded-[48px] w-full max-w-lg p-10 space-y-8 shadow-2xl relative text-left my-auto">
              <button onClick={() => setShowShiftModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-600 transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-1">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-[#1A1A1A]">{selectedShift ? (isReactivating ? 'REACTIVATE SHIFT' : 'EDIT SHIFT') : 'NEW SHIFT'}</h2>
                 <p className="text-[8px] font-black text-black uppercase tracking-[0.4em]">Operations Command</p>
              </div>

              <form onSubmit={(e) => handleSaveShift(e, 'draft')} className="space-y-6">
                 {/* Property Selection */}
                 <div className="relative" ref={propertyPickerRef}>
                    <label className={labelStyle}>Select Asset</label>
                    {isFieldLocked ? (
                        <div className="p-3 bg-teal-50 border border-slate-100 rounded-xl">
                            <span className="text-[10px] font-bold text-[#1A1A1A] uppercase">{properties.find(p => p.id === shiftForm.propertyId)?.name}</span>
                        </div>
                    ) : (
                        <>
                            <input 
                                type="text" 
                                placeholder="SEARCH PROPERTY..." 
                                className={inputStyle}
                                value={shiftForm.propertyId ? properties.find(p => p.id === shiftForm.propertyId)?.name : propertySearch}
                                onChange={(e) => { 
                                    setPropertySearch(e.target.value); 
                                    setShiftForm({...shiftForm, propertyId: ''});
                                    setShowPropertyDropdown(true); 
                                }}
                                onFocus={() => setShowPropertyDropdown(true)}
                            />
                            {showPropertyPicker && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {filteredProperties.length === 0 ? <p className="p-2 text-[9px] font-black uppercase text-slate-200 text-center">No assets found</p> : filteredProperties.map(p => (
                                        <button 
                                            key={p.id} 
                                            type="button" 
                                            onClick={() => { setShiftForm({...shiftForm, propertyId: p.id}); setShowPropertyDropdown(false); }}
                                            className="w-full text-left px-4 py-2 rounded-lg hover:bg-teal-50 text-[9px] font-bold uppercase"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                 </div>

                 {/* Date & Time */}
                 <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <CustomDatePicker 
                            label="Deployment Date"
                            value={shiftForm.date || ''}
                            onChange={(val) => setShiftForm({...shiftForm, date: val})}
                        />
                    </div>
                    <div className="col-span-1">
                        <CustomTimePicker 
                            label="Start Time"
                            value={shiftForm.startTime || ''}
                            onChange={(val) => setShiftForm({...shiftForm, startTime: val})}
                        />
                    </div>
                    <div className="col-span-1">
                        <CustomTimePicker 
                            label="End Time"
                            value={shiftForm.endTime || ''}
                            onChange={(val) => setShiftForm({...shiftForm, endTime: val})}
                        />
                    </div>
                 </div>

                 {/* Personnel Selection */}
                 <div className="relative" ref={personnelPickerRef}>
                    <label className={labelStyle}>Assign Staff ({shiftForm.userIds?.length || 0})</label>
                    <div 
                        className={`bg-teal-50 border border-slate-200 rounded-xl p-2 min-h-[42px] flex flex-wrap gap-2 cursor-pointer hover:border-[#0D9488] transition-all ${isFieldLocked && shiftForm.serviceType === 'TO FIX' && isTeamSameAsOriginal ? 'bg-white opacity-80' : ''}`}
                        onClick={() => { if (!isFieldLocked || !isTeamSameAsOriginal) setShowPersonnelPicker(true); }}
                    >
                        {(shiftForm.userIds || []).map(uid => (
                            <span key={uid} className="bg-teal-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-2">
                                {users.find(u => u.id === uid)?.name.split(' ')[0]}
                                <button type="button" onClick={(e) => { e.stopPropagation(); setShiftForm({...shiftForm, userIds: shiftForm.userIds?.filter(id => id !== uid)}); }} className="hover:text-teal-100">×</button>
                            </span>
                        ))}
                        <input 
                            className="flex-1 min-w-[100px] text-[9px] font-bold uppercase outline-none bg-transparent h-6"
                            placeholder={shiftForm.userIds?.length ? "" : "ADD STAFF..."}
                            value={staffSearch}
                            onChange={(e) => setStaffSearch(e.target.value)}
                            onFocus={() => setShowPersonnelPicker(true)}
                        />
                    </div>
                    {showPersonnelPicker && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredCleaners.length === 0 ? <p className="p-2 text-[9px] font-black uppercase text-slate-200 text-center">No available staff</p> : filteredCleaners.map(u => (
                                <button 
                                    key={u.id} 
                                    type="button" 
                                    onClick={() => { 
                                        if (!shiftForm.userIds?.includes(u.id)) {
                                            setShiftForm({...shiftForm, userIds: [...(shiftForm.userIds || []), u.id]});
                                        }
                                        setStaffSearch('');
                                    }}
                                    className={`w-full text-left px-4 py-2 rounded-lg hover:bg-teal-50 text-[9px] font-bold uppercase flex justify-between ${shiftForm.userIds?.includes(u.id) ? 'bg-white text-teal-600' : ''}`}
                                >
                                    <span className="text-teal-700">{u.name}</span>
                                    <span className="text-[7px] text-slate-300 font-black tracking-widest">{u.role}</span>
                                </button>
                            ))}
                        </div>
                    )}
                 </div>

                 {/* Service Type Selection & Laundry Checkbox Inline */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="relative" ref={serviceTypePickerRef}>
                        <label className={labelStyle}>Service Protocol</label>
                        {isFieldLocked ? (
                            <div className="p-3 bg-teal-50 border border-slate-100 rounded-xl">
                                <span className="text-[10px] font-bold text-[#1A1A1A] uppercase">{shiftForm.serviceType}</span>
                            </div>
                        ) : (
                            <>
                                <input 
                                    className={inputStyle}
                                    placeholder="SELECT OR TYPE..."
                                    value={shiftForm.serviceType}
                                    onChange={(e) => { 
                                        setShiftForm({...shiftForm, serviceType: e.target.value}); 
                                        setServiceTypeSearch(e.target.value); 
                                        setShowServiceTypePicker(true);
                                    }}
                                    onFocus={() => setShowServiceTypePicker(true)}
                                />
                                {showServiceTypePicker && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        {filteredServiceTypes.map(t => (
                                            <button 
                                                key={t}
                                                type="button" 
                                                onClick={() => { setShiftForm({...shiftForm, serviceType: t}); setShowServiceTypePicker(false); }}
                                                className="w-full text-left px-4 py-2 rounded-lg hover:bg-teal-50 text-[9px] font-bold uppercase"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-teal-50 p-3 rounded-xl border border-slate-200 self-end h-10 mb-0">
                        <input 
                            type="checkbox" 
                            id="excludeLaundry" 
                            className="w-4 h-4 accent-black cursor-pointer"
                            checked={shiftForm.excludeLaundry}
                            onChange={(e) => setShiftForm({...shiftForm, excludeLaundry: e.target.checked})}
                        />
                        <label htmlFor="excludeLaundry" className="text-[8px] font-black text-black uppercase cursor-pointer leading-tight">Exclude Laundry</label>
                    </div>
                 </div>

                 {/* Notes */}
                 <div>
                    <label className={labelStyle}>Operational Notes</label>
                    <textarea 
                        className={`${inputStyle} h-20 py-2 italic`} 
                        placeholder="Specific instructions for this shift..."
                        value={shiftForm.notes} 
                        onChange={(e) => setShiftForm({...shiftForm, notes: e.target.value})} 
                    />
                 </div>

                 {/* Extra Options - MANUAL PRICE ALWAYS VISIBLE IF TYPE IS TO FIX OR Common Area */}
                 <div className="space-y-4 pt-2">
                    {(shiftForm.serviceType === 'TO FIX' || shiftForm.serviceType === 'Common Area') && (
                        <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl animate-in fade-in">
                            <label className="text-[7px] font-black text-teal-700 uppercase tracking-[0.4em] mb-1.5 block">Insert Manual Pay (€)</label>
                            <input 
                                type="number" 
                                className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1.5 text-black text-[10px] font-bold outline-none focus:border-teal-600"
                                placeholder="0.00"
                                value={shiftForm.fixWorkPayment || ''} 
                                onChange={(e) => setShiftForm({...shiftForm, fixWorkPayment: parseFloat(e.target.value)})} 
                            />
                            <p className="text-[7px] text-teal-600 mt-1 italic">* This fixed price will be used for the payroll of the assigned team.</p>
                        </div>
                    )}
                 </div>

                 <div className="flex gap-2 pt-4">
                    {!isReactivating && (
                        <>
                            <button type="button" onClick={() => handleSaveShift(null, 'draft')} className="flex-1 bg-white border border-slate-300 text-slate-400 font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[8px] hover:bg-teal-50 transition-all active:scale-95">Save Draft</button>
                            <button type="button" onClick={() => handleSaveShift(null, 'day')} className="flex-1 bg-teal-600 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[8px] shadow-lg hover:bg-teal-700 transition-all active:scale-95">Publish Day</button>
                        </>
                    )}
                    {isReactivating && (
                        <button type="button" onClick={() => handleSaveShift(null, true)} className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[9px] shadow-xl active:scale-95 hover:bg-teal-700 transition-all">
                            DEPLOY REMEDIAL TEAM
                        </button>
                    )}
                 </div>
                 
                 {selectedShift && !isReactivating && (
                    <div className="pt-4 border-t border-black/5 text-center">
                        <button type="button" onClick={() => handleDeleteShift(selectedShift.id)} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Delete Shift Record</button>
                    </div>
                 )}
              </form>
           </div>
        </div>
      )}

      {/* Review Modal (Audit) */}
      {reviewShift && (
        <div className="fixed inset-0 bg-black/70 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={handleCloseMonitor}>
           <div className="bg-white border border-slate-200 rounded-[40px] w-full max-w-4xl p-8 md:p-10 space-y-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
              <button onClick={handleCloseMonitor} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              
              <div className="space-y-1">
                 <h2 className="text-2xl font-serif-brand font-bold uppercase text-slate-900">{reviewShift.propertyName}</h2>
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Review & Verify • {reviewShift.date}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="bg-teal-50 p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                       <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Completed Checklist</p>
                       <div className="grid grid-cols-3 gap-2">
                          {getShiftAttributedPhotos(reviewShift).map((p, i) => (
                             <img key={i} src={p.url} onClick={() => setZoomedImage(p.url)} className="aspect-square rounded-xl object-cover border border-slate-100 cursor-zoom-in hover:opacity-80 transition-opacity" />
                          ))}
                          {getShiftAttributedPhotos(reviewShift).length === 0 && (
                             <p className="col-span-3 text-[9px] italic text-center py-4 opacity-30">No photos provided.</p>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[8px] font-black text-black uppercase tracking-[0.4em]">Time Logs (Adjust if needed)</label>
                            <span className="text-[9px] font-bold text-[#1A1A1A] uppercase">
                                Duration: {reviewDuration.toFixed(1)} hrs
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actual Start</label>
                                <input 
                                    type="time" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700"
                                    value={getTimeFromTimestamp(reviewShift.actualStartTime)}
                                    onChange={(e) => setReviewShift({...reviewShift, actualStartTime: updateTimestampWithTime(reviewShift.actualStartTime || Date.now(), e.target.value, reviewShift.date)})}
                                />
                            </div>
                            <div>
                                <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actual End</label>
                                <input 
                                    type="time" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700"
                                    value={getTimeFromTimestamp(reviewShift.actualEndTime)}
                                    onChange={(e) => setReviewShift({...reviewShift, actualEndTime: updateTimestampWithTime(reviewShift.actualEndTime || Date.now(), e.target.value, reviewShift.date)})}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                       <label className="text-[8px] font-black text-black uppercase tracking-[0.4em] mb-1.5 block px-1 opacity-80">Feedback / Reason</label>
                       <textarea 
                         value={rejectionReason} 
                         onChange={(e) => setRejectionReason(e.target.value)}
                         className="w-full bg-teal-50 border border-slate-100 rounded-xl p-4 text-[10px] font-medium outline-none focus:border-teal-600 h-24 placeholder:text-slate-200 italic"
                         placeholder="Required for reporting issues. Optional for approval."
                       />
                    </div>
                    <div className="flex flex-col gap-3">
                       <div className="flex gap-3">
                          <button onClick={() => handleReviewDecision('approved')} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
                             APPROVE CLEAN
                          </button>
                          <button onClick={() => handleReviewDecision('rejected')} className="flex-1 bg-rose-600 text-white font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all">
                             REPORT ISSUES
                          </button>
                       </div>
                       
                       <div className="flex gap-3">
                           <button onClick={() => { if (!rejectionReason) { alert("Reason required for fix schedule"); return; } handleReviewDecision('rejected'); handleRescheduleFix(reviewShift, rejectionReason); }} className="flex-1 bg-amber-50 text-amber-800 border-2 border-amber-200 font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:border-amber-400 active:scale-95 transition-all">
                              REPORT & FIX
                           </button>
                           <button onClick={() => handleSendSupervisor(reviewShift)} className="flex-1 bg-slate-50 text-slate-700 border-2 border-slate-200 font-black py-4 rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:border-slate-400 active:scale-95 transition-all">
                              SEND SUPERVISOR
                           </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-3xl" alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default SchedulingCenter;