import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';

export type AppRole = 'admin' | 'planejador' | 'gestor' | 'visualizador' | 'cliente';

// Da maior para a menor permissão: quando o usuário tem mais de um papel, vale o
// primeiro desta lista.
const ROLE_PRIORITY: AppRole[] = ['admin', 'planejador', 'gestor', 'visualizador', 'cliente'];

interface AuthState {
  user: User | null;
  role: AppRole | null;
  /** Criar e excluir projetos — só administrador. */
  canManageProjects: boolean;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await oprDataClient.from('user_roles').select('role').eq('user_id', userId);
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const best = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
      setRole(best);
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    oprDataClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = oprDataClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      setUser(session.user);
      fetchRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user,
    role,
    loading,
    isAdmin: role === 'admin',
    // O planejador faz tudo no projeto (importar, lançar, editar), menos criar ou
    // excluir projetos — essa é a única diferença em relação ao administrador.
    canManageProjects: role === 'admin',
    signOut: async () => {
      setUser(null);
      setRole(null);
      try { await oprDataClient.auth.signOut(); } catch { /* ignore */ }
      window.location.replace('/login');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
