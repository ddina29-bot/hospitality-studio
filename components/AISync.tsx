import React, { useState, useRef, useEffect } from 'react';
import { askHRAssistant } from '../services/geminiService';
import { Message } from '../types';

const AISync: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'STUDIO AI',
      text: "Welcome to the RESET HOSPITALITY STUDIO Intel Hub. I am synchronized with all premium SOPs and deployment schedules. How may I refine your operational intelligence today?",
      timestamp: new Date().toLocaleTimeString(),
      isAi: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'You',
      text: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiResponseText = await askHRAssistant(input);

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'STUDIO AI',
      text: aiResponseText || "Communication error. Studio protocols remain unchanged.",
      timestamp: new Date().toLocaleTimeString(),
      isAi: true,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-180px)] bg-black rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="bg-[#0a0a0a] border-b border-[#C5A059]/20 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#C5A059] rounded-lg flex items-center justify-center text-black shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <div>
            <h3 className="font-serif-brand text-white uppercase text-sm tracking-widest">STUDIO INTELLIGENCE</h3>
            <p className="text-[8px] text-[#C5A059] font-black uppercase tracking-[0.3em]">SOP Engine v3.1</p>
          </div>
        </div>
        <div className="flex gap-2">
            <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isAi ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-6 shadow-xl ${
              msg.isAi 
                ? 'bg-[#111111] border border-white/5 text-white/80 rounded-tl-none font-medium' 
                : 'bg-[#C5A059] text-black rounded-tr-none font-serif-brand italic shadow-[0_10px_30px_-10px_rgba(197,160,89,0.3)]'
            }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div className="flex items-center justify-between mt-4">
                 <p className={`text-[8px] font-black uppercase tracking-[0.2em] opacity-40 ${msg.isAi ? 'text-white' : 'text-black'}`}>
                    {msg.sender === 'You' ? 'Verified Input' : 'Studio Acknowledgment'}
                 </p>
                 <p className={`text-[8px] font-black uppercase tracking-widest opacity-40 ${msg.isAi ? 'text-white' : 'text-black'}`}>
                    {msg.timestamp}
                 </p>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#111111] border border-white/5 rounded-2xl rounded-tl-none p-6 shadow-sm">
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-bounce delay-150"></div>
                <div className="w-1.5 h-1.5 bg-[#C5A059] rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-[#0a0a0a] border-t border-white/5">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query Studio protocols..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-5 pl-8 pr-16 focus:ring-1 focus:ring-[#C5A059] focus:border-[#C5A059] outline-none transition-all text-sm text-white placeholder:text-white/10 font-medium"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-3 p-4 bg-[#C5A059] text-black rounded-lg hover:bg-[#d4b476] transition-all active:scale-95 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em] text-center mt-4">
          RESET STUDIO PROPRIETARY INTEL CORE
        </p>
      </div>
    </div>
  );
};

export default AISync;