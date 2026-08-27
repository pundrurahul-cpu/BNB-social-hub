import React, { useState } from 'react';
import { usePosts } from '../context/PostsContext';
import { FileImage, Clock, PencilLine, Download, Search, Filter, Trash2, Loader2, CheckCircle2, Facebook, Instagram, Linkedin, Monitor, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export function MediaLibrary() {
  const { posts, deletePost } = usePosts();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['local']);

  const items = posts.filter(p => p.mediaUrl || p.status === 'draft');

  const openDeleteModal = (item: any) => {
    const available: string[] = ['local'];
    if (item.metadata?.facebook) available.push('facebook');
    if (item.metadata?.instagram) available.push('instagram');
    if (item.metadata?.linkedin) available.push('linkedin');
    if (item.metadata?.pinterest) available.push('pinterest');

    setSelectedPlatforms(available);
    setShowDeleteModal(item.id);
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    try {
      setDeletingId(showDeleteModal);
      await deletePost(showDeleteModal, selectedPlatforms);
      setShowDeleteModal(null);
    } catch (error) {
      alert("Deletion failed. Please check the server logs.");
    } finally {
      setDeletingId(null);
    }
  };

  const currentItem = posts.find(p => p.id === showDeleteModal);

  return (
    <div className="space-y-6 h-full flex flex-col p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Media Library & Drafts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your cross-platform content.</p>
        </div>
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search assets..."
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-48 focus:ring-2 focus:ring-indigo-100 outline-none card-shadow"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 bg-white border border-slate-200 rounded-2xl border-dashed">
            <FileImage className="w-12 h-12 mb-4 text-slate-300" />
            <h3 className="font-semibold text-slate-700">No media found</h3>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden card-shadow group hover:shadow-md transition-all flex flex-col relative">
              <div className="aspect-square bg-slate-100 relative overflow-hidden">
                {item.mediaUrl ? (
                  <img src={item.mediaUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50 p-4 italic text-[10px] text-slate-400">
                    {item.content}
                  </div>
                )}

                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                  {item.status === 'draft' && <span className="px-2 py-1 bg-amber-500 text-white rounded text-[8px] font-bold uppercase tracking-wider">Draft</span>}
                  <div className="flex gap-1">
                    {item.metadata?.facebook && <div className="p-1 bg-blue-600 rounded text-white shadow-sm"><Facebook className="w-2.5 h-2.5" /></div>}
                    {item.metadata?.instagram && <div className="p-1 bg-gradient-to-tr from-yellow-400 to-purple-600 rounded text-white shadow-sm"><Instagram className="w-2.5 h-2.5" /></div>}
                    {item.metadata?.linkedin && <div className="p-1 bg-[#0077b5] rounded text-white shadow-sm"><Linkedin className="w-2.5 h-2.5" /></div>}
                    {item.metadata?.pinterest && <div className="p-1 bg-[#e60023] rounded text-white shadow-sm"><Pin className="w-2.5 h-2.5" /></div>}
                  </div>
                </div>

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                  <button
                    onClick={() => openDeleteModal(item)}
                    className="p-3 bg-white text-rose-600 rounded-xl hover:bg-rose-50 shadow-xl transition-all scale-90 group-hover:scale-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-3 bg-white">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                </div>
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">{item.content || 'Untitled Post'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selective Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteModal(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 p-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                   <Trash2 className="w-8 h-8" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">Delete Post</h3>
              <p className="text-slate-500 text-sm text-center mb-6">Choose locations to remove this post from:</p>

              <div className="space-y-2 mb-8">
                {/* Local Library */}
                <button
                  onClick={() => setSelectedPlatforms(prev => prev.includes('local') ? prev.filter(p => p !== 'local') : [...prev, 'local'])}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                    selectedPlatforms.includes('local') ? "border-rose-500 bg-rose-50/30" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className={cn("w-5 h-5", selectedPlatforms.includes('local') ? "text-rose-600" : "text-slate-400")} />
                    <span className={cn("text-sm font-bold", selectedPlatforms.includes('local') ? "text-rose-700" : "text-slate-600")}>Local Library</span>
                  </div>
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPlatforms.includes('local') ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200")}>
                    {selectedPlatforms.includes('local') && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                </button>

                {/* Facebook */}
                {currentItem?.metadata?.facebook && (
                  <button
                    onClick={() => setSelectedPlatforms(prev => prev.includes('facebook') ? prev.filter(p => p !== 'facebook') : [...prev, 'facebook'])}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                      selectedPlatforms.includes('facebook') ? "border-blue-500 bg-blue-50/30" : "border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Facebook className={cn("w-5 h-5", selectedPlatforms.includes('facebook') ? "text-blue-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-bold", selectedPlatforms.includes('facebook') ? "text-blue-700" : "text-slate-600")}>Facebook Page</span>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPlatforms.includes('facebook') ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200")}>
                      {selectedPlatforms.includes('facebook') && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                )}

                {/* Instagram */}
                {currentItem?.metadata?.instagram && (
                  <button
                    onClick={() => setSelectedPlatforms(prev => prev.includes('instagram') ? prev.filter(p => p !== 'instagram') : [...prev, 'instagram'])}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                      selectedPlatforms.includes('instagram') ? "border-purple-500 bg-purple-50/30" : "border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Instagram className={cn("w-5 h-5", selectedPlatforms.includes('instagram') ? "text-purple-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-bold", selectedPlatforms.includes('instagram') ? "text-purple-700" : "text-slate-600")}>Instagram</span>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPlatforms.includes('instagram') ? "border-purple-500 bg-purple-500 text-white" : "border-slate-200")}>
                      {selectedPlatforms.includes('instagram') && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                )}

                {/* LinkedIn */}
                {currentItem?.metadata?.linkedin && (
                  <button
                    onClick={() => setSelectedPlatforms(prev => prev.includes('linkedin') ? prev.filter(p => p !== 'linkedin') : [...prev, 'linkedin'])}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                      selectedPlatforms.includes('linkedin') ? "border-blue-700 bg-blue-50/30" : "border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Linkedin className={cn("w-5 h-5", selectedPlatforms.includes('linkedin') ? "text-blue-700" : "text-slate-400")} />
                      <span className={cn("text-sm font-bold", selectedPlatforms.includes('linkedin') ? "text-blue-800" : "text-slate-600")}>LinkedIn</span>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPlatforms.includes('linkedin') ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200")}>
                      {selectedPlatforms.includes('linkedin') && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                )}

                {/* Pinterest */}
                {currentItem?.metadata?.pinterest && (
                  <button
                    onClick={() => setSelectedPlatforms(prev => prev.includes('pinterest') ? prev.filter(p => p !== 'pinterest') : [...prev, 'pinterest'])}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                      selectedPlatforms.includes('pinterest') ? "border-red-600 bg-red-50/30" : "border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Pin className={cn("w-5 h-5", selectedPlatforms.includes('pinterest') ? "text-red-600" : "text-slate-400")} />
                      <span className={cn("text-sm font-bold", selectedPlatforms.includes('pinterest') ? "text-red-700" : "text-slate-600")}>Pinterest</span>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPlatforms.includes('pinterest') ? "border-red-600 bg-red-600 text-white" : "border-slate-200")}>
                      {selectedPlatforms.includes('pinterest') && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  disabled={selectedPlatforms.length === 0 || !!deletingId}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-rose-600 transition-all disabled:opacity-50 disabled:bg-slate-400 flex items-center justify-center gap-2"
                >
                  {deletingId ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete Selected"}
                </button>
                <button onClick={() => setShowDeleteModal(null)} className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
