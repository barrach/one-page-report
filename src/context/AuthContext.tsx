import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';

export type AppRole = 'admin' | 'planejador' | 'gestor' | 'visualizador' | 'cliente';

// Da maior para a menor permissão: quando o usuário tem mais de um papel, vale o
// primeiro desta lista.
const ROLE_PRIORITY: AppRole[] = ['admin', 'planejador', 'gestor', 'visualizador', 'cliente'];

/** Quem lança número no app: administrador, gestor e planejador. */
const PAPEIS_QUE_EDITAM: AppRole[] = ['admin', 'gestor', 'planejador'];

interface AuthState {
  user: User | null;
  role: AppRole | null;
  /** Criar e excluir projetos — só administrador. */
  canManageProjects: boolean;
  /**
   * Editar os dados do projeto — números, ações, observações, importações.
   *
   * `visualizador` e `cliente` entram só para ler. Até aqui QUALQUER usuário
   * logado podia alterar e até limpar os dados de qualquer projeto, inclusive o
   * cliente externo.
   */
  canEdit: boolean;
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
    // Enquanto o papel não chegou, ninguém edita: liberar por padrão daria uma
    // janela em que o cliente enxerga os campos abertos.
    canEdit: role != null && PAPEIS_QUE_EDITAM.includes(role),
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
