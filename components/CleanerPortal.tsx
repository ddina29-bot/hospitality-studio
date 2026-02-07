
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Property, CleaningTask, Shift, User, AttributedPhoto, SpecialReport, SupplyItem } from '../types';
import { uploadFile } from '../services/storageService';

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
  onSelectShiftId?: (id: string | null) => void;
  authorizedInspectorIds?: string[];
  onClosePortal?: () => void;
  inventoryItems?: SupplyItem[];
  onAddSupplyRequest?: (batch: Record<string, number>) => void;
  onUpdateUser?: (u: User) => void;
}

const CleanerPortal: React.FC<CleanerPortalProps> = ({ 
  user, shifts, setShifts, properties, users, initialSelectedShiftId, onSelectShiftId
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(initialSelectedShiftId || null);
  const [currentStep, setCurrentStep] = useState<'list' | 'overview' | 'active' | 'review'>('list');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
  const activeProperty = useMemo(() => properties.find(p => p.id === activeShift?.propertyId), [activeShift, properties]);

  // CRITICAL: SYNC TASKS TO GLOBAL STATE IMMEDIATELY
  const syncTasksToMainState = useCallback((updatedTasks: CleaningTask[]) => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? { ...s, tasks: updatedTasks } : s));
  }, [selectedShiftId, setShifts]);

  useEffect(() => {
    if (activeShift && selectedShiftId) {
      if (activeShift.tasks && activeShift.tasks.length > 0) {
        setTasks(activeShift.tasks);
      } else {
        // Generate new tasks if none exist
        const newTasks: CleaningTask[] = [
          { id: 'kitchen', label: 'KITCHEN SANITIZED', isMandatory: true, minPhotos: 1, photos: [] },
          { id: 'bathroom', label: 'BATHROOM DEEP CLEAN', isMandatory: true, minPhotos: 1, photos: [] },
          { id: 'beds', label: 'BEDS STYLED', isMandatory: true, minPhotos: 1, photos: [] }
        ];
        setTasks(newTasks);
        syncTasksToMainState(newTasks);
      }
    }
  }, [selectedShiftId, activeShift?.id]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTaskId) return;
    setIsProcessingPhoto(true);
    try {
      const url = await uploadFile(file);
      const updatedTasks = tasks.map(t => t.id === activeTaskId ? { ...t, photos: [...t.photos, { url, userId: user.id }] } : t);
      setTasks(updatedTasks);
      syncTasksToMainState(updatedTasks);
    } finally {
      setIsProcessingPhoto(false);
      setActiveTaskId(null);
    }
  };

  const handleStartShift = () => {
    if (!selectedShiftId) return;
    setShifts(prev => prev.map(s => s.id === selectedShiftId ? { ...s, status: 'active', actualStartTime: Date.now() } : s));
    setCurrentStep('active');
  };

  // ... rest of component UI follows previous patterns but using syncTasksToMainState for updates
  return (
    <div className="space-y-6 pb-20 px-4">
       {/* List view, active view, and review view logic */}
       <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleCapture} id="cameraInput" />
    </div>
  );
};

export default CleanerPortal;
