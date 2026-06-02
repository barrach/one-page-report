import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserPermission, UserRole, Module } from '@/types/auth';

const ADMIN_EMAIL = 'michel.zabalia@megasteam.com.br';
const CACHE_KEY = 'megahub_userPermission';

const writeCache = (p: UserPermission | null) => {
  try {
    if (p) sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
};
const readCache = (email: string): UserPermission | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as UserPermission;
    return p?.email?.toLowerCase() === email.toLowerCase() ? p : null;
  } catch { return null; }
};

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

  // Busca permissões SEM nunca travar o loading. Usa cache de sessão.
  const loadPermissions = async (u: User | null, opts: { useCache?: boolean } = {}): Promise<void> => {
    if (!u?.email) { setUserPermission(null); writeCache(null); return; }

    // 1. cache em sessionStorage — evita rebuscar na rede a cada reload
    if (opts.useCache !== false) {
      const cached = readCache(u.email);
      if (cached) { setUserPermission(cached); return; }
    }

    // 2. busca no Supabase
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('id, email, role, modules')
        .eq('email', u.email)
        .maybeSingle();
      if (error || !data) {
        console.warn('[Auth] sem permissão para', u.email, error?.message ?? '');
        setUserPermission(null); writeCache(null);
      } else {
        const perm: UserPermission = {
          id: data.id,
          email: data.email,
          role: data.role as UserRole,
          modules: (data.modules ?? []) as Module[],
        };
        setUserPermission(perm); writeCache(perm);
      }
    } catch (e) {
      console.warn('[Auth] erro ao buscar permissões:', (e as Error).message);
      setUserPermission(null);
    }
  };

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };

    // Timeout de segurança: nunca deixa o loading preso > 5s
    const safety = setTimeout(() => {
      console.warn('[Auth] timeout de 5s — liberando loading');
      finish();
    }, 5000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const u = session?.user ?? null;
        setUser(u);
        await loadPermissions(u);
      })
      .catch((e) => console.warn('[Auth] getSession falhou:', (e as Error).message))
      .finally(() => { clearTimeout(safety); finish(); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadPermissions(u);
      finish();
    });

    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);

  const role = userPermission?.role ?? null;
  const modules = userPermission?.modules ?? [];
  const isAdmin = role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL;

  if (import.meta.env.DEV) {
    // diagnóstico temporário
    console.log('[Auth] state:', { email: user?.email ?? null, loading, role, modules });
  }

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
      // 1. tenta revogar a sessão no Supabase (não bloqueia se falhar)
      try { await supabase.auth.signOut(); } catch (e) { console.warn('[Auth] signOut:', (e as Error).message); }
      // 2. limpa todo o estado local
      try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ }
      // 3. redirect forçado (sem histórico para impossibilitar "voltar")
      window.location.replace('/login');
    },
    refreshPermissions: async () => { await loadPermissions(user, { useCache: false }); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
