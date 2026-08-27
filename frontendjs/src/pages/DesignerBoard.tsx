import React, { useState, useEffect } from 'react';
import { Brain, Image as ImageIcon, Upload, CheckCircle2, Clock, ChevronRight, MessageSquare, Target, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePosts } from '../context/PostsContext';
import { useClient } from '../context/ClientContext';
import { format } from 'date-fns';

export function DesignerBoard() {
  const { posts, addPost } = usePosts();
  const { activeClient } = useClient();
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Filter posts that are placeholders waiting for design
  const pendingDesigns = posts.filter(p => p.is_placeholder && p.status === 'draft');

  const handleFulfill = async () => {
    if (!uploadFile || !selectedPost) return;
    setLoading(true);
    try {
      // Use the existing addPost which handles multi-part form data
      // Passing the ID will trigger the UPDATE/FULFILL logic in postRoutes.js
      await addPost({
        id: selectedPost.id,
        content: selectedPost.content, // AI generated caption
        platforms: selectedPost.platforms,
        date: new Date(selectedPost.date),
        file: uploadFile,
        status: 'scheduled', // Auto-move to scheduled status
        is_placeholder: false,
        client_id: activeClient.id
      });
      setSelectedPost(null);
      setUploadFile(null);
      alert("✅ Post has been fulfilled and moved to the Content Calendar!");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0 pb-12">
      {/* Left: Queue of Strategic Tasks */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex items-center justify-between sticky top-0 bg-slate-50/50 backdrop-blur-sm pb-4 z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Design Fulfillment</h1>
            <p className="text-slate-500 text-sm">Fulfill the strategic month plan for {activeClient.name}.</p>
          </div>
          <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {pendingDesigns.length} Tasks Pending
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pendingDesigns.map((task) => (
            <button
              key={task.id}
              onClick={() => setSelectedPost(task)}
              className={cn(
                "bg-white p-6 rounded-3xl border text-left transition-all hover:shadow-md flex items-center justify-between group",
                selectedPost?.id === task.id ? "border-indigo-600 ring-4 ring-indigo-50 shadow-sm" : "border-slate-100"
              )}
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                      {task.funnel_stage}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Due {format(new Date(task.date), 'MMM d, p')}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 leading-tight">{task.topic}</h3>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
            </button>
          ))}
          {pendingDesigns.length === 0 && (
            <div className="py-20 text-center text-slate-400 bg-white border border-slate-100 rounded-[2.5rem]">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-20" />
              <p className="font-medium uppercase tracking-widest text-xs">All designs completed for this period!</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Fulfillment Workspace */}
      <div className="w-full lg:w-[450px]">
        {selectedPost ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 sticky top-0 space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4" /> Design Brief
              </h2>
              <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Topic</label>
                  <p className="text-sm font-bold text-slate-800">{selectedPost.topic}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Designer Instructions</label>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{selectedPost.copy_direction}</p>
                </div>
                <div className="pt-4 border-t border-slate-200/50">
                  <label className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> AI Visual Referral
                  </label>
                  <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">
                    {selectedPost.visual_idea}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Fulfill Post</h2>
              <div
                onClick={() => document.getElementById('final-upload')?.click()}
                className={cn(
                  "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:bg-slate-50",
                  uploadFile ? "border-emerald-500 bg-emerald-50/10" : "border-slate-100"
                )}
              >
                <input
                  type="file"
                  id="final-upload"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="text-xs font-bold text-emerald-700">{uploadFile.name}</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">Upload Final Graphic</p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleFulfill}
              disabled={!uploadFile || loading}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Approve & Schedule
            </button>
          </div>
        ) : (
          <div className="bg-slate-100/50 rounded-[2.5rem] border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[500px]">
            <Brain className="w-12 h-12 text-slate-200" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-[200px]">Select a task from the queue to start designing</p>
          </div>
        )}
      </div>
    </div>
  );
}
