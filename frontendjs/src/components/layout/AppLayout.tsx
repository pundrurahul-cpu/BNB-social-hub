import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  PenSquare, 
  BarChart, 
  Users, 
  Image as ImageIcon,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Building2,
  Menu,
  X,
  User,
  LogOut,
  Brain,
  Palette,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useClient } from '../../context/ClientContext';
import { useUser } from '../../context/UserContext';
import { useNotifications } from '../../context/NotificationContext';
import { Logo } from '../Logo';
import { formatDistanceToNow } from 'date-fns';

interface AppLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

export function AppLayout({ children, activePath, onNavigate }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const { clients, activeClient, setActiveClient, loading: clientLoading } = useClient();
  const { profile, isAdmin, signOut, loading: userLoading } = useUser();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const clientMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientMenuRef.current && !clientMenuRef.current.contains(event.target as Node)) {
        setIsClientMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (userLoading || clientLoading || !activeClient) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <Logo className="w-16 h-16 rounded-2xl shadow-xl animate-pulse" />
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Synchronizing Workspace...</p>
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, visible: true },
    { id: 'strategy', label: 'Strategy Brain', icon: Brain, visible: true },
    { id: 'designer', label: 'Designer Board', icon: Palette, visible: true },
    { id: 'composer', label: 'Quick Post', icon: PenSquare, visible: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart, visible: true },
    { id: 'reel-intelligence', label: 'Reel Intelligence', icon: Zap, visible: true },
    { id: 'media', label: 'Media Factory', icon: ImageIcon, visible: true },
    { id: 'team', label: 'Manage Agencies', icon: Users, visible: true },
  ];

  const renderClientLogo = (client: any, size = "w-6 h-6", textClass = "text-[10px]") => {
    if (!client) return <div className={cn(size, "bg-slate-200 rounded-lg animate-pulse")} />;

    const logo = client.logo || "";
    const isUrl = logo.length > 2;
    return (
      <div className={cn(
        size, "rounded-lg flex items-center justify-center font-bold text-white shrink-0 overflow-hidden border border-slate-100 shadow-sm",
        !isUrl && (
          client.theme === 'indigo' ? 'bg-indigo-600' :
          client.theme === 'blue' ? 'bg-blue-500' :
          client.theme === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500'
        )
      )}>
        {isUrl ? <img src={logo} className="w-full h-full object-cover" /> : <span className={textClass}>{(client.name || "?")[0]}</span>}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 z-20">
        <div className="p-6 flex items-center gap-3">
          <Logo className="w-9 h-9 rounded-xl shadow-indigo-100 shadow-lg" />
          <span className="text-[13px] font-black text-slate-900 leading-tight uppercase tracking-tighter">
            Black & Bold<br/>Social Hub
          </span>
        </div>

        <div className="px-4 pb-4 relative" ref={clientMenuRef}>
          <button 
            onClick={() => setIsClientMenuOpen(!isClientMenuOpen)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 border rounded-xl transition-all bg-slate-50/50",
              isClientMenuOpen ? "border-indigo-200 ring-4 ring-indigo-50" : "border-slate-100 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {renderClientLogo(activeClient, "w-6 h-6", "text-[8px]")}
              <span className="text-xs font-bold truncate text-slate-700 uppercase tracking-tight">{activeClient.name}</span>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", isClientMenuOpen && "rotate-180")} />
          </button>
          
          <AnimatePresence>
            {isClientMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-4 right-4 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden py-2"
              >
                {clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => { setActiveClient(client); setIsClientMenuOpen(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-3",
                      activeClient.id === client.id ? "bg-indigo-50 text-indigo-700 font-black" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {renderClientLogo(client, "w-5 h-5", "text-[8px]")}
                    <span className="truncate">{client.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
          {NAV_ITEMS.filter(i => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 group relative",
                  isActive ? "text-indigo-700 bg-indigo-50/50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon className={cn("w-4.5 h-4.5", isActive ? "text-indigo-600" : "text-slate-300 group-hover:text-slate-600")} />
                {item.label}
                {isActive && <motion.div layoutId="activeBar" className="absolute left-0 w-1 h-5 bg-indigo-600 rounded-r-full" />}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1 bg-slate-50/30">
          <button onClick={() => onNavigate('settings')} className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all", activePath === 'settings' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-400 hover:text-slate-900")}>
            <Settings className="w-4.5 h-4.5" /> Settings
          </button>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
            <LogOut className="w-4.5 h-4.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative group max-w-md w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="text" placeholder="Search strategy, posts..." className="pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs w-full focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Notifications Dropdown */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-300 hover:text-slate-900 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[60] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="p-12 text-center">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                             <Bell className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markAsRead(n.id)}
                            className={cn(
                              "p-4 transition-colors cursor-pointer hover:bg-slate-50 relative",
                              !n.read && "bg-indigo-50/20"
                            )}
                          >
                            {!n.read && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "mt-1 w-2 h-2 rounded-full",
                                n.type === 'info' ? 'bg-blue-500' :
                                n.type === 'warning' ? 'bg-amber-500' :
                                n.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                              )} />
                              <div className="flex-1">
                                <p className="text-xs font-bold text-slate-900 leading-tight">{n.title}</p>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-2">
                                  {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <button
                        onClick={clearAll}
                        className="w-full py-3 bg-slate-50 text-[10px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all uppercase tracking-widest border-t border-slate-100"
                      >
                        Clear All
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-slate-100"></div>
            <button onClick={() => onNavigate('profile')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 leading-none uppercase tracking-tighter">{profile?.name || 'User'}</p>
                <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{profile?.role || 'Guest'}</p>
              </div>
              <img src={profile?.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${profile?.name}&backgroundColor=f1f5f9`} alt="" className="w-9 h-9 rounded-xl shadow-lg object-cover bg-slate-100 ring-2 ring-white" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50/50">
          <div className="p-8 max-w-[1600px] mx-auto w-full h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
