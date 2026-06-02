import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { seedFor, isAdminEmail, type ModuleId, type Role } from '@/lib/permissions';

interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  role: Role | null;
  modules: ModuleId[];
  isAdmin: boolean;
  hasModule: (m: ModuleId) => boolean;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [modules, setModules] = useState<ModuleId[]>([]);

  const loadPermissions = async (u: User | null) => {
    if (!u?.email) { setRole(null); setModules([]); return; }
    // 1. tenta ler da tabela user_permissions
    const { data, error } = await supabase
      .from('user_permissions')
      .select('role, modules')
      .eq('email', u.email)
      .maybeSingle();
    if (!error && data) {
      setRole((data.role as Role) ?? null);
      setModules((data.modules as ModuleId[]) ?? []);
      return;
    }
    // 2. fallback no seed local
    const seed = seedFor(u.email);
    if (seed) { setRole(seed.role); setModules(seed.modules); return; }
    // 3. admin por e-mail mesmo sem registro
    if (isAdminEmail(u.email)) {
      setRole('admin'); setModules(['megapricing', 'controladoria', 'prodcontrol', 'opr']);
      return;
    }
    setRole(null); setModules([]);
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

  const value: AuthState = {
    user,
    email: user?.email ?? null,
    loading,
    role,
    modules,
    isAdmin: role === 'admin' || isAdminEmail(user?.email),
    hasModule: (m) => modules.includes(m) || role === 'admin' || isAdminEmail(user?.email),
    signOut: async () => { await supabase.auth.signOut(); setUser(null); setRole(null); setModules([]); },
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
