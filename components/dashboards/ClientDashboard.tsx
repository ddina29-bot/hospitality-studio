
import React, { useState } from 'react';
import { TabType, User, Invoice } from '../../types';

interface ClientDashboardProps {
  user: User;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  invoices?: Invoice[];
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, setActiveTab, onLogout, invoices = [] }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter invoices for the logged-in client (Mock logic: matches by clientName mostly or ID if we had real link)
  // Since we don't have a direct link in User to Client ID in this mock setup easily without prop drilling deeply, 
  // we will assume the User ID matches the Invoice ClientID for demo purposes, or just show all for demo.
  // Ideally: user.relatedClientId === invoice.clientId
  const myInvoices = invoices; // Displaying all for demo since user mapping is loose in mock.

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[#C5A059] font-black uppercase tracking-[0.4em] text-[8px]">CLIENT PORTAL</p>
          <h1 className="text-xl font-serif-brand text-black tracking-tight uppercase leading-tight font-bold">
            WELCOME, <span className="text-[#C5A059] italic">{user.name.toUpperCase()}</span>
          </h1>
        </div>
        <button onClick={onLogout} className="bg-red-50 text-red-600 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest border border-red-100 active:scale-95 transition-all">EXIT</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-white/5 space-y-4 shadow-2xl">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">ACTIVE PROPERTIES</p>
          <p className="text-4xl font-serif-brand text-white font-bold">4</p>
          <button onClick={() => setActiveTab('properties')} className="text-[#C5A059] text-[9px] font-black uppercase tracking-widest underline">VIEW MY LISTINGS →</button>
        </div>
        <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-white/5 space-y-4 shadow-2xl">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">CLEANLINESS RATING</p>
          <p className="text-4xl font-serif-brand text-green-500 font-bold">4.92</p>
          <p className="text-[9px] text-white/20 uppercase">AVERAGE ACROSS STUDIO UNITS</p>
        </div>
        <div className="bg-[#C5A059] p-8 rounded-3xl text-black space-y-4 shadow-2xl relative overflow-hidden">
           <div className="relative z-10">
             <p className="text-[9px] font-black uppercase tracking-widest opacity-60">OUTSTANDING BALANCE</p>
             <p className="text-4xl font-serif-brand font-bold">€{myInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((acc, i) => acc + i.totalAmount, 0).toFixed(2)}</p>
             <p className="text-[9px] font-black uppercase tracking-[0.2em] mt-2">Next Due: 01 NOV</p>
           </div>
           <div className="absolute -right-4 -bottom-4 text-black/5 opacity-40">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#FDF8EE] p-8 rounded-[32px] border border-[#D4B476]/30 space-y-6 shadow-xl">
            <div className="flex justify-between items-center">
            <h3 className="text-xs font-serif-brand text-black uppercase font-bold tracking-widest">BILLING & INVOICES</h3>
            <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">Financial Documents</p>
            </div>
            {myInvoices.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-[9px] uppercase font-black text-black/20">No invoices available.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {myInvoices.map(inv => (
                        <div key={inv.id} className="bg-white p-4 rounded-2xl border border-[#D4B476]/10 flex justify-between items-center shadow-sm hover:border-[#C5A059]/40 transition-all">
                            <div>
                                <p className="text-[10px] font-bold text-black uppercase">{inv.invoiceNumber}</p>
                                <p className="text-[8px] text-black/40 font-black uppercase mt-0.5">{inv.issueDate}</p>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <p className="text-sm font-serif-brand font-bold text-black">€{inv.totalAmount.toFixed(2)}</p>
                                <div className="flex flex-col gap-1 items-end">
                                    <span className={`px-2 py-0.5 rounded text-[6px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : inv.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {inv.status}
                                    </span>
                                    <button onClick={() => setSelectedInvoice(inv)} className="text-[7px] font-black underline text-[#C5A059] uppercase hover:text-black">VIEW</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="bg-[#1A1A1A] p-8 rounded-[32px] border border-white/5 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
            <h3 className="text-xs font-serif-brand text-white uppercase font-bold tracking-widest">UNIT FINANCIALS</h3>
            <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-widest">Live Billing Ledger</p>
            </div>
            <div className="space-y-4">
            {[
                { property: 'VALLETTA LUXURY LOFT', cleanPrice: '€120', status: 'PAID' },
                { property: 'SLIEMA PENTHOUSE', cleanPrice: '€180', status: 'PENDING' }
            ].map((log, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5">
                    <div>
                    <p className="text-xs font-bold text-white uppercase">{log.property}</p>
                    <p className="text-[8px] text-[#C5A059] font-black uppercase tracking-widest mt-1">Maintenance Fee: {log.cleanPrice}</p>
                    </div>
                    <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${log.status === 'PAID' ? 'bg-green-500/10 text-green-500' : 'bg-[#C5A059]/10 text-[#C5A059]'}`}>{log.status}</span>
                </div>
            ))}
            </div>
        </div>
      </div>

      {/* INVOICE DETAIL MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
            <div className="bg-white rounded-[40px] w-full max-w-lg p-10 space-y-8 shadow-2xl relative text-left overflow-y-auto max-h-[90vh] custom-scrollbar">
                <button onClick={() => setSelectedInvoice(null)} className="absolute top-8 right-8 text-black/20 hover:text-black transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                
                <div className="border-b border-gray-100 pb-6 mb-6">
                    <p className="text-[8px] font-black text-[#C5A059] uppercase tracking-[0.4em] mb-2">OFFICIAL INVOICE</p>
                    <h2 className="text-3xl font-serif-brand font-bold text-black uppercase tracking-tight">{selectedInvoice.invoiceNumber}</h2>
                    <div className="flex justify-between mt-4">
                        <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">ISSUED</p>
                            <p className="text-xs font-bold text-black">{selectedInvoice.issueDate}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">DUE</p>
                            <p className="text-xs font-bold text-black">{selectedInvoice.dueDate}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[8px] font-black text-black/20 uppercase tracking-widest">ITEMIZED SERVICES</p>
                    <div className="space-y-3">
                        {selectedInvoice.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-start text-[10px] border-b border-gray-50 pb-2 last:border-0">
                                <span className="font-bold text-black uppercase max-w-[70%]">{item.description}</span>
                                <span className="font-mono text-gray-600">€{item.amount.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#FDF8EE] p-6 rounded-3xl border border-[#D4B476]/20 flex justify-between items-center">
                    <p className="text-[9px] font-black text-[#A68342] uppercase tracking-[0.2em]">TOTAL DUE</p>
                    <p className="text-3xl font-serif-brand font-bold text-black">€{selectedInvoice.totalAmount.toFixed(2)}</p>
                </div>

                <div className="text-center pt-4">
                    <button className="text-[9px] font-black text-black/30 uppercase tracking-widest underline hover:text-black">Download PDF Receipt</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
