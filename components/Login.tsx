
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData: any) => void;
  onSignupClick?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignupClick }) => {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- ACTIVATION STATE ---
  const [isActivationMode, setIsActivationMode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  
  // Activation Form Fields
  const [actName, setActName] = useState('');
  const [actPhone, setActPhone] = useState('');
  const [actAddress, setActAddress] = useState('');
  const [actDob, setActDob] = useState('');
  const [actMarital, setActMarital] = useState('Single');
  const [actIdNumber, setActIdNumber] = useState('');
  const [actIban, setActIban] = useState('');
  const [actPass, setActPass] = useState('');
  const [actPassConfirm, setActPassConfirm] = useState('');

  const labelStyle = "text-[9px] font-black text-black uppercase tracking-[0.4em] italic mb-2.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-black text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#A68342] transition-all placeholder:text-black/10 shadow-sm";
  const buttonStyle = "w-full bg-[#A68342] text-white font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[11px] shadow-xl hover:bg-[#8B6B2E] transition-all active:scale-[0.98]";
  const cardStyle = "w-full bg-[#FDF8EE] p-10 md:p-12 rounded-[56px] border border-[#D4B476]/30 shadow-2xl relative space-y-10 text-left";

  // Check for invitation code on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setIsVerifyingCode(true);
      fetch(`/api/auth/verify-invite?code=${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.email) {
            setIsActivationMode(true);
            setEmailInput(data.email);
            setActName(data.name || '');
          } else {
            alert('Invalid or expired invitation link.');
            // Clean URL
            window.history.replaceState({}, document.title, "/");
          }
        })
        .catch(() => {
          alert('Error verifying invitation.');
        })
        .finally(() => setIsVerifyingCode(false));
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.user?.status === 'pending') {
           // Redirect to activation manually if they try to login before activating
           setIsActivationMode(true);
           setActName(data.user.name); 
           setIsLoading(false);
           return;
        }
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      onLogin(data.user, data.organization);
    } catch (err: any) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actPass !== actPassConfirm) {
        alert("Passwords do not match.");
        return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailInput, 
          password: actPass,
          details: { 
              name: actName, 
              phone: actPhone, 
              address: actAddress,
              dateOfBirth: actDob,
              maritalStatus: actMarital,
              idPassportNumber: actIdNumber,
              iban: actIban
          } 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      // Clean URL
      window.history.replaceState({}, document.title, "/");

      onLogin(data.user, data.organization);
    } catch (err: any) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  if (isVerifyingCode) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-10">
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#C5A059]">Verifying Invite...</p>
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
             <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                
                {/* 1. Identity */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2">1. Identity Verification</h3>
                    <div>
                        <label className={labelStyle}>Verify Full Name</label>
                        <input required className={inputStyle} value={actName} onChange={e => setActName(e.target.value)} />
                    </div>
                    <div>
                        <label className={labelStyle}>Account Email</label>
                        <input className={`${inputStyle} bg-gray-50 text-gray-500`} value={emailInput} disabled />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Date of Birth</label>
                            <input required type="date" className={inputStyle} value={actDob} onChange={e => setActDob(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelStyle}>ID / Passport No.</label>
                            <input required className={inputStyle} value={actIdNumber} onChange={e => setActIdNumber(e.target.value)} placeholder="NO SPACES" />
                        </div>
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
                </div>

                {/* 2. Contact & Payroll */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2 pt-2">2. Contact & Payroll</h3>
                    <div>
                        <label className={labelStyle}>Mobile Number</label>
                        <input required type="tel" className={inputStyle} value={actPhone} onChange={e => setActPhone(e.target.value)} placeholder="+356..." />
                    </div>
                    <div>
                        <label className={labelStyle}>Residential Address</label>
                        <input required className={inputStyle} value={actAddress} onChange={e => setActAddress(e.target.value)} placeholder="Full address..." />
                    </div>
                    <div>
                        <label className={labelStyle}>IBAN (For Salary)</label>
                        <input className={inputStyle} value={actIban} onChange={e => setActIban(e.target.value)} placeholder="MT..." />
                    </div>
                </div>

                {/* 3. Security */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-black/20 tracking-widest border-b border-gray-100 pb-2 pt-2">3. Account Security</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Create Password</label>
                            <input required type="password" className={inputStyle} value={actPass} onChange={e => setActPass(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelStyle}>Confirm Password</label>
                            <input required type="password" className={inputStyle} value={actPassConfirm} onChange={e => setActPassConfirm(e.target.value)} />
                        </div>
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
            <div className="space-y-4">
              <div><label className={labelStyle}>EMAIL ID</label><input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required className={inputStyle} /></div>
              <div><label className={labelStyle}>PASSWORD</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} /></div>
            </div>
            <div className="pt-2 space-y-4">
              <button type="submit" disabled={isLoading} className={buttonStyle}>{isLoading ? 'VERIFYING...' : 'ENTER STUDIO'}</button>
              {onSignupClick && (
                <button type="button" onClick={onSignupClick} className="w-full bg-[#1A1A1A] text-[#C5A059] font-black py-4 rounded-3xl uppercase tracking-[0.3em] text-[9px] shadow-lg border border-[#C5A059]/20 hover:bg-black transition-all">
                  REGISTER NEW STUDIO
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
