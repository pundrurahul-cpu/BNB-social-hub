import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Globe,
  Zap,
  LayoutDashboard,
  Users,
  BarChart3
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { useUser } from '../context/UserContext';

interface LoginDashboardProps {
  onNavigate: (path: string) => void;
}

export function LoginDashboard({ onNavigate }: LoginDashboardProps) {
  const { signInWithEmail, signInWithGoogle, loginAsGuest } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      onNavigate('dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const features = [
    { icon: LayoutDashboard, title: 'Smart Dashboard', desc: 'Unified view of all social performance' },
    { icon: Zap, title: 'AI Automation', desc: 'Generate monthly strategies in seconds' },
    { icon: Users, title: 'Team Collab', desc: 'Seamless agency-client workflows' },
    { icon: BarChart3, title: 'Deep Analytics', desc: 'ROI-focused reporting and insights' }
  ];

  return (
    <div className="min-h-screen bg-white flex overflow-hidden font-sans">
      {/* Left Side: Visual/Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
           <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full" />
           <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-slate-500/10 blur-[100px] rounded-full" />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <Logo className="w-12 h-12 rounded-2xl bg-white p-2 shadow-xl" />
            <span className="text-2xl font-black text-white tracking-tighter uppercase">BNB Hub</span>
          </div>

          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            The Operating System for <span className="text-indigo-400">Social Agencies.</span>
          </h1>

          <p className="text-slate-400 text-lg mb-12 font-medium">
            Scale your agency with AI-powered content strategy, unified analytics, and automated publishing.
          </p>

          <div className="grid grid-cols-2 gap-8">
            {features.map((f, i) => (
              <div key={i} className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-white font-bold text-sm">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-12 flex items-center gap-6 text-slate-500 text-xs font-bold uppercase tracking-widest">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-4 h-4" />
             Enterprise Secure
           </div>
           <div className="flex items-center gap-2">
             <Globe className="w-4 h-4" />
             Global Reach
           </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50/30">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-[440px]"
        >
          <div className="lg:hidden flex justify-center mb-8">
            <Logo className="w-12 h-12 shadow-sm" />
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Login to Workspace</h2>
            <p className="text-slate-500 font-medium text-sm">Welcome back! Please enter your details.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <button
               onClick={handleGoogleLogin}
               className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 rounded-2xl bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
             >
               <svg className="w-5 h-5" viewBox="0 0 24 24">
                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
               Continue with Google
             </button>

             <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">Or login with email</span>
                <div className="flex-grow border-t border-slate-100"></div>
             </div>

             <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all font-medium"
                      placeholder="name@agency.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                    <button type="button" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Forgot?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-xl shadow-slate-200 group disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      Login to Dashboard
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
             </form>
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
             <p className="text-sm font-medium text-slate-500">
                Don't have an account? {' '}
                <button onClick={() => onNavigate('signup')} className="text-slate-900 font-bold hover:underline decoration-indigo-500 decoration-2 underline-offset-4">
                  Start free trial
                </button>
             </p>

             <button
               onClick={() => {
                 loginAsGuest();
                 onNavigate('dashboard');
               }}
               className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
             >
               Skip to Demo Mode
             </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
