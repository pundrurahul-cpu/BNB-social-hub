import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, X, Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { usePosts } from '../context/PostsContext';
import { useClient } from '../context/ClientContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarProps {
  onNavigate: (path: string) => void;
}

export function Calendar({ onNavigate }: CalendarProps) {
  const { posts, refreshPosts } = usePosts();
  const { activeClient } = useClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate grid based on context posts
  const generateGrid = () => {
    const startDate = startOfWeek(currentDate);
    const today = new Date();
    
    return Array.from({ length: 35 }).map((_, i) => {
      const cellDate = addDays(startDate, i);
      let dayPosts = posts.filter(post => isSameDay(new Date(post.date), cellDate));
      if (activeFilter) {
        dayPosts = dayPosts.filter(post => post.status === activeFilter);
      }
      return {
        date: cellDate,
        isCurrentMonth: cellDate.getMonth() === currentDate.getMonth(),
        isToday: isSameDay(cellDate, today),
        items: dayPosts
      };
    });
  };

  const grid = generateGrid();

  const handlePrevMonth = () => setCurrentDate(prev => addDays(prev, -30));
  const handleNextMonth = () => setCurrentDate(prev => addDays(prev, 30));

  const handleTriggerBrain = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:5001/api/automation/plan-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: String(activeClient.id),
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        })
      });
      if (response.ok) {
        await refreshPosts();
      }
    } catch (e) {
      console.error('Failed to trigger brain:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Content Calendar</h1>
          <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-lg p-1 card-shadow">
            <button className="px-3 py-1 text-sm font-medium rounded-md bg-slate-100 text-slate-800">Month</button>
            <button className="px-3 py-1 text-sm font-medium rounded-md text-slate-500 hover:text-slate-800">Week</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerBrain}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-indigo-100"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {isGenerating ? 'Brain Processing...' : 'Auto-Plan Month'}
          </button>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 card-shadow">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <button
            onClick={() => onNavigate('composer')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Post</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden card-shadow flex flex-col">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS.map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-200 gap-px border-l border-slate-200">
          {grid.map((cell, idx) => (
            <div 
              key={idx} 
              className={cn(
                "bg-white p-2 flex flex-col overflow-hidden group min-h-[120px]",
                !cell.isCurrentMonth && "bg-slate-50 text-slate-400"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                  cell.isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                )}>
                  {format(cell.date, 'd')}
                </span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
                {cell.items.map(item => (
                  <div
                    key={item.id} 
                    onClick={() => onNavigate('composer', { postId: item.id })}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded border text-left truncate cursor-pointer transition-colors shadow-sm",
                      item.status === 'published'
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300"
                        : item.status === 'scheduled'
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <div className="font-semibold capitalize text-[9px] opacity-70">{(item.platforms || []).join(' & ')}</div>
                    <div className="truncate font-medium">{item.topic || item.content || 'Draft Post'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
