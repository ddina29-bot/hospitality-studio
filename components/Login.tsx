
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData?: any) => void;
  onSignupClick: () => void;
  onDemoLogin?: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onDemoLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoChoices, setShowDemoChoices] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#F0FDFA] flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-10 animate-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-[#0D9488] rounded-[2rem] mx-auto flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-teal-900/20 mb-6">R</div>
          <h1 className="font-brand font-bold text-4xl text-[#1E293B] tracking-tight uppercase">RESET</h1>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.5em] mt-1">HOSPITALITY STUDIO</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border border-teal-100 shadow-2xl space-y-8 text-left">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl text-[10px] font-black uppercase text-center animate-in fade-in">
              {error}
            </div>
          )}
          
          {!showDemoChoices ? (
            <>
              <div className="space-y-6">
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
              </div>
              
              <div className="space-y-4">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full btn-teal py-5 shadow-2xl shadow-teal-900/20 text-xs uppercase tracking-[0.3em] disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Log in'}
                </button>

                {onDemoLogin && (
                  <button 
                    type="button"
                    onClick={() => setShowDemoChoices(true)}
                    className="w-full py-4 border-2 border-teal-50 text-teal-600 rounded-2xl text-[9px] font-black uppercase tracking-[0.4em] hover:bg-teal-50 hover:border-teal-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    Enter Preview Mode
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Select Perspective</h3>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed">Choose a persona to explore the interface.</p>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { role: 'admin', icon: '💼', desc: 'Manage assets, staff & finance' },
                    { role: 'cleaner', icon: '🧹', desc: 'Checklists, GPS & reporting' },
                    { role: 'driver', icon: '🚚', desc: 'Deliveries & logistics routes' },
                    { role: 'laundry', icon: '🧺', desc: 'Linen preparation & damage logs' }
                  ].map((p) => (
                    <button 
                      key={p.role}
                      type="button"
                      onClick={() => onDemoLogin?.(p.role as UserRole)}
                      className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-teal-500 hover:bg-white transition-all text-left group active:scale-95"
                    >
                       <span className="text-2xl">{p.icon}</span>
                       <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{p.role}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{p.desc}</p>
                       </div>
                    </button>
                  ))}
               </div>
               <button 
                type="button"
                onClick={() => setShowDemoChoices(false)}
                className="w-full py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-600 transition-colors"
               >
                 Cancel
               </button>
            </div>
          )}
          
          <div className="pt-4 text-center">
             <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.5em] animate-pulse">Session Encrypted • Production v1.0</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
