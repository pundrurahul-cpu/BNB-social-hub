import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Target,
  MessageSquare,
  Sparkles,
  Calendar,
  Cpu
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useClient } from '../context/ClientContext';
import { cn } from '@/lib/utils';

interface ClientStrategy {
  id: string;
  client_id: string;
  content_focus: string;
  brand_voice: string;
  posting_days: number[];
  preferred_time: string;
  platforms: string[];
  auto_engagement: boolean;
}

interface SocialConnection {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'pinterest';
  account_name: string;
}

export function Settings() {
  const { user } = useUser();
  const { activeClient } = useClient();
  const [strategy, setStrategy] = useState<Partial<ClientStrategy>>({
    content_focus: '',
    brand_voice: '',
    posting_days: [1, 3, 5],
    preferred_time: '10:00',
    platforms: ['facebook', 'instagram'],
    auto_engagement: false
  });
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'strategy'>('strategy');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // FORCE BYPASS: Immediately allow the UI to show while fetching in background
    setIsLoading(false);

    if (!activeClient?.id) return;

    try {
      const { data: strat, error: stratError } = await supabase
        .from('client_strategies')
        .select('*')
        .eq('client_id', activeClient.id)
        .maybeSingle();

      if (stratError) {
        console.warn("Table 'client_strategies' not found.");
      } else if (strat) {
        setStrategy(strat);
      }

      const { data: conn, error: connError } = await supabase
        .from('connections')
        .select('*')
        .eq('client_id', activeClient.id);

      if (connError) {
        console.warn("Table 'connections' not found or error.");
      } else if (conn) {
        setConnections(conn.map(c => ({
          id: c.id,
          platform: c.platform,
          account_name: c.platform_account_name || c.account_name || 'Connected Account'
        })));
      }
    } catch (e) {
      console.warn("Background fetch failed:", e);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveStrategy = async () => {
    if (!activeClient) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // Backend Route (Bypasses RLS Policies)
      const { platforms, ...strategyData } = strategy;

      const response = await fetch('http://localhost:5001/api/automation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          ...strategyData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save via backend');
      }

      setMessage({ text: 'Strategy saved successfully!', type: 'success' });
    } catch (e: any) {
      setMessage({ text: `Failed to save strategy: ${e.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerAutomation = async () => {
    if (!activeClient) return;
    setIsGenerating(true);
    setMessage(null);
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

      const data = await response.json();
      if (response.ok) {
        setMessage({ text: data.message, type: 'success' });
      } else {
        throw new Error(data.error || 'Automation failed');
      }
    } catch (e: any) {
      setMessage({ text: `Automation Error: ${e.message}`, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDay = (day: number) => {
    setStrategy(prev => ({
      ...prev,
      posting_days: prev.posting_days?.includes(day)
        ? prev.posting_days.filter(d => d !== day)
        : [...(prev.posting_days || []), day]
    }));
  };

  const fbConnections = connections.filter(c => c.platform === 'facebook');
  const liConnections = connections.filter(c => c.platform === 'linkedin');

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <span className="ml-3 text-slate-500 font-medium">Loading settings...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500">Manage {activeClient?.name}'s social accounts and strategy.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'accounts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ACCOUNTS
          </button>
          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'strategy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            AUTOMATION STRATEGY
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {activeTab === 'strategy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Weekly Posting Days</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(i)}
                    className={`w-12 h-10 rounded-xl text-sm font-bold transition-all border-2 ${
                      strategy.posting_days?.includes(i)
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">Preferred Time</label>
                  </div>
                  <input
                    type="time"
                    value={strategy.preferred_time}
                    onChange={(e) => setStrategy({ ...strategy, preferred_time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">Content Focus</label>
                  </div>
                  <input
                    type="text"
                    value={strategy.content_focus}
                    onChange={(e) => setStrategy({ ...strategy, content_focus: e.target.value })}
                    placeholder="e.g., Luxury real estate tips"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">Brand Voice Instructions</label>
                </div>
                <textarea
                  value={strategy.brand_voice}
                  onChange={(e) => setStrategy({ ...strategy, brand_voice: e.target.value })}
                  placeholder="e.g., Professional yet witty, focusing on student confidence"
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900 resize-none"
                />
              </div>

              <button
                onClick={handleSaveStrategy}
                disabled={isSaving}
                className="w-full mt-8 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Strategy Configuration
                  </>
                )}
              </button>
            </div>

            {/* Community Management Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Community Management</h3>
                </div>
                <div className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                   <span className="text-[10px] font-black text-emerald-600 uppercase">AI Powered</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Real-Time Auto-Reply</p>
                  <p className="text-xs text-slate-500 max-w-xs">AI will automatically monitor and reply to new comments every 30 seconds.</p>
                </div>
                <button
                  onClick={async () => {
                    const newValue = !strategy.auto_engagement;
                    setStrategy({ ...strategy, auto_engagement: newValue });

                    // Instant Save for Toggle
                    if (activeClient) {
                      try {
                        const { platforms, ...strategyData } = strategy;
                        await fetch('http://localhost:5001/api/automation/save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            client_id: activeClient.id,
                            ...strategyData,
                            auto_engagement: newValue
                          })
                        });
                      } catch (e) {
                        console.error("Failed to persist toggle:", e);
                      }
                    }
                  }}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    strategy.auto_engagement ? "bg-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                    strategy.auto_engagement ? "right-1" : "left-1"
                  )} />
                </button>
              </div>

              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                 <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-amber-700 font-medium leading-relaxed italic">
                   Note: Ensure your Instagram Business account is properly linked to your Facebook Page in settings for auto-reply to function.
                 </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform">
                <Cpu className="w-32 h-32" />
              </div>
              <div className="relative">
                <h3 className="text-xl font-bold mb-2">AI Engine Control</h3>
                <p className="text-indigo-100 text-sm mb-6">
                  Trigger the Strategic Brain to map out next month's funnel based on the rules you defined.
                </p>
                <button
                  onClick={handleTriggerAutomation}
                  disabled={isGenerating}
                  className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Build Monthly Plan
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Current Connections</h3>
              <div className="space-y-3">
                {connections.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">No accounts connected yet.</p>
                ) : (
                  connections.map(conn => (
                    <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <span className="text-[10px] font-bold uppercase">{conn.platform[0]}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700">{conn.account_name}</span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Connected Social Accounts</h3>
            <p className="text-sm text-slate-500">Manage your connected social media profiles.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Facebook */}
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1877F2]/10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#1877F2] fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Facebook & Instagram</h4>
                  <p className="text-xs text-slate-500">
                    {fbConnections.length > 0
                      ? `Connected to ${fbConnections[0].account_name}`
                      : 'Connect your business pages for auto-posting'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = `http://localhost:5001/api/auth/facebook?client_id=${activeClient?.id || ''}`}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  fbConnections.length > 0
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-[#1877F2] text-white hover:bg-[#166fe5]'
                }`}
              >
                {fbConnections.length > 0 ? 'Reconnect' : 'Connect'}
              </button>
            </div>

            {/* LinkedIn */}
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0A66C2]/10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#0A66C2] fill-current" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">LinkedIn</h4>
                  <p className="text-xs text-slate-500">
                    {liConnections.length > 0
                      ? `Connected to ${liConnections[0].account_name}`
                      : 'Post professional updates to your profile'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = `http://localhost:5001/api/auth/linkedin?client_id=${activeClient?.id || ''}`}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  liConnections.length > 0
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-[#0A66C2] text-white hover:bg-[#095196]'
                }`}
              >
                {liConnections.length > 0 ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
