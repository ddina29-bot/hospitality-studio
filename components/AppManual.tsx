
import React, { useState } from 'react';

const AppManual: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'System Overview' },
    { id: 'field_ops', title: 'Cleaner Field Ops & GPS' },
    { id: 'scheduling', title: 'Scheduling & Audits' },
    { id: 'logistics', title: 'Logistics & Drivers' },
    { id: 'reporting', title: 'Incident & Damage Logs' },
    { id: 'intel', title: 'Intelligence Portal' }, // New
    { id: 'finance', title: 'Finance & Payroll' },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Welcome to Reset Studio v3.2</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              Reset Hospitality Studio is a comprehensive Operations Operating System (OOS) designed to manage premium short-term rental cleaning, logistics, and maintenance.
              This centralized platform connects administrative command with field personnel in real-time.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#FDF8EE] rounded-2xl border border-[#D4B476]/30">
                <h4 className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-widest mb-2">For Management</h4>
                <p className="text-[10px] text-black/60">Full oversight of schedules, staff, payroll, asset quality control, and incident resolution.</p>
              </div>
              <div className="p-4 bg-[#FDF8EE] rounded-2xl border border-[#D4B476]/30">
                <h4 className="text-[10px] font-black text-[#8B6B2E] uppercase tracking-widest mb-2">For Field Staff</h4>
                <p className="text-[10px] text-black/60">Mobile-optimized portals for checking in, viewing tasks, reporting damages, and supply chain logistics.</p>
              </div>
            </div>
          </div>
        );
      case 'field_ops':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Cleaner Field Operations</h3>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    <h4 className="text-[9px] font-black text-red-600 uppercase tracking-widest">Geofence Security Protocol</h4>
                </div>
                <p className="text-[10px] text-black/60">
                    The system actively monitors GPS location during shift execution. If a staff member attempts to upload mandatory evidence while <strong>&gt;50 meters</strong> away from the property coordinates, the shift is <strong>automatically rejected</strong> and flagged for audit.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <h4 className="text-[9px] font-black text-black uppercase tracking-widest mb-1">1. Remedial Shifts (To Fix)</h4>
                <p className="text-[10px] text-black/60">When a shift is rejected, a "TO FIX" shift is generated. Cleaners must upload specific "Proof of Correction" photos matching the Supervisor's rejection notes.</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <h4 className="text-[9px] font-black text-black uppercase tracking-widest mb-1">2. Mandatory Evidence</h4>
                <p className="text-[10px] text-black/60">Dynamic checklists based on property size. Camera-only uploads required for Bed Styling, Bathroom Hygiene, and Keybox Closure.</p>
              </div>
            </div>
          </div>
        );
      case 'scheduling':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Scheduling Center</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              The core of operations. Use the "Schedule" tab to assign staff to properties.
            </p>
            <ul className="list-disc list-inside text-xs text-black/70 space-y-2 mt-2">
              <li><strong>Drafts vs. Published:</strong> Shifts created are drafts (yellow) until published. Staff cannot see drafts.</li>
              <li><strong>Publishing:</strong> Use "Publish Day" to finalize a specific date, or "Publish Week" to go live with the entire week's roster.</li>
              <li><strong>Audit Scheduling:</strong> Create "TO CHECK APARTMENT" shifts to assign supervisors for independent quality checks.</li>
            </ul>
          </div>
        );
      case 'logistics':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Logistics & Drivers</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              Drivers use the "Logistics Portal" to manage efficient routing for keys and linen.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-3 border border-gray-200 rounded-xl">
                    <h5 className="text-[9px] font-bold uppercase">Keys from Office</h5>
                    <p className="text-[9px] text-black/60 mt-1">Drivers must explicitly track keys taken from HQ. If keys are not marked "RETURNED" by end of shift, an alert is raised.</p>
                </div>
                <div className="p-3 border border-gray-200 rounded-xl">
                    <h5 className="text-[9px] font-bold uppercase">Standalone Tasks</h5>
                    <p className="text-[9px] text-black/60 mt-1">Ad-hoc tasks (e.g., "Buy Batteries") created by management appear in the driver's route alongside linen drops.</p>
                </div>
            </div>
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Incident & Damage Reporting</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              Field staff report issues directly from their active shift dashboard. These reports are aggregated in the <strong>Incident Logs</strong> tab.
            </p>
            <div className="grid grid-cols-1 gap-3 mt-4">
               <div className="flex items-center gap-4 p-3 border border-blue-100 rounded-xl bg-blue-50">
                  <span className="text-[9px] font-black text-blue-600 uppercase min-w-[80px]">Maintenance</span>
                  <p className="text-[9px] text-black/60">Broken appliances, leaks, WiFi issues. (Assigned to Maintenance Team or Outsourced Vendors).</p>
               </div>
               <div className="flex items-center gap-4 p-3 border border-orange-100 rounded-xl bg-orange-50">
                  <span className="text-[9px] font-black text-orange-600 uppercase min-w-[80px]">Damage</span>
                  <p className="text-[9px] text-black/60">Guest caused damage requiring deposit deduction or repair.</p>
               </div>
               <div className="flex items-center gap-4 p-3 border border-purple-100 rounded-xl bg-purple-50">
                  <span className="text-[9px] font-black text-purple-600 uppercase min-w-[80px]">Missing Item</span>
                  <p className="text-[9px] text-black/60">Theft or loss. Categorized as "From Apartment" or "For Laundry" (e.g. missing linen bag).</p>
               </div>
            </div>
          </div>
        );
      case 'intel':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Intelligence Portal (Reports)</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              The central data hub for historical analysis.
            </p>
            <ul className="list-disc list-inside text-xs text-black/70 space-y-3 mt-2">
              <li><strong>Incident Logs:</strong> A consolidated view of all active and resolved Maintenance, Damage, and Missing item reports. Filter by status (Open/Sorted).</li>
              <li><strong>Personnel:</strong> Staff records grouped by department (Cleaning, Logistics, Management). View individual ratings and attendance gaps.</li>
              <li><strong>Logistics Archive:</strong> Historical view of driver routes. See exactly where a driver went on a specific past date and what they delivered.</li>
              <li><strong>Audit History:</strong> Pass/Fail rates for properties based on Supervisor inspections.</li>
            </ul>
          </div>
        );
      case 'finance':
        return (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xl font-serif-brand font-bold text-black uppercase">Finance & Payroll</h3>
            <p className="text-xs text-black/70 leading-relaxed">
              Automated financial tracking for staff remuneration and client billing.
            </p>
            <div className="mt-4 space-y-3">
               <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1">Performance Bonus Logic</p>
                  <p className="text-[9px] text-black/60">
                    If (Property Rate / Team Size) &gt; (Hourly Rate * Hours Worked), the difference is paid as a <strong>Performance Bonus</strong>. 
                    Rejected shifts revert to standard Base Hourly Pay.
                  </p>
               </div>
               <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1">Documentation</p>
                  <p className="text-[9px] text-black/60">
                    System automatically generates monthly <strong>Worksheets</strong> and annual <strong>FS3</strong> tax forms for all employees.
                  </p>
               </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-140px)] animate-in fade-in duration-700">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-[#FDF8EE] border border-[#D4B476]/30 rounded-[32px] p-6 shadow-xl flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="mb-6">
           <h2 className="text-lg font-serif-brand font-bold text-black uppercase">System Manual</h2>
           <p className="text-[8px] font-black text-[#8B6B2E] uppercase tracking-[0.3em] opacity-60">Usage Guide v3.2</p>
        </div>
        <nav className="space-y-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeSection === section.id
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-black/40 hover:bg-white hover:text-black'
              }`}
            >
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white border border-gray-100 rounded-[32px] p-8 md:p-12 shadow-2xl overflow-y-auto custom-scrollbar relative">
         <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
            <svg width="300" height="300" viewBox="0 0 24 24" fill="black"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
         </div>
         <div className="relative z-10 max-w-2xl">
            {renderContent()}
         </div>
      </div>
    </div>
  );
};

export default AppManual;
