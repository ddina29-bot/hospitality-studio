
import React, { useState } from 'react';
import { User } from '../types';

interface SignupProps {
  onSignupComplete: (user: User, orgData: any) => void;
  onBackToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSignupComplete, onBackToLogin }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    address: ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.fullName || !formData.email || !formData.password)) {
      alert("Please complete all identity fields.");
      return;
    }
    if (step === 2 && (!formData.companyName)) {
      alert("Organization name is required.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleDeploy = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUser: {
            name: formData.fullName,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            address: formData.address,
            hasID: true,
            hasContract: true
          },
          organization: {
            name: formData.companyName,
            address: formData.address,
            email: formData.email,
            phone: formData.phone
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Signup failed');

      // CRITICAL: Save session data for components that rely on it
      localStorage.setItem('current_user_obj', JSON.stringify(data.user));
      localStorage.setItem('studio_org_settings', JSON.stringify(data.organization));

      // Success
      onSignupComplete(data.user, data.organization);

    } catch (error: any) {
      alert(error.message);
      setIsLoading(false);
    }
  };

  const inputStyle = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-black text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#C5A059] transition-all placeholder:text-black/10 shadow-sm";
  const labelStyle = "text-[8px] font-black text-[#A68342] uppercase tracking-[0.4em] mb-2 block px-1";

  return (
    <div className="min-h-screen bg-white flex relative overflow-hidden">
      <div className="hidden lg:flex w-1/2 bg-[#1A1A1A] relative flex-col justify-between p-16 text-white border-r border-[#C5A059]/20">
        <div className="z-10">
          <h1 className="font-serif-brand flex flex-col tracking-tight uppercase leading-none">
            <span className="text-[#C5A059] text-xs font-black tracking-[0.4em] mb-2">RESET</span>
            <span className="text-white font-bold text-5xl tracking-tighter">HOSPITALITY</span>
            <span className="text-white/40 text-3xl italic tracking-[0.2em] font-bold">STUDIO</span>
          </h1>
        </div>
        <div className="z-10 text-[9px] font-black text-white/20 uppercase tracking-widest">
          Secure Deployment • Multi-Tenant Core
        </div>
      </div>

      <div className="w-full lg:w-1/2 bg-[#FDF8EE] flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        <button 
          onClick={onBackToLogin}
          className="absolute top-8 left-8 lg:left-auto lg:right-8 text-black/30 hover:text-black transition-colors flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg> Back to Login
        </button>

        <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight mt-4">
              {step === 1 && "Administrator Identity"}
              {step === 2 && "Studio Registry"}
              {step === 3 && "Initialize Core"}
            </h2>
          </div>

          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div><label className={labelStyle}>Full Legal Name</label><input type="text" className={inputStyle} value={formData.fullName} onChange={(e) => handleChange('fullName', e.target.value)} autoFocus /></div>
              <div><label className={labelStyle}>Admin Email Address</label><input type="email" className={inputStyle} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} /></div>
              <div><label className={labelStyle}>Secure Passkey</label><input type="password" className={inputStyle} value={formData.password} onChange={(e) => handleChange('password', e.target.value)} /></div>
              <button onClick={handleNext} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl hover:bg-zinc-900 transition-all active:scale-95 mt-4">Next Step</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div><label className={labelStyle}>Organization / Studio Name</label><input type="text" className={inputStyle} value={formData.companyName} onChange={(e) => handleChange('companyName', e.target.value)} autoFocus /></div>
              <div><label className={labelStyle}>HQ Physical Address</label><input type="text" className={inputStyle} value={formData.address} onChange={(e) => handleChange('address', e.target.value)} /></div>
              <div><label className={labelStyle}>Primary Contact Phone</label><input type="tel" className={inputStyle} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
              <button onClick={handleNext} className="w-full bg-black text-[#C5A059] font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl hover:bg-zinc-900 transition-all active:scale-95 mt-4">Review Configuration</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-white border border-gray-200 p-6 rounded-3xl space-y-4 shadow-sm">
                 <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                    <div className="w-12 h-12 bg-[#C5A059] rounded-full flex items-center justify-center text-black font-serif-brand font-bold text-xl">{formData.companyName.charAt(0).toUpperCase()}</div>
                    <div><h3 className="text-sm font-bold text-black uppercase tracking-tight">{formData.companyName}</h3><p className="text-[9px] font-black text-[#A68342] uppercase tracking-widest">New Environment</p></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[7px] text-black/40 uppercase font-black tracking-widest mb-1">Administrator</p><p className="text-[10px] font-bold text-black uppercase">{formData.fullName}</p></div>
                    <div><p className="text-[7px] text-black/40 uppercase font-black tracking-widest mb-1">Access ID</p><p className="text-[10px] font-bold text-black uppercase">{formData.email}</p></div>
                 </div>
              </div>
              <button onClick={handleDeploy} disabled={isLoading} className="w-full bg-[#C5A059] text-black font-black py-5 rounded-2xl uppercase tracking-[0.4em] text-[10px] shadow-xl hover:bg-[#d4b476] transition-all active:scale-95 mt-6 flex items-center justify-center gap-3">
                {isLoading ? "DEPLOYING STUDIO..." : "DEPLOY STUDIO ENVIRONMENT"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
