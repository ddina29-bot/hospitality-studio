
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  initialActivationUser?: User | null;
  onSignupClick?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, users, setUsers, initialActivationUser, onSignupClick }) => {
  const [nameInput, setNameInput] = useState('');
  const [password, setPassword] = useState('');
  const [isPendingFlow, setIsPendingFlow] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newMaritalStatus, setNewMaritalStatus] = useState('Single');
  const [newIsParent, setNewIsParent] = useState(false);

  useEffect(() => {
    if (initialActivationUser) {
      setPendingUser(initialActivationUser);
      setIsPendingFlow(true);
      setNewPhone(initialActivationUser.phone || '');
      setNewWhatsapp(initialActivationUser.whatsappNumber || '');
      setNewMaritalStatus(initialActivationUser.maritalStatus || 'Single');
      setNewAddress(initialActivationUser.address || '');
      setNewDob(initialActivationUser.dateOfBirth || '');
      setNewIsParent(initialActivationUser.isParent || false);
    }
  }, [initialActivationUser]);

  const labelStyle = "text-[9px] font-black text-black uppercase tracking-[0.4em] italic mb-2.5 block px-1";
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-black text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#A68342] transition-all placeholder:text-black/10 shadow-sm";
  const buttonStyle = "w-full bg-[#A68342] text-white font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[11px] shadow-xl hover:bg-[#8B6B2E] transition-all active:scale-[0.98]";
  const cardStyle = "w-full bg-[#FDF8EE] p-10 md:p-12 rounded-[56px] border border-[#D4B476]/30 shadow-2xl relative space-y-10 text-left";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search by Name instead of Email
    const existingUser = users.find(u => u.name.toLowerCase() === nameInput.trim().toLowerCase());
    
    if (!existingUser) {
      alert('Member credentials not found in Studio directory.');
      return;
    }

    if (existingUser.status === 'inactive') {
      alert('Access revoked for this personnel ID.');
      return;
    }

    if (existingUser.status === 'pending') {
      setPendingUser(existingUser);
      setIsPendingFlow(true);
      return;
    }

    onLogin(existingUser);
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden text-black font-sans">
        <div className="max-w-[420px] w-full z-10 space-y-8 animate-in slide-in-from-bottom-10 duration-700">
          <div className="text-center mb-6">
            <span className="font-serif-brand text-4xl text-[#A68342] leading-none mb-3 tracking-tighter">RECOVERY</span>
            <h1 className="text-xl font-serif-brand text-black tracking-[0.1em] uppercase font-bold mt-2">RESET ACCESS</h1>
          </div>
          
          <div className={cardStyle + " text-center"}>
             <div className="w-16 h-16 bg-[#A68342]/10 border border-[#A68342]/20 rounded-full flex items-center justify-center mx-auto text-[#A68342] mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
             </div>
             <div className="space-y-4">
                <h3 className="text-lg font-serif-brand font-bold uppercase">Security Protocol</h3>
                <p className="text-[10px] text-black/50 leading-relaxed italic">
                   For security purposes, password resets must be authorized by your Studio Administrator or Manager. 
                   <br/><br/>
                   Please contact Administration directly to restore your access credentials.
                </p>
             </div>
             <button onClick={() => setIsForgotPassword(false)} className="w-full bg-black text-white font-black py-4 rounded-2xl text-[9px] uppercase tracking-widest hover:bg-zinc-900 transition-all mt-6 shadow-lg">RETURN TO LOGIN</button>
          </div>
        </div>
      </div>
    );
  }

  if (isPendingFlow && pendingUser) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-10 relative overflow-y-auto font-sans">
        <div className="max-w-[600px] w-full z-10 space-y-8 animate-in slide-in-from-bottom-10 duration-700 py-12">
          <div className="text-center mb-6">
            <p className="text-[#A68342] font-black uppercase tracking-[0.5em] text-[10px] mb-2">Activation portal</p>
            <h1 className="text-3xl font-serif-brand text-black tracking-tighter uppercase font-bold leading-none">WELCOME TO THE STUDIO, {pendingUser.name.toUpperCase()}</h1>
          </div>
          <form 
            onSubmit={(e) => { 
              e.preventDefault(); 
              onLogin({
                ...pendingUser, 
                status: 'active', 
                idPassportNumber: newIdNumber, 
                phone: newPhone,
                whatsappNumber: newWhatsapp,
                address: newAddress,
                maritalStatus: newMaritalStatus,
                isParent: newIsParent,
                activationDate: new Date().toISOString()
              }); 
            }} 
            className={cardStyle}
          >
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className={labelStyle}>Setup Secure Password</label>
                  <input type="password" required className={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label className={labelStyle}>ID / Passport Number</label>
                  <input required className={inputStyle} value={newIdNumber} onChange={e => setNewIdNumber(e.target.value)} placeholder="ABC123456" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>contact number</label>
                    <input required className={inputStyle} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+356 ...." />
                  </div>
                  <div>
                    <label className={labelStyle}>WhatsApp number</label>
                    <input required className={inputStyle} value={newWhatsapp} onChange={e => setNewWhatsapp(e.target.value)} placeholder="+356 ...." />
                  </div>
                </div>

                <div>
                  <label className={labelStyle}>Residential Address</label>
                  <input required className={inputStyle} value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="STREET, TOWN, POSTCODE" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className={labelStyle}>Marital Status</label>
                    <select className={inputStyle} value={newMaritalStatus} onChange={e => setNewMaritalStatus(e.target.value)}>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 px-1 pb-4">
                    <input 
                      type="checkbox" 
                      id="parent_check"
                      className="w-5 h-5 accent-[#A68342] rounded border-gray-300"
                      checked={newIsParent}
                      onChange={e => setNewIsParent(e.target.checked)}
                    />
                    <label htmlFor="parent_check" className="text-[10px] font-black text-black uppercase tracking-widest cursor-pointer">if parent check here</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-4"><button type="submit" className={buttonStyle}>ACTIVATE STUDIO ACCOUNT</button></div>
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

          <form onSubmit={handleSubmit} className={cardStyle}>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className={labelStyle}>FULL NAME</label>
                <input type="text" placeholder="ENTER YOUR FULL NAME" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required className={inputStyle} />
              </div>
              <div className="space-y-1 relative">
                <label className={labelStyle}>PASSWORD</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} />
                <div className="flex justify-end pr-1 mt-3">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[8px] font-black text-black/30 uppercase tracking-widest hover:text-black transition-all">Forgot Password?</button>
                </div>
              </div>
            </div>
            <div className="pt-2 space-y-4">
              <button type="submit" className={buttonStyle}>ENTER STUDIO</button>
              {onSignupClick && (
                <button 
                  type="button" 
                  onClick={onSignupClick}
                  className="w-full bg-[#1A1A1A] text-[#C5A059] font-black py-4 rounded-3xl uppercase tracking-[0.3em] text-[9px] shadow-lg border border-[#C5A059]/20 hover:bg-black transition-all active:scale-[0.98]"
                >
                  SIGN UP
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
