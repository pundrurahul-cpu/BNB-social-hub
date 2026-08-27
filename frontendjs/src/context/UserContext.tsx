import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'user';
  email: string;
  company?: string;
  avatar?: string;
  phone?: string;
  location?: string;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  loginAsGuest: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock User for Dev Bypass
const MOCK_USER = {
  id: 'dev-guest-id',
  email: 'guest@bnbhub.dev',
  user_metadata: { full_name: 'Guest Developer' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString()
} as User;

const MOCK_PROFILE: UserProfile = {
  id: 'dev-guest-id',
  name: 'Guest Developer',
  email: 'guest@bnbhub.dev',
  role: 'admin', // Give admin access by default in dev bypass
  company: 'BNB Dev Agency',
  avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=Guest&backgroundColor=f1f5f9'
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isGuestMode = useRef(false);

  const fetchProfile = async (userId: string) => {
    console.log('🔄 [Auth] Attempting to fetch profile for ID:', userId);
    try {
      // SET A TIMEOUT FOR PROFILE FETCH
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ [Auth] Profile table error:', error.message);
      }

      if (data) {
        console.log('✅ [Auth] Profile found in database:', data);
        setProfile(data as UserProfile);
      } else {
        console.warn('⚠️ [Auth] Profile row NOT found in database. Using metadata fallback.');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const fallbackProfile: UserProfile = {
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: 'user',
            avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${user.id}&backgroundColor=f1f5f9`
          };
          console.log('ℹ️ [Auth] Fallback profile generated:', fallbackProfile);
          setProfile(fallbackProfile);
        }
      }
    } catch (err: any) {
      console.error('❌ [Auth] fetchProfile Error/Timeout:', err.message);
      // Ensure we have a profile so the app can continue
      setProfile({
        id: userId,
        name: 'User',
        email: '',
        role: 'user',
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${userId}`
      });
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      console.log('🚀 [Auth] Starting Authentication Boot Sequence...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ [Auth] Session fetch error:', error.message);
          throw error;
        }

        if (session?.user) {
          console.log('👤 [Auth] Active session detected:', session.user.email);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          console.log('👋 [Auth] No active session. Redirecting to login.');
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        console.error('❌ [Auth] Initialization Critical Failure:', err.message);
        setUser(null);
        setProfile(null);
      } finally {
        console.log('🏁 [Auth] Boot Sequence Complete. Releasing loading state.');
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isGuestMode.current) return;

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    isGuestMode.current = false;
    setUser(null);
    setProfile(null);
  };

  const loginAsGuest = () => {
    console.log('🚧 Setting Guest mode...');
    isGuestMode.current = true;
    setUser(MOCK_USER);
    setProfile(MOCK_PROFILE);
    setLoading(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      console.log('📝 [Auth] Updating profile:', updates);
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state immediately
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      console.log('✅ [Auth] Profile updated successfully');
    } catch (err: any) {
      console.error('❌ [Auth] Profile update failed:', err.message);
      // Fallback update local state anyway to avoid UI lag
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <UserContext.Provider value={{
      user,
      profile,
      loading,
      signOut,
      isAdmin,
      loginAsGuest,
      signInWithEmail,
      signInWithGoogle,
      updateProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
