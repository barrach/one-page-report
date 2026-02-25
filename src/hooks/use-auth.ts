import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'gestor' | 'visualizador' | 'cliente';

interface AuthState {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  initialized: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  role: null,
  loading: true,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Store remember-me preference in localStorage for persistence across sessions
    window.addEventListener('beforeunload', () => {
      if (localStorage.getItem('megasteam_remember_me') !== 'true') {
        localStorage.removeItem('sb-bxmvzxtbjxlicjaewvfg-auth-token');
      }
    });

    // Listen first
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      if (user) {
        const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).limit(1).single();
        set({ user, role: (data?.role as AppRole) ?? null, loading: false });
      } else {
        set({ user: null, role: null, loading: false });
      }
    });

    // Then get current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      if (user) {
        const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).limit(1).single();
        set({ user, role: (data?.role as AppRole) ?? null, loading: false });
      } else {
        set({ user: null, role: null, loading: false });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null });
  },
}));
