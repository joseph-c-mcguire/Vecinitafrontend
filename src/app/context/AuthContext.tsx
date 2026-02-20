import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase';

const DEV_ADMIN_ENABLED = (import.meta.env.VITE_DEV_ADMIN_ENABLED || 'false').toLowerCase() === 'true';
const DEV_ADMIN_EMAIL = import.meta.env.VITE_DEV_ADMIN_EMAIL || '';
const DEV_ADMIN_PASSWORD = import.meta.env.VITE_DEV_ADMIN_PASSWORD || '';
const DEV_ADMIN_TOKEN = import.meta.env.VITE_DEV_ADMIN_TOKEN || '';
const DEV_ADMIN_STORAGE_KEY = 'vecinita-dev-admin-session';

function createDevAdminUser(email: string): User {
  const timestamp = new Date().toISOString();
  return {
    id: 'dev-admin-local',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { role: 'admin' },
    user_metadata: { provider: 'local-dev' },
    created_at: timestamp,
  } as User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAnonymous: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [devAdminAuthenticated, setDevAdminAuthenticated] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      if (DEV_ADMIN_ENABLED) {
        try {
          const stored = localStorage.getItem(DEV_ADMIN_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as { email?: string; token?: string };
            if (parsed.token === DEV_ADMIN_TOKEN && parsed.email) {
              setUser(createDevAdminUser(parsed.email));
              setDevAdminAuthenticated(true);
            }
          }
        } catch {
          localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
        }
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      if (
        DEV_ADMIN_ENABLED &&
        DEV_ADMIN_EMAIL &&
        DEV_ADMIN_PASSWORD &&
        DEV_ADMIN_TOKEN &&
        email.trim().toLowerCase() === DEV_ADMIN_EMAIL.trim().toLowerCase() &&
        password === DEV_ADMIN_PASSWORD
      ) {
        localStorage.setItem(
          DEV_ADMIN_STORAGE_KEY,
          JSON.stringify({ email: DEV_ADMIN_EMAIL, token: DEV_ADMIN_TOKEN }),
        );
        setUser(createDevAdminUser(DEV_ADMIN_EMAIL));
        setSession(null);
        setDevAdminAuthenticated(true);
        return { error: null };
      }
      return { error: new Error('Invalid admin credentials for local development login.') };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error(supabaseConfigError) };
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
      setUser(null);
      setSession(null);
      setDevAdminAuthenticated(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const isAdmin = isSupabaseConfigured
    ? user?.app_metadata?.role === 'admin'
    : devAdminAuthenticated;

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signUp,
    signOut,
    isAnonymous: !user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
