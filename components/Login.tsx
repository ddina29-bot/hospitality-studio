
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData?: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-screen bg-[#F0FDFA] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full space-y-10 animate-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-[#0D9488] rounded-[2rem] mx-auto flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-teal-900/20 mb-6">R</div>
          <h1 className="font-brand font-bold text-4xl text-[#1E293B] tracking-tight uppercase">RESET</h1>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.5em] mt-1">HOSPITALITY STUDIO</p>
        </div>

        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-teal-100 shadow-2xl space-y-8 text-left relative overflow-hidden">
          {isLoading && (
             <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Verifying Node Access...</p>
             </div>
          )}

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
                  placeholder="••••••••"
                  className="w-full bg-[#F0FDFA] border border-transparent rounded-2xl px-6 py-4 text-sm font-semibold text-[#1E293B] outline-none focus:bg-white focus:border-[#0D9488] transition-all uppercase tracking-widest placeholder:text-slate-300" 
                />
            </div>
            <button 
              type="submit" 
              className="w-full btn-teal py-5 shadow-2xl shadow-teal-900/20 text-xs uppercase tracking-[0.3em]"
            >
              Log in
            </button>
          </form>
          
          <div className="pt-4 text-center">
             <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.5em] animate-pulse">Session Encrypted • Production v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
