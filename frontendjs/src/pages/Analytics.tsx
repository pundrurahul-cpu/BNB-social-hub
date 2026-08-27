import React, { useState, useMemo } from 'react';
import { 
  XAxis,
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Download, Brain, MessageSquare, Loader2, Filter, User, Globe, TrendingUp, ChevronRight, Eye, Heart, Share2, Sparkles, RefreshCw, BarChart as BarChartIcon, Send, CheckCircle2, MapPin, Search } from 'lucide-react';
import { Platform } from '../types';
import { cn } from '@/lib/utils';
import { usePosts } from '../context/PostsContext';
import { useClient } from '../context/ClientContext';

const PLATFORM_META: { id: Platform; name: string; color: string }[] = [
  { id: 'instagram', name: 'Instagram', color: '#E1306C' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2' },
];

export function Analytics() {
  const { posts } = usePosts();
  const { activeClient } = useClient();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reportComments, setReportComments] = useState<any[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['instagram', 'facebook', 'linkedin']);
  const [exporting, setExporting] = useState(false);

  const [globalUrl, setGlobalUrl] = useState('');
  const [isGlobalAnalyzing, setIsGlobalAnalyzing] = useState(false);

  const [growthHistory, setGrowthHistory] = useState<any[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [viralTrends, setViralTrends] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [fetchingPerformanceId, setFetchingPerformanceId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  // Regional Discovery State
  const [discoveryMode, setDiscoveryMode] = useState<'industry' | 'regional'>('industry');
  const [region, setRegion] = useState({
    country: 'India',
    state: '',
    district: ''
  });

  React.useEffect(() => {
    const fetchData = async () => {
      if (!activeClient) return;
      try {
        const [growthRes, industryRes] = await Promise.all([
          fetch(`http://localhost:5001/api/analytics/growth-history?client_id=${activeClient.id}`),
          fetch(`http://localhost:5001/api/analytics/industries`)
        ]);

        if (growthRes.ok) setGrowthHistory(await growthRes.json());
        if (industryRes.ok) {
          const industryList = await industryRes.json();
          setIndustries(industryList);
          if (industryList.length > 0) setSelectedIndustry(industryList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch initial analytics data', err);
      }
    };
    fetchData();
  }, [activeClient]);

  const handleFetchPerformance = async (postId: string) => {
    setFetchingPerformanceId(postId);
    try {
      const response = await fetch(`http://localhost:5001/api/analytics/post-performance/${postId}`);
      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setFetchingPerformanceId(null);
    }
  };

  const handleAutoReplyAll = async (postId: string) => {
    if (!window.confirm("This will use AI to reply to ALL unreplied comments on this post. Continue?")) return;

    setIsReplying(true);
    try {
      const response = await fetch(`http://localhost:5001/api/analytics/auto-reply-all/${postId}`, {
        method: 'POST'
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (response.ok) {
          alert(`Success! Replied to ${data.successful} comments.`);
          // Refresh comments list
          const commentsRes = await fetch(`http://localhost:5001/api/analytics/comments/${postId}`);
          const commentsData = await commentsRes.json();
          setReportComments(commentsData.filter((c: any) => selectedPlatforms.includes(c.platform as Platform)));
        } else {
          alert(data.error || 'Failed to send auto-replies');
        }
      } else {
        const text = await response.text();
        console.error('Server returned non-JSON response:', text);
        alert('Server encountered an error. Check the terminal logs for details.');
      }
    } catch (err) {
      console.error('Auto-reply failed:', err);
      alert('Network error or server unavailable.');
    } finally {
      setIsReplying(false);
    }
  };

  React.useEffect(() => {
    const fetchTrends = async () => {
      if (!activeClient) return;

      setLoadingTrends(true);
      try {
        let url = `http://localhost:5001/api/analytics/viral-trends/${selectedIndustry}?client_id=${activeClient.id}`;

        if (discoveryMode === 'regional' && region.state && region.district) {
          url = `http://localhost:5001/api/analytics/viral-trends/regional?country=${region.country}&state=${region.state}&district=${region.district}&industry=${selectedIndustry}&client_id=${activeClient.id}`;
        } else if (discoveryMode === 'regional') {
          // Don't fetch if regional but incomplete
          setLoadingTrends(false);
          return;
        }

        const res = await fetch(url);
        if (res.ok) setViralTrends(await res.json());
      } catch (err) {
        console.error('Failed to fetch viral trends', err);
      } finally {
        setLoadingTrends(false);
      }
    };
    fetchTrends();
  }, [selectedIndustry, activeClient, discoveryMode, region.state, region.district]);

  const platformStats = useMemo(() => {
    return PLATFORM_META.map(p => ({
      name: p.name,
      id: p.id,
      posts: posts.filter(post => post.platforms.includes(p.id)).length,
    }));
  }, [posts]);

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleExportReport = async () => {
    if (!activeClient) {
      alert('Please select a client first.');
      return;
    }

    setExporting(true);
    try {
      const response = await fetch(`http://localhost:5001/api/analytics/export?client_id=${activeClient.id}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${activeClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Check if server is running.');
    } finally {
      setExporting(false);
    }
  };

  const handleRunAnalysis = async (postId: string) => {
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform.');
      return;
    }

    setAnalyzingId(postId);
    setSelectedReport(null);
    setReportComments([]);

    try {
      // 1. Trigger Analysis
      const response = await fetch(`http://localhost:5001/api/analytics/analyze-post/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: selectedPlatforms })
      });
      const data = await response.json();

      if (response.ok) {
        setSelectedReport(data);
        // Use the comments returned directly from the analysis for instant sync
        if (data.comments) {
          setReportComments(data.comments.filter((c: any) => selectedPlatforms.includes(c.platform as Platform)));
        } else {
          // Fallback: Fetch Individual Comments for the report
          const commentsRes = await fetch(`http://localhost:5001/api/analytics/comments/${postId}`);
          const commentsData = await commentsRes.json();
          setReportComments(commentsData.filter((c: any) => selectedPlatforms.includes(c.platform as Platform)));
        }
      } else {
        alert(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis failed', error);
      alert('Analysis failed. Make sure server is running.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleGlobalAnalysis = async () => {
    if (!globalUrl) return;
    if (!activeClient) {
      alert('Please select a client first.');
      return;
    }

    setIsGlobalAnalyzing(true);
    setSelectedReport(null);
    try {
      const response = await fetch('http://localhost:5001/api/analytics/global-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: globalUrl, client_id: activeClient.id })
      });
      const resData = await response.json();

      if (response.ok) {
        setSelectedReport({
            report: resData.data.report,
            stats: resData.data.stats,
            platforms_analyzed: ['instagram'],
            is_global: true,
            username: resData.data.username,
            caption: resData.data.caption,
            metrics: resData.data.metrics
        });
        setReportComments(resData.data.comments);
      } else {
        alert(resData.error || 'Global Analysis failed');
      }
    } catch (error) {
      console.error('Global analysis failed', error);
      alert('Global analysis failed. Ensure server is running.');
    } finally {
      setIsGlobalAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Social Intelligence</h1>
          <p className="text-slate-500 text-sm mt-1">Sentiment analysis & community feedback reports from multiple platforms.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            {PLATFORM_META.map(platform => (
              <button
                key={platform.id}
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  selectedPlatforms.includes(platform.id)
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-transparent text-slate-500 hover:bg-slate-50"
                )}
              >
                {platform.name}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportReport}
            disabled={exporting}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* Global Analysis Input */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Analyze Any Instagram Post</h2>
            <p className="text-[10px] text-slate-500 font-medium">Paste a Reel or Post URL to analyze public sentiment and performance.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={globalUrl}
            onChange={(e) => setGlobalUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/abc..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
          <button
            onClick={handleGlobalAnalysis}
            disabled={isGlobalAnalyzing || !globalUrl}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
          >
            {isGlobalAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      </div>

      {/* Follower Growth Chart */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              Follower Growth
            </h2>
            <p className="text-sm text-slate-500 font-medium">Tracking community expansion over the last 30 days.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900">{growthHistory.length > 0 ? growthHistory[growthHistory.length - 1].total_followers.toLocaleString() : '0'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Followers</p>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthHistory}>
              <defs>
                <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="snapshot_date"
                axisLine={false}
                tickLine={false}
                tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
              <Tooltip
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelFormatter={(str) => new Date(str).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <Area
                type="monotone"
                dataKey="total_followers"
                stroke="#6366f1"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorFollowers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market Intelligence / Viral Trends */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-xl text-white">
                <Sparkles className="w-6 h-6" />
              </div>
              Market Intelligence
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Discover trending content by Industry or Regional location.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Industry Selection (Always Visible) */}
            <div className="flex items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-2xl shadow-sm overflow-x-auto max-w-full sm:max-w-md">
              {industries.map(industry => (
                <button
                  key={industry}
                  onClick={() => setSelectedIndustry(industry)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap",
                    selectedIndustry === industry
                      ? "bg-slate-900 text-white shadow-lg"
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {industry.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl flex border border-slate-200 shadow-inner shrink-0">
              <button
                onClick={() => setDiscoveryMode('industry')}
                className={cn(
                  "px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  discoveryMode === 'industry' ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Brain className="w-3.5 h-3.5" /> GLOBAL
              </button>
              <button
                onClick={() => setDiscoveryMode('regional')}
                className={cn(
                  "px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  discoveryMode === 'regional' ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <MapPin className="w-3.5 h-3.5" /> REGIONAL
              </button>
            </div>
          </div>
        </div>

        {/* Regional Filter Bar (Conditional) */}
        {discoveryMode === 'regional' && (
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Filters:</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-1 border border-slate-200 rounded-xl shadow-sm">
              <input
                type="text"
                placeholder="State"
                value={region.state}
                onChange={e => setRegion({...region, state: e.target.value})}
                className="px-4 py-2 bg-transparent text-[11px] font-bold outline-none w-32"
              />
              <div className="w-px h-4 bg-slate-200" />
              <input
                type="text"
                placeholder="District"
                value={region.district}
                onChange={e => setRegion({...region, district: e.target.value})}
                className="px-4 py-2 bg-transparent text-[11px] font-bold outline-none w-32"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium italic">
              AI is searching for <span className="font-bold text-indigo-600">{selectedIndustry}</span> creators in <span className="font-bold text-indigo-600">{region.district || '...'}</span>
            </div>
          </div>
        )}

        {loadingTrends ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-4 h-64 animate-pulse" />
            ))}
          </div>
        ) : discoveryMode === 'regional' && (!region.state || !region.district) ? (
          <div className="bg-indigo-50 border-2 border-dashed border-indigo-100 rounded-[2.5rem] p-20 text-center">
             <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
                <MapPin className="w-8 h-8 text-indigo-500" />
             </div>
             <h3 className="text-xl font-black text-indigo-900 mb-2 uppercase tracking-tight">Launch Hyper-Local Discovery</h3>
             <p className="text-indigo-600/70 font-medium max-w-md mx-auto leading-relaxed">Enter a **State** and **District** above to let our AI scan top **{selectedIndustry}** creators and find what's trending in that specific area.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {viralTrends.map((post, idx) => (
              <div key={idx} className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group border-b-4 border-b-indigo-500/10">
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  {post.media_type === 'VIDEO' ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                       <video src={post.media_url} className="w-full h-full object-cover opacity-80" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                            <ChevronRight className="w-6 h-6 text-white fill-white" />
                          </div>
                       </div>
                    </div>
                  ) : (
                    <img src={post.media_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  )}

                  {/* Regional Badge */}
                  {discoveryMode === 'regional' && (
                    <div className="absolute bottom-4 left-4 z-10">
                       <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/20 shadow-lg">
                          <MapPin className="w-2.5 h-2.5 text-indigo-600 fill-indigo-100" />
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">{region.district}</span>
                       </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4">
                    <span className="bg-slate-900/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                      @{post.username}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg">
                      {post.viral_score}x Viral
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-600 font-medium line-clamp-2 italic">"{post.caption || 'No caption available'}"</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <p className="text-xs font-black text-slate-900">{post.like_count > 1000 ? (post.like_count/1000).toFixed(1)+'k' : post.like_count}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Likes</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <p className="text-xs font-black text-slate-900">{post.comments_count > 1000 ? (post.comments_count/1000).toFixed(1)+'k' : post.comments_count}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <MessageSquare className="w-2.5 h-2.5 text-indigo-500 fill-indigo-500" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Comm.</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <p className="text-xs font-black text-slate-900">{post.views > 1000 ? (post.views/1000).toFixed(1)+'k' : post.views}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Eye className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Views</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-widest"
                  >
                    View Source <Share2 className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sentiment Report Modal/View */}
      {selectedReport && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-500">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-indigo-200">
                <Brain className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="font-bold uppercase tracking-wider text-xs">AI Sentiment Report</span>
                  {selectedReport.is_global ? (
                    <span className="text-[10px] text-indigo-300">Global Post Analysis: @{selectedReport.username}</span>
                  ) : (
                    selectedReport.platforms_analyzed && (
                      <span className="text-[10px] text-indigo-300">Platforms: {selectedReport.platforms_analyzed.join(', ')}</span>
                    )
                  )}
                </div>
              </div>
              <button onClick={() => { setSelectedReport(null); setGlobalUrl(''); }} className="text-indigo-300 hover:text-white">✕</button>
            </div>

            {selectedReport.is_global && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] font-black uppercase text-indigo-300 mb-2">Post Preview</p>
                <p className="text-xs text-indigo-100 italic line-clamp-2 mb-3">"{selectedReport.caption || 'No caption available'}"</p>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-xs font-bold">{selectedReport.metrics?.likes || 0}</p>
                    <p className="text-[8px] uppercase tracking-widest text-indigo-300">Likes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold">{selectedReport.metrics?.comments || 0}</p>
                    <p className="text-[8px] uppercase tracking-widest text-indigo-300">Comments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold">{selectedReport.metrics?.video_view_count || 0}</p>
                    <p className="text-[8px] uppercase tracking-widest text-indigo-300">Views</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-2">Public Perception</h3>
                <div className="prose prose-invert max-w-none text-indigo-100 whitespace-pre-line">
                  {selectedReport.report || selectedReport.message}
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-4">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Sentiment Breakdown
                </h4>
                {selectedReport.stats ? (
                  <div className="space-y-4">
                    <StatBar label="Positive Talk" value={selectedReport.stats?.positive} total={selectedReport.stats?.total} color="bg-emerald-400" />
                    <StatBar label="Negative Talk" value={selectedReport.stats?.negative} total={selectedReport.stats?.total} color="bg-rose-400" />
                    <StatBar label="Neutral Talk" value={selectedReport.stats?.neutral} total={selectedReport.stats?.total} color="bg-slate-400" />
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-indigo-300 italic text-sm">
                    No statistical data available for this report.
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="text-xs text-indigo-300">Total Comments Analyzed: {selectedReport.stats?.total || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Comment Data Report */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Individual Comment Data
                </h3>
                {!selectedReport.is_global && (
                  <button
                    onClick={() => handleAutoReplyAll(reportComments[0]?.post_id || analyzingId)}
                    disabled={isReplying || reportComments.filter(c => !c.replied_at).length === 0}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed",
                      reportComments.filter(c => !c.replied_at).length > 0
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                        : "bg-slate-100 text-slate-400 shadow-none border border-slate-200"
                    )}
                    title={reportComments.filter(c => !c.replied_at).length === 0 ? "No new comments to reply to" : "Send AI replies to all new comments"}
                  >
                    {isReplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    {reportComments.filter(c => !c.replied_at).length === 0 ? 'All Comments Replied' : 'AI Auto-Reply to All'}
                  </button>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                {reportComments.length} Records Found
              </span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-400 uppercase font-bold sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Platform</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Comment Content</th>
                    <th className="px-6 py-3 text-center">Sentiment</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportComments.length > 0 ? reportComments.map((comment, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          comment.platform === 'facebook' ? "bg-blue-100 text-blue-700" :
                          comment.platform === 'instagram' ? "bg-pink-100 text-pink-700" : "bg-indigo-100 text-indigo-700"
                        )}>
                          {comment.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-400" /> {comment.author}
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1">
                            <span className="text-slate-500 max-w-xs truncate">{comment.text}</span>
                            {comment.ai_reply_text && (
                              <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 mt-1">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter mb-0.5">AI Reply Sent:</p>
                                <p className="text-[11px] text-indigo-700 italic">"{comment.ai_reply_text}"</p>
                              </div>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          comment.polarity_label === 'positive' ? "bg-emerald-50 text-emerald-600" :
                          comment.polarity_label === 'negative' ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {comment.polarity_label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         {comment.replied_at ? (
                           <div className="flex flex-col items-center gap-0.5 text-emerald-600">
                             <CheckCircle2 className="w-4 h-4" />
                             <span className="text-[8px] font-black uppercase">Replied</span>
                           </div>
                         ) : (
                           <span className="text-[10px] font-semibold text-slate-400 uppercase">Pending</span>
                         )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        No comments found for the selected platforms on this post.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 card-shadow lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Channel Distribution</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip cursor={{fill: '#F1F5F9'}} />
                <Bar dataKey="posts" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 card-shadow">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Post Summary</h2>
          <div className="space-y-3">
             <QuickStat label="Published" value={posts.filter(p => p.status === 'published').length} color="text-emerald-600" bg="bg-emerald-50" />
             <QuickStat label="Scheduled" value={posts.filter(p => p.status === 'scheduled').length} color="text-blue-600" bg="bg-blue-50" />
             <QuickStat label="Drafts" value={posts.filter(p => p.status === 'draft').length} color="text-slate-600" bg="bg-slate-50" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 card-shadow lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Content Sentiment Analysis</h2>
            <div className="text-xs text-slate-500 italic">
              Analyze comments from: <span className="font-bold text-indigo-600">{selectedPlatforms.join(', ')}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-semibold">Post Content</th>
                  <th className="px-6 py-3 font-semibold">Platforms</th>
                  <th className="px-6 py-3 font-semibold">Live Performance</th>
                  <th className="px-6 py-3 font-semibold text-center">AI Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.filter(p => p.status === 'published').map((post) => (
                  <tr key={post.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 truncate max-w-[250px] font-medium text-slate-700">{post.content}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {post.platforms.map(p => (
                          <span key={p} className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                            p === 'instagram' ? "bg-pink-50 text-pink-600" :
                            p === 'facebook' ? "bg-blue-50 text-blue-600" :
                            "bg-slate-50 text-slate-600"
                          )}>{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-4">
                         <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Eye className="w-3 h-3 text-slate-400" />
                              <span className="text-xs font-bold text-slate-700">
                                {post.platforms.reduce((acc, p) => acc + (post.metadata?.[p]?.reach || 0), 0).toLocaleString()}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Reach</span>
                         </div>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                              <span className="text-xs font-bold text-slate-700">
                                {post.platforms.reduce((acc, p) => acc + (post.metadata?.[p]?.likes || 0), 0).toLocaleString()}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Likes</span>
                         </div>
                         <button
                           onClick={() => handleFetchPerformance(post.id)}
                           disabled={fetchingPerformanceId === post.id}
                           className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                           title="Refresh Live Data"
                         >
                           <RefreshCw className={cn("w-3.5 h-3.5", fetchingPerformanceId === post.id && "animate-spin")} />
                         </button>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleRunAnalysis(post.id)}
                        disabled={analyzingId === post.id}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          analyzingId === post.id
                            ? "bg-slate-100 text-slate-400 animate-pulse"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                        )}
                      >
                        {analyzingId === post.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Brain className="w-3.5 h-3.5" />
                        )}
                        {analyzingId === post.id ? 'Analyzing...' : 'Analyze Sentiment'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, color, bg }: { label: string, value: number, color: string, bg: string }) {
  return (
    <div className={cn("p-4 rounded-xl flex justify-between items-center", bg)}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

function StatBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span>{value} ({Math.round(percentage)}%)</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
