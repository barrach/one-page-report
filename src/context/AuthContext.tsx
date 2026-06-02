import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserPermission, UserRole, Module } from '@/types/auth';

const ADMIN_EMAIL = 'michel.zabalia@megasteam.com.br';
const ALL_MODULES: Module[] = ['megapricing', 'controladoria', 'prodcontrol', 'opr'];

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

  // Busca permissões — SEMPRE finaliza o loading (finally) e tem fallback
  // para o app funcionar mesmo se a RLS bloquear a query.
  const fetchPermissions = async (email: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error('[Auth] erro ao buscar permissões:', error?.message ?? 'sem dados');
        // Fallback: admin conhecido recebe acesso total; demais ficam como cliente
        if (email.toLowerCase() === ADMIN_EMAIL) {
          setUserPermission({ id: '', email, role: 'admin', modules: ALL_MODULES });
        } else {
          setUserPermission({ id: '', email, role: 'cliente', modules: [] });
        }
      } else {
        setUserPermission({
          id: data.id,
          email: data.email,
          role: data.role as UserRole,
          modules: (data.modules ?? []) as Module[],
        });
      }
    } catch (err) {
      console.error('[Auth] exceção ao buscar permissões:', (err as Error).message);
      setUserPermission(
        email.toLowerCase() === ADMIN_EMAIL
          ? { id: '', email, role: 'admin', modules: ALL_MODULES }
          : { id: '', email, role: 'cliente', modules: [] }
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUser(session.user);
        fetchPermissions(session.user.email);
      } else {
        setUser(null);
        setUserPermission(null);
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setUserPermission(null);
        setLoading(false);
        return;
      }
      if (session?.user?.email) {
        setUser(session.user);
        fetchPermissions(session.user.email);
      }
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
    signOut: async () => {
      setUser(null);
      setUserPermission(null);
      sessionStorage.clear();
      localStorage.clear();
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      window.location.replace('/login');
    },
    refreshPermissions: async () => { if (user?.email) await fetchPermissions(user.email); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
