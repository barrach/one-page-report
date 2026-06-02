import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserPermission, UserRole, Module } from '@/types/auth';

const ADMIN_EMAIL = 'michel.zabalia@megasteam.com.br';

interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  userPermission: UserPermission | null;
  role: UserRole | null;
  modules: Module[];
  isAdmin: boolean;
  hasModule: (m: Module) => boolean;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermission, setUserPermission] = useState<UserPermission | null>(null);

  const loadPermissions = async (u: User | null) => {
    if (!u?.email) { setUserPermission(null); return; }
    const { data, error } = await supabase
      .from('user_permissions')
      .select('id, email, role, modules')
      .eq('email', u.email)
      .maybeSingle();
    if (!error && data) {
      setUserPermission({
        id: data.id,
        email: data.email,
        role: data.role as UserRole,
        modules: (data.modules ?? []) as Module[],
      });
    } else {
      setUserPermission(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadPermissions(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadPermissions(u);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const role = userPermission?.role ?? null;
  const modules = userPermission?.modules ?? [];
  const isAdmin = role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL;

  const value: AuthState = {
    user,
    email: user?.email ?? null,
    loading,
    userPermission,
    role,
    modules,
    isAdmin,
    hasModule: (m) => isAdmin || modules.includes(m),
    signOut: async () => { await supabase.auth.signOut(); setUser(null); setUserPermission(null); },
    refreshPermissions: async () => { await loadPermissions(user); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
