import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  Pin,
  Heart,
  TrendingUp,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePosts } from '../context/PostsContext';
import { formatDistanceToNow } from 'date-fns';
import { useClient } from '../context/ClientContext';

interface FollowerStats {
  facebook: number;
  instagram: number;
  linkedin: number;
  pinterest: number;
  total: number;
}

interface PlatformMetric {
  reach: number;
  likes: number;
}

interface OverviewStats {
  facebook: PlatformMetric;
  instagram: PlatformMetric;
  linkedin: PlatformMetric;
  pinterest: PlatformMetric;
  totalReach: number;
  totalLikes: number;
  postCount: number;
}

export function Dashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { posts = [], refreshPosts } = usePosts();
  const { activeClient } = useClient();
  const [isExporting, setIsExporting] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followerStats, setFollowerStats] = useState<FollowerStats>({
    facebook: 0, instagram: 0, linkedin: 0, pinterest: 0, total: 0
  });
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    facebook: { reach: 0, likes: 0 },
    instagram: { reach: 0, likes: 0 },
    linkedin: { reach: 0, likes: 0 },
    pinterest: { reach: 0, likes: 0 },
    totalReach: 0, totalLikes: 0, postCount: 0
  });

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      await refreshPosts();

      const [followerRes, overviewRes] = await Promise.all([
        fetch(`http://backendjs.test/api/analytics/followers`).catch(() => null),
        fetch(`http://backendjs.test/api/analytics/overview`).catch(() => null)
      ]);

      if (followerRes?.ok) {
        const data = await followerRes.json();
        if (data) setFollowerStats(data);
      }
      if (overviewRes?.ok) {
        const data = await overviewRes.json();
        if (data) setOverviewStats(data);
      }
    } catch (error) {
      console.error('Dashboard Sync Error:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshPosts]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const publishedCount = posts.filter(p => p.status === 'published').length;
  useEffect(() => {
    if (publishedCount > 0) {
      const timer = setTimeout(fetchAllData, 2000);
      return () => clearTimeout(timer);
    }
  }, [publishedCount, fetchAllData]);

  const recentPosts = [...posts].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return (dateB || 0) - (dateA || 0);
  }).slice(0, 10);

  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;

  const mainMetrics = [
    { label: 'Total Reach', value: (overviewStats.totalReach || 0).toLocaleString(), icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Total Likes', value: (overviewStats.totalLikes || 0).toLocaleString(), icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100' },
    { label: 'Posts Published', value: publishedCount.toString(), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Posts Scheduled', value: scheduledCount.toString(), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
  ];

  const platformsData = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50', borderColor: 'border-blue-100' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50', borderColor: 'border-pink-100' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-50', borderColor: 'border-blue-100' },
    { id: 'pinterest', name: 'Pinterest', icon: Pin, color: 'text-red-600', bg: 'bg-red-50', borderColor: 'border-red-100' },
  ];

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    }, 1000);
  };

  const formatDateSafe = (date: any) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Recently';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  };

  if (!activeClient) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeClient.name} Insights</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Live overview of your agency's social performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            className="p-2.5 text-slate-400 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors"
            title="Refresh Analytics"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200"
          >
            {isExporting ? <Clock className="w-4 h-4 animate-spin" /> : (showExportSuccess ? <Check className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />)}
            {isExporting ? 'Generating...' : (showExportSuccess ? 'Exported!' : 'Export Report')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={index}
              className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm"
            >
              <div className="relative z-10">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", metric.bg)}>
                  <Icon className={cn("w-6 h-6", metric.color)} />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 leading-none">{loading ? '...' : metric.value}</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{metric.label}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {platformsData.map((platform) => {
          const stats = (overviewStats as any)?.[platform.id] || { reach: 0, likes: 0 };
          const followers = (followerStats as any)?.[platform.id] || 0;
          return (
            <div key={platform.id} className={cn("bg-white p-6 rounded-[2rem] border shadow-sm", platform.borderColor)}>
              <div className="flex items-center gap-3 mb-6">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", platform.bg)}>
                  <platform.icon className={cn("w-5 h-5", platform.color)} />
                </div>
                <span className="font-black text-slate-900 tracking-tight">{platform.name}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Followers</span>
                  <span className="text-slate-900">{(followers || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Total Reach</span>
                  <span className="text-slate-900">{(stats.reach || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Total Likes</span>
                  <span className="text-slate-900">{(stats.likes || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recent Activity</h2>
          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-slate-700">{(followerStats.total || 0).toLocaleString()} Audience</span>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {recentPosts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 font-medium">No recent activity found.</p>
            </div>
          ) : (
            recentPosts.map((post) => (
              <div key={post.id} className="p-8 hover:bg-slate-50/30 transition-all">
                <div className="flex items-start gap-6">
                  <div className={cn("mt-2 w-2.5 h-2.5 rounded-full", post.status === 'published' ? "bg-emerald-500" : "bg-blue-500")} />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-slate-800 text-base font-semibold leading-relaxed line-clamp-1 flex-1 mr-4">{post.content || post.topic || 'Untitled Post'}</p>
                      <div className="flex items-center gap-2 shrink-0">
                         <span className={cn("px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider", post.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                           {post.status}
                         </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <div className="flex -space-x-1">
                        {post.platforms?.map(plt => {
                          const plat = platformsData.find(p => p.id === plt);
                          return (
                            <div key={plt} className={cn("w-5 h-5 rounded-full border border-white flex items-center justify-center text-white shadow-sm", plat?.color.replace('text', 'bg'))}>
                              {plat && <plat.icon className="w-2.5 h-2.5" />}
                            </div>
                          );
                        })}
                      </div>
                      <span className="ml-1">{post.platforms?.join(' & ') || 'No platforms'}</span>
                      <span>•</span>
                      <span>{formatDateSafe(post.date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
