
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { uploadFile } from '../services/storageService';

interface UserActivationProps {
  token: string;
  onActivationComplete: (user: User, orgData?: any) => void;
  onCancel: () => void;
}

const UserActivation: React.FC<UserActivationProps> = ({ token, onActivationComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tempUser, setTempUser] = useState<{name: string, role: string, email: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Split date state for better UX
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const [formData, setFormData] = useState({
    password: '',
    phone: '+356 ',
    homeAddress: '',
    idPassportNumber: '',
    maritalStatus: 'Single',
    isParent: false,
    photoUrl: ''
  });

  // Date constants
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];
    for (let i = currentYear - 16; i >= currentYear - 75; i--) arr.push(i);
    return arr;
  }, []);

  const months = [
    { v: '01', l: 'January' }, { v: '02', l: 'February' }, { v: '03', l: 'March' },
    { v: '04', l: 'April' }, { v: '05', l: 'May' }, { v: '06', l: 'June' },
    { v: '07', l: 'July' }, { v: '08', l: 'August' }, { v: '09', l: 'September' },
    { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' }
  ];

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  useEffect(() => {
    // SECURITY: Clear any old session data immediately 
    localStorage.clear();
    
    const verifyToken = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout rescue

        const response = await fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`, {
            signal: controller.signal
        });
        const data = await response.json();
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          setError(data.error || 'Invalid or expired activation link.');
          setIsVerifying(false);
          return;
        }

        setTempUser(data);
        setIsVerifying(false);
      } catch (err: any) {
        console.error("Verification Hang/Error:", err);
        setError("Network error verifying link. Please check your internet or reload the page.");
        setIsVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setFormData(prev => ({ ...prev, photoUrl: url }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.password || formData.password.length < 6) {
        alert("Please choose a secure password (min 6 characters).");
        return;
      }
      if (formData.phone.trim().length < 8) {
        alert("Please enter a valid phone number.");
        return;
      }
      if (!birthDay || !birthMonth || !birthYear) {
        alert("Full date of birth is required.");
        return;
      }
    }
    if (step === 2) {
      if (!formData.homeAddress) {
        alert("Permanent home address is required.");
        return;
      }
      if (!formData.idPassportNumber) {
        alert("ID or Passport number is mandatory.");
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handleFinalize = async () => {
    setError(null);
    setIsLoading(true);

    const fullDob = `${birthYear}-${birthMonth}-${birthDay}`;

    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          profileData: { ...formData, dateOfBirth: fullDob }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Activation failed.');
      }

      onActivationComplete(data.user, data.organization);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const labelStyle = "text-[8px] font-black text-teal-600 uppercase tracking-[0.4em] mb-2 block px-1";
  const inputStyle = "w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-teal-50 transition-all placeholder:text-slate-300";
  const selectStyle = "w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-xs font-bold outline-none focus:border-[#0D9488] transition-all";

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center space-y-6">
           <div className="w-16 h-16 border-4 border-teal-50 border-t-teal-600 rounded-full animate-spin mx-auto"></div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">SECURE SYSTEM INITIALIZATION...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8EE] p-8">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] border border-rose-100 shadow-2xl text-center space-y-6">
           <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-sm">!</div>
           <div className="space-y-2">
             <h2 className="text-2xl font-bold uppercase text-slate-900 tracking-tight">Deployment Failed</h2>
             <p className="text-sm text-slate-500 font-medium leading-relaxed">{error}</p>
           </div>
           <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="flex-1 bg-teal-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Retry Link</button>
                <button onClick={onCancel} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Home</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
      <div className="max-w-xl w-full space-y-10 animate-in slide-in-from-bottom-8 duration-700 py-10">
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#0D9488] rounded-[1.5rem] flex items-center justify-center text-white text-3xl font-black mx-auto shadow-xl mb-6">R</div>
          <h1 className="font-brand text-3xl text-slate-900 tracking-tight uppercase">USER DEPLOYMENT</h1>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.5em]">WELCOME, {tempUser?.name.toUpperCase()}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{tempUser?.role.toUpperCase()} • PHASE {step} OF 3</p>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-2xl text-left">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Identity & Security</h3>
                  <p className="text-xs text-slate-400 font-medium">Initialize your credentials for the RESET Studio network.</p>
               </div>
               <div className="space-y-5">
                  <div>
                    <label className={labelStyle}>Access Key (Password)</label>
                    <input type="password" className={inputStyle} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="MIN 6 CHARACTERS" />
                  </div>
                  <div>
                        <label className={labelStyle}>Maltese Phone Number</label>
                        <input type="tel" className={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className={labelStyle}>Date of Birth</label>
                    <div className="grid grid-cols-3 gap-3">
                        <select className={selectStyle} value={birthDay} onChange={e => setBirthDay(e.target.value)}>
                            <option value="">Day</option>
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select className={selectStyle} value={birthMonth} onChange={e => setBirthMonth(e.target.value)}>
                            <option value="">Month</option>
                            {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <select className={selectStyle} value={birthYear} onChange={e => setBirthYear(e.target.value)}>
                            <option value="">Year</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                  </div>
               </div>
               <button onClick={handleNext} className="w-full btn-teal py-5 shadow-xl shadow-teal-900/10 text-xs uppercase tracking-[0.3em] font-bold">Continue Phase</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Legal Registry</h3>
                  <p className="text-xs text-slate-400 font-medium">Maltese employment compliance and tax band registry.</p>
               </div>
               <div className="space-y-5">
                  <div>
                    <label className={labelStyle}>Permanent Home Address</label>
                    <input className={inputStyle} value={formData.homeAddress} onChange={e => setFormData({...formData, homeAddress: e.target.value})} placeholder="STREET, TOWN, POSTCODE" />
                  </div>
                  <div>
                    <label className={labelStyle}>ID Card / Passport Number</label>
                    <input className={inputStyle} value={formData.idPassportNumber} onChange={e => setFormData({...formData, idPassportNumber: e.target.value})} placeholder="E.G. 123456M" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>Marital Status</label>
                        <select className={inputStyle} value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})}>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Separated">Separated</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-4 bg-teal-50/50 p-4 rounded-2xl border border-teal-100/50 h-[60px] self-end">
                        <input type="checkbox" id="parentCheck" className="w-6 h-6 accent-[#0D9488] cursor-pointer" checked={formData.isParent} onChange={e => setFormData({...formData, isParent: e.target.checked})} />
                        <label htmlFor="parentCheck" className="text-[10px] font-bold text-teal-800 uppercase tracking-widest cursor-pointer leading-tight">Tax: I have children</label>
                    </div>
                  </div>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="px-6 py-5 border border-slate-100 text-slate-300 rounded-2xl uppercase text-[10px] font-bold tracking-widest">Back</button>
                  <button onClick={handleNext} className="flex-1 btn-teal py-5 shadow-xl shadow-teal-900/10 text-xs uppercase tracking-[0.3em] font-bold">Review Profile</button>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Final Registry</h3>
                  <p className="text-xs text-slate-400 font-medium">Verify your profile metadata to finalize deployment.</p>
               </div>
               <div className="space-y-6">
                  <div className="flex items-center gap-6 p-8 bg-teal-50/30 rounded-[2rem] border border-teal-100/50">
                    <div className="w-24 h-24 rounded-[1.5rem] bg-white border-2 border-dashed border-teal-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                       {formData.photoUrl ? (
                         <img src={formData.photoUrl} className="w-full h-full object-cover" alt="Preview" />
                       ) : (
                         <div className="text-center opacity-30">
                            <span className="text-4xl block mb-1">📷</span>
                            <span className="text-[8px] font-black uppercase">Optional</span>
                         </div>
                       )}
                    </div>
                    <div className="flex-1">
                       <label className="text-[9px] font-black text-teal-800 uppercase mb-2 block tracking-widest">Profile Picture</label>
                       <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-[10px] text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer" />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                     <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Confirmation Summary</p>
                     <div className="grid grid-cols-2 gap-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Status</p>
                        <p className="text-[10px] font-bold text-teal-600 uppercase text-right">READY TO DEPLOY</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Phone</p>
                        <p className="text-[10px] font-bold text-slate-900 uppercase text-right">{formData.phone}</p>
                     </div>
                  </div>
               </div>

               <div className="pt-4 space-y-4">
                  <button 
                    onClick={handleFinalize} 
                    disabled={isLoading}
                    className="w-full btn-teal py-6 shadow-2xl shadow-teal-900/20 text-xs uppercase tracking-[0.4em] flex items-center justify-center gap-4 active:scale-[0.98] transition-all font-black"
                  >
                    {isLoading ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                         <span>ACTIVATING...</span>
                       </>
                    ) : "FINALIZE & DEPLOY"}
                  </button>
                  <button onClick={() => setStep(2)} className="w-full text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors">Return to Phase 2</button>
               </div>
            </div>
          )}
        </div>
        
        <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.6em] text-center animate-pulse">PROTOCOL: SECURE_ONBOARDING_MALTA_V3</p>
      </div>
    </div>
  );
};

export default UserActivation;
