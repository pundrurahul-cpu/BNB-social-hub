import React, { useState, useEffect } from 'react';
import {
  Zap,
  Search,
  Trash2,
  RefreshCw,
  Heart,
  MessageSquare,
  Brain,
  ExternalLink,
  Loader2,
  TrendingUp,
  AlertCircle,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClient } from '../context/ClientContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface TrackedReel {
  id: string;
  url: string;
  username: string;
  caption: string;
  like_count: number;
  comments_count: number;
  sentiment_stats: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  };
  last_analyzed_at: string;
}

export function ReelIntelligence() {
  const { activeClient } = useClient();
  const [url, setUrl] = useState('');
  const [reels, setReels] = useState<TrackedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReels = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/api/reels?client_id=${activeClient.id}`);
      if (response.ok) {
        const data = await response.json();
        setReels(data);
      }
    } catch (err) {
      console.error('Failed to fetch reels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, [activeClient]);

  const handleAddReel = async () => {
    if (!url || !activeClient) return;
    setIsAdding(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5001/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, client_id: activeClient.id })
      });

      if (response.ok) {
        const data = await response.json();
        setReels([data, ...reels]);
        setUrl('');
      } else {
        const data = await response.json();
        setError(data.error || `Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setError('Connection to server failed.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const response = await fetch(`http://localhost:5001/api/reels/${id}/analyze`, {
        method: 'POST'
      });
      if (response.ok) {
        const updated = await response.json();
        setReels(reels.map(r => r.id === id ? updated : r));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/reels/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setReels(reels.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-100">
               <Zap className="w-6 h-6" />
            </div>
            Reel Intelligence Watchlist
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Track performance and public sentiment of any Instagram Reel.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Start Performance Tracking
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste Instagram Reel or Post URL here..."
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
            />
          </div>
          <button
            onClick={handleAddReel}
            disabled={isAdding || !url}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center gap-2"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusIcon className="w-5 h-5" />}
            Track Performance
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-rose-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Syncing Watchlist...</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-200 rounded-[2.5rem]">
             <Zap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Your performance watchlist is empty.</p>
          </div>
        ) : (
          reels.map((reel) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={reel.id}
              className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm group hover:shadow-xl hover:border-indigo-100 transition-all flex flex-col"
            >
              <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-xs font-black text-slate-900">@{reel.username}</span>
                  </div>
                  <a href={reel.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed italic line-clamp-2">"{reel.caption || 'No caption available'}"</p>
              </div>

              <div className="p-6 flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center gap-2 text-rose-500 mb-1">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Likes</span>
                      </div>
                      <p className="text-xl font-black text-slate-900">{(reel.like_count || 0).toLocaleString()}</p>
                   </div>
                   <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center gap-2 text-indigo-500 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Comments</span>
                      </div>
                      <p className="text-xl font-black text-slate-900">{(reel.comments_count || 0).toLocaleString()}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Brain className="w-3.5 h-3.5 text-violet-500" /> Sentiment Health
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {reel.sentiment_stats?.total || 0} Analyzed
                      </span>
                   </div>
                   <div className="space-y-2">
                      <SentimentBar label="Positive" value={reel.sentiment_stats?.positive || 0} total={reel.sentiment_stats?.total || 0} color="bg-emerald-500" />
                      <SentimentBar label="Negative" value={reel.sentiment_stats?.negative || 0} total={reel.sentiment_stats?.total || 0} color="bg-rose-500" />
                   </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                   <Clock className="w-3.5 h-3.5" />
                   {formatDistanceToNow(new Date(reel.last_analyzed_at), { addSuffix: true })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnalyze(reel.id)}
                    disabled={analyzingId === reel.id}
                    className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all hover:shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-4 h-4", analyzingId === reel.id && "animate-spin")} />
                  </button>
                  <button
                    onClick={() => handleDelete(reel.id)}
                    className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 transition-all hover:shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SentimentBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
        <span>{label}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn("h-full", color)}
        />
      </div>
    </div>
  );
}
