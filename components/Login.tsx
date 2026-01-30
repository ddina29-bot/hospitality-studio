
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData: any) => void;
  onSignupClick: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignupClick }) => {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // --- ACTIVATION STATE ---
  const [isActivationMode, setIsActivationMode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  
  // Activation Form Fields
  const [actName, setActName] = useState('');
  const [actPhone, setActPhone] = useState('');
  const [actAddress, setActAddress] = useState('');
  const [actDob, setActDob] = useState('');
  const [actMarital, setActMarital] = useState('Single');
  const [actIsParent, setActIsParent] = useState(false);
  const [actIdNumber, setActIdNumber] = useState('');
  const [actIban, setActIban] = useState('');
  const [actPass, setActPass] = useState('');
  const [actPassConfirm, setActPassConfirm] = useState('');

  const labelStyle = "text-[9px] font-black text-black uppercase tracking-[0.4em] italic mb-2.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-black text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#A68342] transition-all placeholder:text-black/10 shadow-sm";
  // Password inputs should NOT be uppercase to avoid confusion
  const passwordInputStyle = "w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-black text-[11px] font-bold outline-none focus:border-[#A68342] transition-all placeholder:text-black/10 shadow-sm"; 
  const buttonStyle = "w-full bg-[#A68342] text-white font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[11px] shadow-xl hover:bg-[#8B6B2E] transition-all active:scale-[0.98]";
  const cardStyle = "w-full bg-[#FDF8EE] p-10 md:p-12 rounded-[56px] border border-[#D4B476]/30 shadow-2xl relative space-y-10 text-left";

  // Check for invitation code on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let code = params.get('code');
    
    if (code) {
      if (code.includes('?code=')) {
         try {
            const url = new URL(code);
            const realCode = url.searchParams.get('code');
            if (realCode) code = realCode;
         } catch (e) {
            const parts = code.split('?code=');
            if (parts.length > 1) code = parts[1];
         }
      }

      setIsVerifyingCode(true);
      setErrorMsg(null);

      fetch(`/api/auth/verify-invite?code=${code}`)
        .then(async (res) => {
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Server connection error. Please try again.');
            }
            if (!res.ok) {
                throw new Error(data.error || 'Invalid or expired link');
            }
            return data;
        })
        .then(data => {
          if (data.email) {
            setIsActivationMode(true);
            setEmailInput(data.email);
            setActName(data.name || '');
          } else {
            throw new Error('Invalid invitation data received.');
          }
        })
        .catch((err) => {
          console.error("Verification Error:", err);
          setErrorMsg(err.message || "Invitation link expired or invalid.");
          window.history.replaceState({}, document.title, "/");
        })
        .finally(() => setIsVerifyingCode(false));
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    
    // TRIM INPUTS TO FIX "INVALID CREDENTIALS"
    const cleanEmail = emailInput.trim();
    const cleanPassword = password.trim(); 

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // If server says unauthorized but status is pending, redirect to activation
        if (data.user?.status === 'pending') {
           setIsActivationMode(true);
           setActName(data.user.name); 
           setIsLoading(false);
           return;
        }
        throw new Error(data.error || 'Login failed');
      }

      // CRITICAL FIX: If server returns success but user is PENDING, force activation flow.
      if (data.user.status === 'pending') {
           setIsActivationMode(true);
           setActName(data.user.name); 
           setIsLoading(false);
           return;
      }

      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      onLogin(data.user, data.organization);
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
      setIsLoading(false);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    const cleanPass = actPass.trim();
    const cleanPassConfirm = actPassConfirm.trim();

    if (cleanPass !== cleanPassConfirm) {
        setErrorMsg("Passwords do not match.");
        return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailInput.trim(), 
          password: cleanPass,
          details: { 
              name: actName, 
              phone: actPhone, 
              address: actAddress,
              dateOfBirth: actDob,
              maritalStatus: actMarital,
              isParent: actIsParent,
              idPassportNumber: actIdNumber,
              iban: actIban
          } 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      window.history.replaceState({}, document.title, "/");
      onLogin(data.user, data.organization);
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsLoading(false);
    }
  };

  if (isVerifyingCode) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-10">
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#C5A059]">Syncing Invite...</p>
            </div>
        </div>
      );
  }

  if (isActivationMode) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-10 font-sans">
        <div className="max-w-[600px] w-full space-y-8 animate-in slide-in-from-bottom-10 duration-700 my-auto">
          <div className="text-center">
            <p className="text-[#A68342] font-black uppercase tracking-[0.5em] text-[10px] mb-2">Employee Onboarding</p>
            <h1 className="text-3xl font-serif-brand text-black tracking-tighter uppercase font-bold">COMPLETE PROFILE</h1>
          </div>
          <form onSubmit={handleActivationSubmit} className={cardStyle}>
             {errorMsg && (
               <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center border border-red-100">
                 {errorMsg}
               </div>
             )}
             <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2">1. Identity Verification</h3>
                    <div><label className={labelStyle}>Verify Full Name</label><input required className={inputStyle} value={actName} onChange={e => setActName(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelStyle}>Date of Birth</label><input required type="date" className={inputStyle} value={actDob} onChange={e => setActDob(e.target.value)} /></div>
                        <div><label className={labelStyle}>ID / Passport No.</label><input required className={inputStyle} value={actIdNumber} onChange={e => setActIdNumber(e.target.value)} placeholder="NO SPACES" /></div>
                    </div>
                    <div>
                        <label className={labelStyle}>Marital Status (For Tax)</label>
                        <select className={inputStyle} value={actMarital} onChange={e => setActMarital(e.target.value)}>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Separated">Separated</option>
                            <option value="Widowed">Widowed</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" className="w-5 h-5 accent-[#A68342] rounded" checked={actIsParent} onChange={e => setActIsParent(e.target.checked)} />
                        <label className="text-[10px] font-bold uppercase text-black">I am a parent (Apply Parent Rates)</label>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2 pt-2">2. Contact & Payroll</h3>
                    <div><label className={labelStyle}>Mobile Number</label><input required type="tel" className={inputStyle} value={actPhone} onChange={e => setActPhone(e.target.value)} placeholder="+356..." /></div>
                    <div><label className={labelStyle}>Residential Address</label><input required className={inputStyle} value={actAddress} onChange={e => setActAddress(e.target.value)} placeholder="Full address..." /></div>
                    <div><label className={labelStyle}>IBAN (For Salary)</label><input className={inputStyle} value={actIban} onChange={e => setActIban(e.target.value)} placeholder="MT..." /></div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2 pt-2">3. Account Security</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelStyle}>Create Password</label><input required type="password" className={passwordInputStyle} value={actPass} onChange={e => setActPass(e.target.value)} placeholder="Case sensitive" /></div>
                        <div><label className={labelStyle}>Confirm Password</label><input required type="password" className={passwordInputStyle} value={actPassConfirm} onChange={e => setActPassConfirm(e.target.value)} /></div>
                    </div>
                </div>
             </div>
             <button type="submit" disabled={isLoading} className={buttonStyle}>{isLoading ? 'ACTIVATING...' : 'COMPLETE SETUP'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden text-black font-sans">
      <div className="max-w-[420px] w-full relative z-10 flex flex-col items-center">
        <div className="w-full space-y-12 animate-in slide-in-from-bottom-10 duration-700">
          <div className="text-center">
            <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
              <span className="text-black/30 text-[10px] font-black tracking-[0.4em] mb-1">RESET</span>
              <span className="text-black font-bold text-4xl tracking-tighter">HOSPITALITY</span>
              <span className="text-black/60 text-base italic tracking-[0.2em] font-bold">STUDIO</span>
            </h1>
          </div>

          <form onSubmit={handleLoginSubmit} className={cardStyle}>
            {errorMsg && (
               <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-center border border-red-100 mb-4 animate-in fade-in">
                 {errorMsg}
               </div>
            )}
            
            <div className="space-y-4">
              <div><label className={labelStyle}>EMAIL ID</label><input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required className={inputStyle} /></div>
              <div className="relative">
                <label className={labelStyle}>PASSWORD</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={passwordInputStyle} placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-10 text-[9px] font-bold text-black/30 hover:text-black uppercase">
                    {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            
            <div className="pt-2 space-y-4">
              <button type="submit" disabled={isLoading} className={buttonStyle}>{isLoading ? 'VERIFYING...' : 'ENTER STUDIO'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
