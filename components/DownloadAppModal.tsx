
import React, { useState } from 'react';

interface DownloadAppModalProps {
  onClose: () => void;
}

const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ onClose }) => {
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  return (
    <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
      <div className="bg-[#1A1A1A] border border-[#C5A059]/30 rounded-[40px] w-full max-w-md p-8 md:p-10 space-y-8 shadow-2xl relative text-center">
        <button onClick={onClose} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="space-y-2">
          <div className="w-16 h-16 bg-[#C5A059] rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(197,160,89,0.3)] mb-4">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          </div>
          <h2 className="text-2xl font-serif-brand font-bold text-white uppercase tracking-tight">Studio Mobile</h2>
          <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.4em]">Install Native App Experience</p>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
           <button 
             onClick={() => setPlatform('ios')}
             className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${platform === 'ios' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
           >
             iOS / iPhone
           </button>
           <button 
             onClick={() => setPlatform('android')}
             className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${platform === 'android' ? 'bg-[#C5A059] text-black' : 'text-white/40 hover:text-white'}`}
           >
             Android
           </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-left space-y-4">
           {platform === 'ios' ? (
             <>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold shrink-0">1</div>
                  <p className="text-xs text-white/80 leading-relaxed">Open this page in <strong className="text-white">Safari</strong> browser.</p>
               </div>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold shrink-0">2</div>
                  <p className="text-xs text-white/80 leading-relaxed">Tap the <strong className="text-white">Share</strong> icon (square with arrow) at the bottom.</p>
               </div>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold shrink-0">3</div>
                  <p className="text-xs text-white/80 leading-relaxed">Scroll down and select <strong className="text-white">"Add to Home Screen"</strong>.</p>
               </div>
             </>
           ) : (
             <>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-bold shrink-0">1</div>
                  <p className="text-xs text-white/80 leading-relaxed">Open this page in <strong className="text-[#C5A059]">Chrome</strong> browser.</p>
               </div>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-bold shrink-0">2</div>
                  <p className="text-xs text-white/80 leading-relaxed">Tap the <strong className="text-[#C5A059]">Three Dots</strong> menu at the top right.</p>
               </div>
               <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-bold shrink-0">3</div>
                  <p className="text-xs text-white/80 leading-relaxed">Select <strong className="text-[#C5A059]">"Install App"</strong> or "Add to Home Screen".</p>
               </div>
             </>
           )}
        </div>

        <button onClick={onClose} className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-white transition-colors">Dismiss</button>
      </div>
    </div>
  );
};

export default DownloadAppModal;
