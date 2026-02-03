import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const Assistant: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: "Welcome to RESET Assistant. Ask me anything about our cleaning protocols, logistics, or company standards." }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
            systemInstruction: "You are the Operations Assistant for RESET HOSPITALITY STUDIO. You help staff in Malta with cleaning procedures, logistics, and company culture. Be professional, concise, and helpful. If asked about maps, tell them to use the built-in navigation buttons."
        }
      });
      
      setMessages(prev => [...prev, { role: 'ai', text: response.text || "I couldn't process that. Please try again." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Service temporarily offline. Ensure your API key is enabled." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-6 bg-teal-900 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-xl shadow-inner border border-teal-700">✨</div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight">Studio AI Agent</h3>
            <p className="text-[8px] font-bold text-teal-400 uppercase tracking-widest">Operational Intelligence</p>
          </div>
        </div>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 opacity-50"></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-4 rounded-[2rem] text-sm shadow-sm ${
              m.role === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
            }`}>
              <p className="leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white px-5 py-4 rounded-[2rem] border border-slate-100 rounded-tl-none flex gap-2">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-2 items-center">
          <input 
            className="flex-1 bg-transparent px-4 py-2 text-sm outline-none font-medium placeholder:text-slate-300" 
            placeholder="Ask anything..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-teal-900 text-white flex items-center justify-center hover:bg-teal-800 active:scale-90 transition-all disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;