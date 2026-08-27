import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Image as ImageIcon, Plus, Loader2, Wand2, Lightbulb, Zap, ScrollText, Palette, FileText, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClient } from '../context/ClientContext';
import { format } from 'date-fns';

interface StrategyPost {
  id: string;
  scheduled_at: string;
  funnel_stage: string;
  topic: string;
  copy_direction: string;
  visual_idea: string;
  content: string;
  post_type: string;
  strategic_goal: string;
  status: string;
  is_placeholder: boolean;
  metadata?: {
    alternative_variations?: string[];
    engine?: string;
    marketing_logic?: string;
  };
}

export function StrategyPlanner({ onNavigate }: { onNavigate: (path: string, params?: any) => void }) {
  const { activeClient } = useClient();
  const [plannedPosts, setPlannedPosts] = useState<StrategyPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingVisualId, setGeneratingVisualId] = useState<string | null>(null);
  const [generatingQuoteId, setGeneratingQuoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/api/posts?client_id=${activeClient.id}`);
      if (response.ok) {
        const data = await response.json();
        const strategyPosts = data.filter((p: any) => p.is_placeholder || p.funnel_stage);
        setPlannedPosts(strategyPosts.sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
      }
    } catch (e) {
      console.error('Failed to fetch plan:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeClient?.id) fetchPlan();
  }, [activeClient]);

  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      const now = new Date();
      const response = await fetch('http://localhost:5001/api/automation/plan-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: String(activeClient.id),
          month: now.getMonth() + 1,
          year: now.getFullYear()
        })
      });
      if (response.ok) await fetchPlan();
    } catch (e) {
      console.error('Generation failed:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVisual = async (postId: string) => {
    setGeneratingVisualId(postId);
    try {
      const response = await fetch(`http://localhost:5001/api/posts/${postId}/generate-visual`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchPlan();
      } else {
        const data = await response.json();
        alert(`Failed to generate visual: ${data.error}`);
      }
    } catch (e) {
      console.error('Visual generation failed:', e);
    } finally {
      setGeneratingVisualId(null);
    }
  };

  const handleGenerateQuote = async (postId: string) => {
    setGeneratingQuoteId(postId);
    try {
      const response = await fetch(`http://localhost:5001/api/posts/${postId}/generate-quote-graphic`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchPlan();
      } else {
        const data = await response.json();
        alert(`Failed to generate quote graphic: ${data.error}`);
      }
    } catch (e) {
      console.error('Quote generation failed:', e);
    } finally {
      setGeneratingQuoteId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
               <Brain className="w-6 h-6" />
            </div>
            Expert Strategy Hub V1000.6
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Elite Content Architect active for {activeClient.name}.</p>
        </div>
        <button
          onClick={handleGenerateStrategy}
          disabled={isGenerating}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-sm font-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-indigo-400" />}
          {isGenerating ? 'ARCHITECTING PLAN...' : 'Auto-Plan Month'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="w-32 px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                <th className="w-32 px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Funnel / Type</th>
                <th className="w-64 px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Strategic Topic</th>
                <th className="w-72 px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Copy Direction</th>
                <th className="w-72 px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Visual Idea</th>
                <th className="w-80 px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Final Expert Copy</th>
                <th className="w-24 px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Specialist AI is drafting your roadmap...</p>
                  </td>
                </tr>
              ) : plannedPosts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center text-slate-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="font-bold uppercase text-xs tracking-widest">Plan is empty. Launch the Specialist Architect.</p>
                  </td>
                </tr>
              ) : (
                plannedPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-50/50 transition-colors group align-top">
                    {/* Date */}
                    <td className="px-8 py-6 border-r border-slate-50 text-center">
                      <div className="flex flex-col">
                        <span className="text-base font-black text-slate-900 leading-none">{format(new Date(post.scheduled_at), 'MMM d')}</span>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase mt-1 tracking-tighter">{format(new Date(post.scheduled_at), 'EEEE')}</span>
                      </div>
                    </td>

                    {/* Funnel / Type */}
                    <td className="px-6 py-6 border-r border-slate-50">
                      <div className="flex flex-col gap-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border shadow-sm w-fit",
                          post.funnel_stage === 'Awareness' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          post.funnel_stage === 'Trust' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          post.funnel_stage === 'Conversion' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-50 text-slate-600 border-slate-100"
                        )}>
                          {post.funnel_stage}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[8px] font-bold uppercase w-fit tracking-widest">
                          {post.post_type || 'Static'}
                        </span>
                      </div>
                    </td>

                    {/* Topic */}
                    <td className="px-6 py-6 border-r border-slate-50">
                      <h4 className="text-xs font-black text-slate-800 leading-tight uppercase underline decoration-indigo-100 decoration-4 underline-offset-4 mb-2">
                        {post.topic}
                      </h4>
                      {post.metadata?.marketing_logic && (
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5">
                          <BarChart3 className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[8px] font-bold text-amber-800 leading-tight italic">Insight: {post.metadata.marketing_logic}</p>
                        </div>
                      )}
                    </td>

                    {/* Copy Direction */}
                    <td className="px-6 py-6 border-r border-slate-50">
                      <div className="flex items-start gap-2">
                        <ScrollText className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                          {post.copy_direction || "Processing strategic direction..."}
                        </p>
                      </div>
                    </td>

                    {/* Visual Idea */}
                    <td className="px-6 py-6 border-r border-slate-50">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Palette className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                            {post.visual_idea || "Generating visual concept..."}
                          </p>
                        </div>

                        {post.copy_direction && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                             <ScrollText className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                             <p className="text-[9px] text-slate-500 leading-tight">Context: {post.copy_direction}</p>
                          </div>
                        )}

                        {post.visual_idea && (
                          <div className="pt-2">
                            {post.media_url ? (
                              <div className="relative group/img w-full aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                                <img src={post.media_url} alt="Visual Ref" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <a
                                    href={post.media_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white rounded-lg text-slate-900 hover:bg-indigo-600 hover:text-white transition-colors"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => handleGenerateVisual(post.id)}
                                    disabled={generatingVisualId === post.id || generatingQuoteId === post.id}
                                    title="Regenerate Reference"
                                    className="p-1.5 bg-white rounded-lg text-slate-900 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleGenerateQuote(post.id)}
                                    disabled={generatingVisualId === post.id || generatingQuoteId === post.id}
                                    title="Generate Quote Graphic"
                                    className="p-1.5 bg-white rounded-lg text-slate-900 hover:bg-rose-600 hover:text-white transition-colors disabled:opacity-50"
                                  >
                                    {generatingQuoteId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleGenerateVisual(post.id)}
                                  disabled={generatingVisualId === post.id || generatingQuoteId === post.id}
                                  className="flex items-center gap-2 w-full py-2 px-3 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border border-violet-100 disabled:opacity-50"
                                >
                                  {generatingVisualId === post.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Zap className="w-3.5 h-3.5" />
                                  )}
                                  {generatingVisualId === post.id ? 'Generating...' : 'Generate Design Ref'}
                                </button>

                                <button
                                  onClick={() => handleGenerateQuote(post.id)}
                                  disabled={generatingVisualId === post.id || generatingQuoteId === post.id}
                                  className="flex items-center gap-2 w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border border-rose-100 disabled:opacity-50"
                                >
                                  {generatingQuoteId === post.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                  )}
                                  {generatingQuoteId === post.id ? 'Crafting Graphic...' : 'Generate Quote Graphic'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Final Copy */}
                    <td className="px-6 py-6 bg-slate-50/20">
                      <div className="flex items-start gap-2">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
                          {post.content || "Finalizing professional copy..."}
                        </p>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-8 py-6 text-center">
                        <button
                          onClick={() => onNavigate('composer', { postId: post.id })}
                          className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all mx-auto group"
                        >
                          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
