
import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User, orgData?: any) => void;
  onSignupClick: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSignupClick }) => {
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
            
            <button 
              type="button"
              onClick={onSignupClick}
              className="w-full text-slate-400 hover:text-teal-600 transition-colors py-2 text-[9px] font-black uppercase tracking-widest"
            >
              New Studio? Create Organization
            </button>
          </div>
          
          <div className="pt-4 text-center">
             <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.5em] animate-pulse">Session Encrypted • Production v1.0</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
