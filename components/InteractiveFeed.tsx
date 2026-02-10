
import React, { useState, useRef } from 'react';
import { FeedItem, TabType, User } from '../types';
import { uploadFile } from '../services/storageService';

interface InteractiveFeedProps {
  items: FeedItem[];
  currentUser: User;
  onLike: (itemId: string) => void;
  onNavigate: (tab: TabType, id?: string) => void;
  onPostManual?: (post: Partial<FeedItem>) => void;
  maxHeight?: string;
}

const InteractiveFeed: React.FC<InteractiveFeedProps> = ({ items, currentUser, onLike, onNavigate, onPostManual, maxHeight = "600px" }) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<FeedItem['type']>('update');
  const [imgUrl, setImgUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canPost = ['admin', 'hr', 'housekeeping'].includes(currentUser.role);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const handlePost = () => {
    if (!content.trim() || !title.trim()) return;
    onPostManual?.({
      title,
      content,
      type,
      imageUrl: imgUrl || undefined,
      timestamp: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userPhoto: currentUser.photoUrl,
      likes: []
    });
    setContent('');
    setTitle('');
    setImgUrl('');
    setIsExpanding(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFile(file);
      setImgUrl(url);
    } catch (err) {
      alert("Photo failed to attach.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* COMPOSER (Visible to Leadership) */}
      {canPost && onPostManual && (
        <div className={`bg-white border-2 border-teal-50 rounded-[2rem] p-6 shadow-sm transition-all duration-500 overflow-hidden ${isExpanding ? 'ring-4 ring-teal-50 border-teal-500' : ''}`}>
           {!isExpanding ? (
             <button onClick={() => setIsExpanding(true)} className="w-full flex items-center gap-4 text-left group">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold shrink-0">
                  {currentUser.photoUrl ? <img src={currentUser.photoUrl} className="w-full h-full object-cover rounded-xl" /> : currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 bg-slate-50 px-5 py-3 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:bg-slate-100 transition-colors">
                  Share a milestone or update...
                </div>
             </button>
           ) : (
             <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                   <p className="text-[8px] font-black text-teal-600 uppercase tracking-[0.4em]">Post to Stream</p>
                   <button onClick={() => setIsExpanding(false)} className="text-slate-300 hover:text-slate-900">&times;</button>
                </div>
                <div className="flex gap-2 mb-2">
                   {['update', 'milestone', 'achievement', 'alert'].map(t => (
                     <button 
                       key={t}
                       onClick={() => setType(t as any)}
                       className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}
                     >
                       {t}
                     </button>
                   ))}
                </div>
                <input 
                  autoFocus
                  placeholder="HEADING..." 
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-teal-500"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
                <textarea 
                  placeholder="What's happening in the Studio?" 
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500 h-24"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
                
                {imgUrl && (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                    <img src={imgUrl} className="w-full h-full object-cover" />
                    <button onClick={() => setImgUrl('')} className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full text-xs">×</button>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                   <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-[9px] font-black text-slate-400 hover:text-teal-600 uppercase tracking-widest">
                      {isUploading ? '⌛ Uploading...' : '📷 Attach Photo'}
                   </button>
                   <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                   <button 
                     disabled={!content.trim() || !title.trim()}
                     onClick={handlePost} 
                     className="bg-teal-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30"
                   >
                     Post Broadcast
                   </button>
                </div>
             </div>
           )}
        </div>
      )}

      {/* FEED STREAM */}
      <div className="flex flex-col space-y-4 overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight }}>
        {items.length === 0 ? (
          <div className="py-20 text-center opacity-20">
             <p className="text-sm font-black uppercase tracking-[0.4em]">Awaiting Operations Pulse...</p>
          </div>
        ) : (
          items.map((item) => {
            const isLiked = item.likes.includes(currentUser.id);
            return (
              <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-500 animate-in slide-in-from-bottom-4">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold shrink-0 border border-teal-100 overflow-hidden shadow-inner">
                      {item.userPhoto ? <img src={item.userPhoto} className="w-full h-full object-cover" /> : item.userName.charAt(0)}
                   </div>
                   <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{item.userName}</p>
                            <p className="text-[8px] font-bold text-teal-600 uppercase tracking-widest">{formatTime(item.timestamp)}</p>
                         </div>
                         <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${
                            item.type === 'milestone' ? 'bg-emerald-50 text-emerald-600' :
                            item.type === 'achievement' ? 'bg-amber-50 text-amber-600' :
                            item.type === 'alert' ? 'bg-rose-50 text-rose-600' :
                            'bg-indigo-50 text-indigo-600'
                         }`}>
                            {item.type}
                         </span>
                      </div>
                      
                      <h4 className="text-sm font-black text-slate-900 uppercase mt-2 tracking-tight">{item.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.content}</p>

                      {item.imageUrl && (
                         <div className="mt-4 rounded-2xl overflow-hidden border border-slate-100 shadow-sm aspect-video bg-slate-50 cursor-pointer" onClick={() => item.linkTab && onNavigate(item.linkTab, item.linkId)}>
                            <img src={item.imageUrl} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" alt="Update view" />
                         </div>
                      )}

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
                         <button 
                           onClick={() => onLike(item.id)}
                           className={`flex items-center gap-1.5 transition-all active:scale-90 ${isLiked ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}
                         >
                            <span className="text-base">{isLiked ? '❤️' : '🤍'}</span>
                            <span className="text-[10px] font-black">{item.likes.length}</span>
                         </button>
                         {item.linkTab && (
                            <button 
                              onClick={() => onNavigate(item.linkTab!, item.linkId)}
                              className="text-[9px] font-black text-teal-600 uppercase tracking-widest hover:underline"
                            >
                               View Detail →
                            </button>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InteractiveFeed;
