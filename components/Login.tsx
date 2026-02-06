
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData?: any) => void;
  onSignupClick: () => void;
  onDemoLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignupClick, onDemoLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user, data.organization);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const demoRoles: { role: UserRole; label: string; sub: string; icon: string }[] = [
    { role: 'housekeeping', label: 'Operations / Admin', sub: 'Scheduling & Management', icon: '🏢' },
    { role: 'cleaner', label: 'Cleaning Staff', sub: 'Field Checklists & Photos', icon: '🧹' },
    { role: 'driver', label: 'Logistics / Driver', sub: 'Routes & Deliveries', icon: '🚚' },
    { role: 'laundry', label: 'Laundry Specialist', sub: 'Linen Prep & Damage Logs', icon: '🧺' },
  ];

  return (
    <div className="min-h-screen bg-[#F0FDFA] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full space-y-8 animate-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0D9488] rounded-[1.5rem] md:rounded-[2rem] mx-auto flex items-center justify-center text-white text-3xl md:text-4xl font-black shadow-2xl shadow-teal-900/20 mb-4 md:mb-6">R</div>
          <h1 className="font-brand font-bold text-3xl md:text-4xl text-[#1E293B] tracking-tight uppercase">RESET</h1>
          <p className="text-[9px] md:text-[10px] font-bold text-teal-600 uppercase tracking-[0.5em] mt-1">HOSPITALITY STUDIO</p>
        </div>

        {!showDemoOptions ? (
          <div className="bg-white p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-teal-100 shadow-2xl space-y-6 md:space-y-8 text-left">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl text-[10px] font-black uppercase text-center animate-in fade-in">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] px-2">Operator ID</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    disabled={isLoading}
                    placeholder="name@reset.studio"
                    className="w-full bg-[#F0FDFA] border border-transparent rounded-2xl px-6 py-4 text-sm font-semibold text-[#1E293B] outline-none focus:bg-white focus:border-[#0D9488] transition-all uppercase tracking-widest placeholder:text-slate-300" 
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] px-2">Access Key</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    disabled={isLoading}
                    placeholder="••••••••"
                    className="w-full bg-[#F0FDFA] border border-transparent rounded-2xl px-6 py-4 text-sm font-semibold text-[#1E293B] outline-none focus:bg-white focus:border-[#0D9488] transition-all uppercase tracking-widest placeholder:text-slate-300" 
                  />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full btn-teal py-5 shadow-2xl shadow-teal-900/20 text-xs uppercase tracking-[0.3em] disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Log in'}
              </button>
            </form>

            <button 
              type="button"
              onClick={() => setShowDemoOptions(true)}
              className="w-full bg-slate-900 text-white border border-slate-700 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
              <span className="text-amber-400 group-hover:animate-pulse">✨</span>
              Explore Live Demo
              <span className="text-amber-400 group-hover:animate-pulse">✨</span>
            </button>
            
            <div className="space-y-4">
              <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest text-slate-300"><span className="bg-white px-4">OR</span></div>
              </div>
              
              <button 
                type="button"
                onClick={onSignupClick}
                disabled={isLoading}
                className="w-full bg-teal-50 text-teal-700 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] active:scale-95 transition-all disabled:opacity-50 border border-teal-100"
              >
                Create New Organization
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-teal-100 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-slate-900 uppercase">Select Demo Perspective</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Experience specific team interfaces</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {demoRoles.map((d) => (
                <button
                  key={d.role}
                  onClick={() => onDemoLogin(d.role)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-[#F0FDFA] hover:border-[#0D9488] transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">{d.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{d.label}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{d.sub}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-300 group-hover:text-[#0D9488] group-hover:translate-x-1 transition-all"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowDemoOptions(false)}
              className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors"
            >
              Back to Secure Login
            </button>
          </div>
        )}
        
        <div className="text-center">
           <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.5em] animate-pulse">Session Encrypted • Production v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
