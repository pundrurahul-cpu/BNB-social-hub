import React, { useRef, useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Clock,
  Send,
  MonitorSmartphone,
  X,
  CheckCircle2,
  Plus,
  AlertCircle,
  Linkedin,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Pin,
  Brain,
  Loader2,
  ScrollText,
  Palette,
  Target,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { usePosts } from '../context/PostsContext';
import { useClient } from '../context/ClientContext';
import { Platform } from '../types';
import { format } from 'date-fns';

const ALL_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: FacebookIcon },
  { id: 'instagram', name: 'Instagram', icon: InstagramIcon },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { id: 'pinterest', name: 'Pinterest', icon: Pin },
];

interface Connection {
  id: string;
  platform: string;
  platform_account_name: string;
  metadata?: {
    profile_picture?: string;
    pages?: any[];
    instagram_accounts?: any[];
  };
}

interface ComposerProps {
  editingPostId?: string;
}

export function Composer({ editingPostId }: ComposerProps) {
  const { addPost, posts } = usePosts();
  const { activeClient } = useClient();

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook']);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const [strategyData, setStrategyData] = useState<any>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [postMetadata, setPostMetadata] = useState<any>(null);
  const [postStatus, setPostStatus] = useState<string>('draft');

  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [toastMessage, setToastMessage] = useState<{message: string, isError: boolean} | null>(null);
  const [isAiRefining, setIsAiRefining] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/connections');
        if (response.ok) {
          const data = await response.json();
          setConnections(data);
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error);
      }
    };
    fetchConnections();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlatformDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingPostId) {
      const post = posts.find(p => p.id === editingPostId);
      if (post) {
        setContent(post.content || '');
        setSelectedPlatforms(post.platforms as string[]);
        setPostStatus(post.status);
        setPostMetadata(post.metadata);
        if (post.date) {
          setScheduledDate(new Date(post.date).toISOString().slice(0, 16));
        }
        setIsPlaceholder(post.is_placeholder);
        // V1000.11: Capture the full expert brief
        setStrategyData({
          topic: post.topic,
          direction: post.copy_direction,
          visual: post.visual_idea,
          funnel: post.funnel_stage
        });
        if (post.mediaUrl) setMediaUrl(post.mediaUrl);
      }
    }
  }, [editingPostId, posts]);

  const isPlatformConnected = (platformId: string) => {
    if (platformId === 'instagram') {
       const fb = connections.find(c => c.platform === 'facebook');
       return !!fb?.metadata?.instagram_accounts?.length;
    }
    return connections.some(c => c.platform === platformId);
  };

  const showToast = (message: string, isError = false) => {
    setToastMessage({message, isError});
    setTimeout(() => setToastMessage(null), 6000);
  };

  const handleAction = async (status: 'draft' | 'published' | 'scheduled') => {
    if (!activeClient?.id) {
      showToast("❌ No Client Selected! Please select a client in the sidebar first.", true);
      return;
    }

    if (!content.trim() && !selectedFile && !mediaUrl) {
      showToast("Please add content or an image.", true);
      return;
    }

    if (status === 'scheduled' && !scheduledDate) {
      showToast("Please pick a Date & Time in the right sidebar.", true);
      return;
    }

    try {
      const postData = {
        id: editingPostId,
        content,
        title: title || strategyData?.topic || "",
        platforms: selectedPlatforms as Platform[],
        status,
        date: scheduledDate ? new Date(scheduledDate) : new Date(),
        mediaUrl: mediaUrl,
        file: selectedFile,
        is_placeholder: false,
        client_id: activeClient.id
      };

      await addPost(postData as any);
      showToast(status === 'published' ? "🚀 Published!" : "📅 Saved to Calendar!");

      if (!editingPostId) {
        setContent('');
        setSelectedFile(null);
        setMediaUrl(null);
      }
    } catch (error: any) {
      showToast(`❌ Error: ${error.message || "Database rejected the save."}`, true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMediaUrl(URL.createObjectURL(file));
    }
  };

  const handleAiRefinement = async () => {
    if (!selectedFile && !mediaUrl) {
      showToast("Upload an image first for AI refinement.", true);
      return;
    }

    setIsAiRefining(true);
    try {
      const formData = new FormData();
      let response;

      if (selectedFile) {
        formData.append('image', selectedFile);
        response = await fetch('http://localhost:5001/api/ai/enhance', { method: 'POST', body: formData });
      } else {
        response = await fetch('http://localhost:5001/api/ai/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: mediaUrl }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        setContent(data.caption);
        showToast("✨ AI Enhanced successfully!");
      } else {
        throw new Error('AI Service busy');
      }
    } catch (error) {
      showToast("AI is busy. Try again in a moment.", true);
    } finally {
      setIsAiRefining(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 bg-slate-50/50 p-6">
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">

        {isPlaceholder && (
          <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 rounded-t-2xl space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Brain className="w-5 h-5 text-indigo-600" />
                   <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Market Expert Strategy Brief</h3>
                </div>
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded uppercase tracking-tighter">
                  {strategyData?.funnel || 'Awareness'} Stage
                </span>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                      <ScrollText className="w-2.5 h-2.5" /> Copy Direction
                   </label>
                   <p className="text-[10px] text-slate-700 font-bold leading-relaxed line-clamp-2">
                     {strategyData?.direction || "Focus on authority and educational value."}
                   </p>
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                      <Palette className="w-2.5 h-2.5" /> Visual Concept
                   </label>
                   <p className="text-[10px] text-slate-700 font-bold italic leading-relaxed line-clamp-2">
                     {strategyData?.visual || "Clean, high-end professional aesthetic."}
                   </p>
                </div>
             </div>
          </div>
        )}

        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/30">
          <div className="flex flex-wrap items-center gap-2 relative">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2">Post to:</span>
            {selectedPlatforms.map(platformId => (
              <button key={platformId} onClick={() => setSelectedPlatforms(prev => prev.filter(id => id !== platformId))} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white flex items-center gap-1.5 transition-all">
                {platformId} <X className="w-3 h-3" />
              </button>
            ))}
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowPlatformDropdown(!showPlatformDropdown)} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 flex items-center gap-1 bg-white text-slate-500 hover:bg-slate-50">
                <Plus className="w-3 h-3" /> Add
              </button>
              <AnimatePresence>
                {showPlatformDropdown && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] p-2">
                    {ALL_PLATFORMS.map(p => (
                      <button key={p.id} disabled={selectedPlatforms.includes(p.id)} onClick={() => { setSelectedPlatforms([...selectedPlatforms, p.id]); setShowPlatformDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-50 flex items-center justify-between group disabled:opacity-30">
                        <div className="flex items-center gap-2"> <p.icon className="w-3.5 h-3.5" /> {p.name} </div>
                        {isPlatformConnected(p.id) ? <div className="w-2 h-2 rounded-full bg-emerald-500" /> : <AlertCircle className="w-3 h-3 text-slate-300" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 flex flex-col relative min-h-[400px]">
          {postStatus === 'published' && postMetadata && (
            <div className="mb-6 flex flex-wrap gap-3">
              {postMetadata.instagram && (
                <a
                  href={postMetadata.instagram.permalink || `https://www.instagram.com/p/${postMetadata.instagram.platform_post_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-colors border border-pink-100"
                >
                  <InstagramIcon className="w-3.5 h-3.5" /> View on Instagram <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {postMetadata.facebook && (
                <a
                  href={postMetadata.facebook.permalink || `https://www.facebook.com/${postMetadata.facebook.platform_post_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors border border-blue-100"
                >
                  <FacebookIcon className="w-3.5 h-3.5" /> View on Facebook <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Finalize your high-converting copy here..." className="flex-1 resize-none outline-none text-slate-700 text-lg placeholder:text-slate-300 w-full leading-relaxed" />
          {mediaUrl && (
            <div className="relative mt-4 w-64 h-64 rounded-2xl border-2 border-slate-100 overflow-hidden group shadow-md">
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => {setMediaUrl(null); setSelectedFile(null);}} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <button onClick={() => document.getElementById('designer-upload')?.click()} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700">
              <ImageIcon className="w-4 h-4" /> Upload Final Graphic
              <input type="file" id="designer-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </button>
            <button onClick={handleAiRefinement} disabled={isAiRefining} className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200">
              {isAiRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-violet-500" />}
              AI Context Refiner
            </button>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[420px] flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Workflow Actions</h2>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-indigo-500" /> Set Post Schedule
            </label>
            <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <button onClick={() => handleAction('scheduled')} className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-emerald-700">
               <CheckCircle2 className="w-4 h-4" /> Approve & Fix
             </button>
             <button onClick={() => handleAction('published')} className="flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800">
               <Send className="w-4 h-4" /> Post Now
             </button>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] flex flex-col p-8 items-center justify-center relative min-h-[500px] shadow-sm">
          <div className="absolute top-6 left-8 flex items-center gap-2 text-slate-400">
            <MonitorSmartphone className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-widest">Live Preview</span>
          </div>
          <div className="w-[280px] h-[500px] bg-white rounded-[3rem] shadow-2xl border-[8px] border-slate-900 overflow-hidden flex flex-col relative scale-[0.98]">
             <div className="p-5 flex-1 overflow-y-auto">
               <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{content || 'Caption preview...'}</p>
               {mediaUrl && <img src={mediaUrl} className="mt-4 rounded-xl w-full" />}
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }} className={cn("fixed bottom-10 left-1/2 flex items-center gap-3 font-bold px-6 py-4 rounded-2xl shadow-2xl z-50 text-sm", toastMessage.isError ? "bg-rose-600 text-white" : "bg-slate-900 text-white")}>
            {toastMessage.isError ? <X className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toastMessage.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
