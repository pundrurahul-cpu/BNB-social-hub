import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Target, Zap, MessageSquare, Image as ImageIcon, Calendar, Save, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClient } from '../context/ClientContext';

export function StrategyDashboard() {
  const { activeClient } = useClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Strategy State
  const [strategy, setStrategy] = useState({
    industry: '',
    target_audience: '',
    brand_voice: 'Professional, yet approachable',
    posting_days: [1, 3, 5], // Mon, Wed, Fri
    content_focus: '',
    auto_engagement: false
  });

  useEffect(() => {
    // Load existing strategy if it exists
    const loadStrategy = async () => {
      const res = await fetch(`http://localhost:5001/api/automation/settings/${activeClient.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.client_id) setStrategy(prev => ({ ...prev, ...data }));
      }
    };
    loadStrategy();
  }, [activeClient]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:5001/api/automation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...strategy, client_id: activeClient.id })
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBrain = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch('http://localhost:5001/api/automation/smart-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          month: now.getMonth() + 2, // Plan for next month
          year: now.getFullYear()
        })
      });
      if (res.ok) alert("🧠 Strategy Brain has successfully planned next month! Check the Calendar.");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Brain className="w-6 h-6" />
            </div>
            Strategy Engine
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configure AI-driven funnel automation for {activeClient.name}.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
          <button
            onClick={handleTriggerBrain}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-sm font-black transition-all shadow-xl shadow-indigo-100"
          >
            <Zap className="w-4 h-4 fill-white" />
            Auto-Plan Next Month
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Brand DNA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4" /> Brand Identity & DNA
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 ml-1">INDUSTRY</label>
                  <input
                    value={strategy.industry}
                    onChange={e => setStrategy({...strategy, industry: e.target.value})}
                    placeholder="e.g. Education, Coffee, Tech"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 ml-1">TARGET AUDIENCE</label>
                  <input
                    value={strategy.target_audience}
                    onChange={e => setStrategy({...strategy, target_audience: e.target.value})}
                    placeholder="e.g. Parents of school kids"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Brand Voice & Content Pillars
              </h2>
              <textarea
                value={strategy.content_focus}
                onChange={e => setStrategy({...strategy, content_focus: e.target.value})}
                placeholder="What are the main topics we should talk about?"
                rows={4}
                className="w-full bg-slate-50 border-none rounded-3xl p-6 font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Automations */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
            <Sparkles className="absolute -right-4 -top-4 w-32 h-32 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
            <h3 className="text-xl font-bold mb-2">Smart Rotation</h3>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              The engine will automatically rotate posts through the funnel:
              Awareness → Value → Trust → Conversion.
            </p>
            <div className="space-y-3">
              {['Awareness', 'Value', 'Trust', 'Conversion'].map(step => (
                <div key={step} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
                  <span className="text-xs font-bold">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" /> Community Management
            </h3>
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">Real-Time Auto-Reply</p>
                  <p className="text-[8px] text-emerald-600/70 font-medium">AI will instantly reply to all new comments</p>
               </div>
               <button
                 onClick={async () => {
                   const newValue = !strategy.auto_engagement;
                   setStrategy({...strategy, auto_engagement: newValue});

                   // Instant Save for Toggle
                   if (activeClient) {
                     try {
                       await fetch('http://localhost:5001/api/automation/save', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({
                           ...strategy,
                           client_id: activeClient.id,
                           auto_engagement: newValue
                         })
                       });
                     } catch (e) {
                       console.error("Failed to persist toggle:", e);
                     }
                   }
                 }}
                 className={cn(
                   "w-10 h-5 rounded-full transition-all relative",
                   strategy.auto_engagement ? "bg-emerald-500" : "bg-slate-200"
                 )}
               >
                 <div className={cn(
                   "w-3 h-3 bg-white rounded-full absolute top-1 transition-all",
                   strategy.auto_engagement ? "right-1" : "left-1"
                 )} />
               </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Mandatory Days
            </h3>
            <div className="flex justify-between">
              {['S','M','T','W','T','F','S'].map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all",
                    strategy.posting_days.includes(i) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-300"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-6 font-medium italic">
              *Holidays will be added automatically on top of these days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
