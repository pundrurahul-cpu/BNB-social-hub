import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Composer } from './pages/Composer';
import { Analytics } from './pages/Analytics';
import { Team } from './pages/Team';
import { LoginDashboard } from './pages/LoginDashboard';
import { Signup } from './pages/Signup';
import { MediaLibrary } from './pages/MediaLibrary';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { StrategyPlanner } from './pages/StrategyPlanner';
import { DesignerBoard } from './pages/DesignerBoard';
import { ReelIntelligence } from './pages/ReelIntelligence';
import { useUser } from './context/UserContext';

export default function App() {
  const { user, loading, isAdmin } = useUser();
  const [activePath, setActivePath] = useState('dashboard');
  const [routeParams, setRouteParams] = useState<any>(null);

  const navigate = (path: string, params?: any) => {
    setActivePath(path);
    setRouteParams(params || null);
  };

  // Sync active path with auth state
  useEffect(() => {
    // Redirect to dashboard if logged in and on login/signup page
    if (user && (activePath === 'login' || activePath === 'signup')) {
      setActivePath('dashboard');
    }
  }, [user, activePath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    if (activePath === 'signup') return <Signup onNavigate={navigate} />;
    return <LoginDashboard onNavigate={navigate} />;
  }

  const renderContent = () => {
    switch (activePath) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'calendar':
        return <Calendar onNavigate={navigate} />;
      case 'strategy':
        return <StrategyPlanner onNavigate={navigate} />;
      case 'designer':
        return <DesignerBoard />;
      case 'composer':
        return <Composer editingPostId={routeParams?.postId} />;
      case 'analytics':
        return <Analytics />;
      case 'media':
        return <MediaLibrary />;
      case 'reel-intelligence':
        return <ReelIntelligence />;
      case 'team':
        return <Team />;
      case 'settings':
        return <Settings />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <AppLayout activePath={activePath} onNavigate={navigate}>
      {renderContent()}
    </AppLayout>
  );
}
