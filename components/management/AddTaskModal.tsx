
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Property, User, ManualTask } from '../../types';

interface AddTaskModalProps {
  onClose: () => void;
  onSave: (task: Partial<ManualTask>) => void;
  properties: Property[];
  users: User[];
  savedTaskNames: string[];
  onAddNewTaskName: (name: string) => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onSave, properties, users, savedTaskNames, onAddNewTaskName }) => {
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [taskName, setTaskName] = useState('');
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);

  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // New billing state
  const [isBillable, setIsBillable] = useState(false);
  const [billablePrice, setBillablePrice] = useState('');

  const propertyRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (propertyRef.current && !propertyRef.current.contains(event.target as Node)) setShowPropertyDropdown(false);
      if (taskRef.current && !taskRef.current.contains(event.target as Node)) setShowTaskDropdown(false);
      if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) setShowAssigneeDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProperties = useMemo(() => {
    const query = propertySearch.toLowerCase();
    return properties.filter(p => p.name.toLowerCase().includes(query) || p.address.toLowerCase().includes(query));
  }, [properties, propertySearch]);

  const filteredUsers = useMemo(() => {
    const query = assigneeSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(query) && u.status === 'active');
  }, [users, assigneeSearch]);

  const filteredTaskNames = useMemo(() => {
    if (!taskName.trim()) return savedTaskNames;
    const query = taskName.toLowerCase();
    return savedTaskNames.filter(n => n.toLowerCase().includes(query));
  }, [savedTaskNames, taskName]);

  const handleSave = () => {
    if (!selectedProperty || !taskName.trim() || !selectedUser) {
      alert("Please fill in all fields.");
      return;
    }
    
    if (isBillable && (!billablePrice || parseFloat(billablePrice) <= 0)) {
        alert("Please enter a valid price for the billable task.");
        return;
    }

    const finalTaskName = taskName.trim();
    
    // Auto-save new task names if they don't exist in the catalog
    if (!savedTaskNames.some(n => n.toLowerCase() === finalTaskName.toLowerCase())) {
      onAddNewTaskName(finalTaskName);
    }

    onSave({
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.name,
      taskName: finalTaskName,
      userId: selectedUser.id,
      userName: selectedUser.name,
      isBillable,
      billablePrice: isBillable ? parseFloat(billablePrice) : undefined
    });
  };

  const labelStyle = "text-[7px] font-black text-[#A68342] uppercase tracking-[0.4em] mb-1.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all h-11";
  const dropdownStyle = "absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1 animate-in slide-in-from-top-2";

  return (
    <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[40px] w-full max-w-lg p-8 md:p-10 space-y-8 shadow-2xl relative text-left animate-in zoom-in-95">
        <button onClick={onClose} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <header className="space-y-1">
          <h2 className="text-2xl font-serif-brand font-bold text-black uppercase tracking-tight">Add Manual Task</h2>
          <p className="text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em]">Proprietary Deployment Extension</p>
        </header>

        <div className="space-y-6">
          {/* Property Search */}
          <div className="relative" ref={propertyRef}>
            <label className={labelStyle}>Search Apartment</label>
            <input 
              className={inputStyle}
              placeholder="START TYPING..."
              value={selectedProperty ? selectedProperty.name.toUpperCase() : propertySearch}
              onChange={(e) => { setSelectedProperty(null); setPropertySearch(e.target.value); setShowPropertyDropdown(true); }}
              onFocus={() => setShowPropertyDropdown(true)}
            />
            {showPropertyDropdown && (
              <div className={dropdownStyle}>
                {filteredProperties.length === 0 ? (
                  <p className="p-4 text-[9px] font-black uppercase text-black/20 text-center">No units found</p>
                ) : filteredProperties.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { setSelectedProperty(p); setShowPropertyDropdown(false); setPropertySearch(''); }}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-[10px] font-bold uppercase transition-all"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task Name Field (Searchable & Creatable) */}
          <div className="relative" ref={taskRef}>
            <label className={labelStyle}>Task Identification</label>
            <div className="relative">
              <input 
                className={inputStyle}
                placeholder="SEARCH OR TYPE NEW TASK..."
                value={taskName}
                onChange={(e) => { setTaskName(e.target.value); setShowTaskDropdown(true); }}
                onFocus={() => setShowTaskDropdown(true)}
              />
              {showTaskDropdown && filteredTaskNames.length > 0 && (
                <div className={dropdownStyle}>
                  {filteredTaskNames.map((name, i) => (
                    <button 
                      key={i}
                      onClick={() => { setTaskName(name); setShowTaskDropdown(false); }}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-[10px] font-bold uppercase transition-all"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {taskName && !savedTaskNames.some(n => n.toLowerCase() === taskName.toLowerCase()) && (
              <p className="text-[7px] font-black text-green-600 uppercase tracking-widest mt-2 px-1 animate-pulse">
                * NEW TASK DETECTED: WILL BE SAVED TO CATALOG
              </p>
            )}
          </div>

          {/* User Search */}
          <div className="relative" ref={assigneeRef}>
            <label className={labelStyle}>Assign Personnel</label>
            <input 
              className={inputStyle}
              placeholder="SEARCH STAFF..."
              value={selectedUser ? selectedUser.name.toUpperCase() : assigneeSearch}
              onChange={(e) => { setSelectedUser(null); setAssigneeSearch(e.target.value); setShowAssigneeDropdown(true); }}
              onFocus={() => setShowAssigneeDropdown(true)}
            />
            {showAssigneeDropdown && (
              <div className={dropdownStyle}>
                {filteredUsers.length === 0 ? (
                  <p className="p-4 text-[9px] font-black uppercase text-black/20 text-center">No staff found</p>
                ) : filteredUsers.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setShowAssigneeDropdown(false); setAssigneeSearch(''); }}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-between"
                  >
                    <span className="text-[10px] font-bold uppercase">{u.name}</span>
                    <span className="text-[7px] font-black uppercase text-[#A68342] opacity-60">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Billing Options */}
          <div className="bg-white/50 border border-[#C5A059]/20 p-4 rounded-2xl space-y-3">
             <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isBillable" 
                  className="w-5 h-5 accent-[#C5A059] rounded cursor-pointer"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                />
                <label htmlFor="isBillable" className="text-[9px] font-black text-black uppercase tracking-widest cursor-pointer">
                   Billable to Client?
                </label>
             </div>
             
             {isBillable && (
                <div className="animate-in slide-in-from-top-2">
                   <label className={labelStyle}>Client Price (€)</label>
                   <input 
                     type="number" 
                     step="0.01"
                     placeholder="0.00"
                     className={inputStyle}
                     value={billablePrice}
                     onChange={(e) => setBillablePrice(e.target.value)}
                   />
                   <p className="text-[7px] text-[#A68342] mt-2 italic font-medium">
                      * This task will appear as a line item on the client invoice.
                   </p>
                </div>
             )}
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button 
            onClick={handleSave}
            className="flex-1 bg-black text-[#C5A059] font-black py-4 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-2xl active:scale-95 transition-all"
          >
            Deploy Task
          </button>
          <button 
            onClick={onClose}
            className="px-8 border border-black/10 text-black/40 font-black py-4 rounded-2xl uppercase tracking-widest text-[9px]"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTaskModal;