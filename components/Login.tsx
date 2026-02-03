
import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  onSignupClick: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@studio.com');
  const [password, setPassword] = useState('password');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      id: 'u1',
      name: 'Operations Manager',
      email: email,
      role: 'admin',
      status: 'active'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-10 animate-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-[#0D9488] rounded-[2rem] mx-auto flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-teal-900/20 mb-6">R</div>
          <h1 className="font-brand font-bold text-4xl text-slate-900 tracking-tight uppercase">RESET</h1>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.5em] mt-1">HOSPITALITY STUDIO</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8 text-left">
          <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] px-2">Operator ID</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-[#0D9488] transition-all uppercase tracking-widest placeholder:text-slate-300" />
            </div>
            <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] px-2">Access Key</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 border border-transparent rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:bg-white focus:border-[#0D9488] transition-all uppercase tracking-widest placeholder:text-slate-300" />
            </div>
          </div>
          
          <button type="submit" className="w-full btn-teal py-5 shadow-2xl shadow-teal-900/20 text-xs uppercase tracking-[0.3em]">Initialize</button>
          
          <div className="pt-4 text-center">
             <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.5em] animate-pulse">Session Encrypted • v3.8</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
