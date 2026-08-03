import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'gestor' | 'visualizador' | 'cliente';

export const ADMIN_EMAILS = [
  'pedro.melecardi@megasteam.com.br',
  'michel.zabalia@megasteam.com.br',
];

interface AuthState {
  user: User | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const computeAdmin = (user: User | null, role: AppRole | null) =>
  !!user && (role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase()));

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  role: null,
  isAdmin: false,
  loading: true,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    const apply = async (user: User | null) => {
      if (!user) {
        set({ user: null, role: null, isAdmin: false, loading: false });
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const role = (data?.role as AppRole) ?? null;
      set({ user, role, isAdmin: computeAdmin(user, role), loading: false });
    };

    // Listen first
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        set({ user: null, role: null, isAdmin: false, loading: false });
        return;
      }
      set({ user, isAdmin: computeAdmin(user, get().role), loading: false });
      setTimeout(() => { void apply(user); }, 0);
    });

    // Then get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      void apply(session?.user ?? null);
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null, isAdmin: false });
  },
}));
