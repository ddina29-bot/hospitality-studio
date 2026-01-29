
import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData: any) => void;
  onSignupClick?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignupClick }) => {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isActivationMode, setIsActivationMode] = useState(false);
  
  // Activation State
  const [actName, setActName] = useState('');
  const [actPhone, setActPhone] = useState('');
  const [actAddress, setActAddress] = useState('');
  const [actPass, setActPass] = useState('');

  const labelStyle = "text-[9px] font-black text-black uppercase tracking-[0.4em] italic mb-2.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-black text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#A68342] transition-all placeholder:text-black/10 shadow-sm";
  const buttonStyle = "w-full bg-[#A68342] text-white font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[11px] shadow-xl hover:bg-[#8B6B2E] transition-all active:scale-[0.98]";
  const cardStyle = "w-full bg-[#FDF8EE] p-10 md:p-12 rounded-[56px] border border-[#D4B476]/30 shadow-2xl relative space-y-10 text-left";

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
           // Redirect to activation
           setIsActivationMode(true);
           setActName(data.user.name); // Prefill
           setIsLoading(false);
           return;
        }
        throw new Error(data.error || 'Login failed');
      }

      // CRITICAL: Save session data for components that rely on it (like StaffHub)
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
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailInput, 
          password: actPass,
          details: { name: actName, phone: actPhone, address: actAddress } 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // CRITICAL: Save session data for components that rely on it
      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      onLogin(data.user, data.organization);
    } catch (err: any) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  const handleSystemReset = async () => {
    if (!confirm("⚠️ DANGER: This will delete ALL users, organizations, and data from the system.\n\nYou will need to sign up again.\n\nAre you sure?")) return;
    try {
        const res = await fetch('/api/auth/nuke-system', { method: 'POST' });
        if (res.ok) {
            localStorage.clear();
            alert("System has been wiped. You can now sign up again.");
            window.location.reload();
        } else {
            alert("Failed to reset.");
        }
    } catch (e) {
        alert("Error resetting system. Server might be unreachable.");
    }
  };

  if (isActivationMode) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-10 font-sans">
        <div className="max-w-[500px] w-full space-y-8 animate-in slide-in-from-bottom-10 duration-700">
          <div className="text-center">
            <p className="text-[#A68342] font-black uppercase tracking-[0.5em] text-[10px] mb-2">Invite Accepted</p>
            <h1 className="text-3xl font-serif-brand text-black tracking-tighter uppercase font-bold">ACTIVATE ACCOUNT</h1>
          </div>
          <form onSubmit={handleActivationSubmit} className={cardStyle}>
             <div className="space-y-4">
                <div><label className={labelStyle}>Confirm Full Name</label><input required className={inputStyle} value={actName} onChange={e => setActName(e.target.value)} /></div>
                <div><label className={labelStyle}>Set Mobile Number</label><input required className={inputStyle} value={actPhone} onChange={e => setActPhone(e.target.value)} /></div>
                <div><label className={labelStyle}>Residential Address</label><input required className={inputStyle} value={actAddress} onChange={e => setActAddress(e.target.value)} /></div>
                <div><label className={labelStyle}>Create Password</label><input required type="password" className={inputStyle} value={actPass} onChange={e => setActPass(e.target.value)} /></div>
             </div>
             <button type="submit" disabled={isLoading} className={buttonStyle}>{isLoading ? 'ACTIVATING...' : 'ENTER STUDIO'}</button>
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
          
          <div className="text-center">
             <button type="button" onClick={handleSystemReset} className="text-[8px] font-black text-red-300 uppercase tracking-widest hover:text-red-600 transition-colors py-2 px-4 border border-transparent hover:border-red-100 rounded-lg">
                EMERGENCY SYSTEM RESET
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
