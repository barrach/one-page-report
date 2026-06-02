import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { megaworkClient } from '@megawork/lib/megaworkClient';
import type { OpsRole, OpsUser } from '@megawork/types';

interface MegaWorkAuthState {
  user: User | null;
  email: string | null;
  opsUser: OpsUser | null;
  role: OpsRole | null;
  loading: boolean;
  /** null = vê todas as obras; array = restrito a esses obra_id */
  obraIds: string[] | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const MegaWorkAuthContext = createContext<MegaWorkAuthState | undefined>(undefined);

export function MegaWorkAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [opsUser, setOpsUser] = useState<OpsUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (email: string) => {
    const { data } = await megaworkClient
      .from('ops_users')
      .select('id, email, nome, role, obra_id')
      .eq('email', email)
      .maybeSingle();
    setOpsUser((data as OpsUser) ?? null);
  };

  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoading(false); } };
    const safety = setTimeout(finish, 5000);

    megaworkClient.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) await fetchProfile(u.email);
    }).catch(() => {}).finally(() => { clearTimeout(safety); finish(); });

    const { data: { subscription } } = megaworkClient.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u?.email) await fetchProfile(u.email); else setOpsUser(null);
      finish();
    });

    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);

  const role = opsUser?.role ?? null;
  // Controle de acesso por obra: Admin/Gestor → todas; demais → obra vinculada
  const obraIds = (role === 'Admin' || role === 'Gestor')
    ? null
    : (opsUser?.obra_id ? [opsUser.obra_id] : []);

  const value: MegaWorkAuthState = {
    user,
    email: user?.email ?? null,
    opsUser,
    role,
    loading,
    obraIds,
    signIn: async (email, password) => {
      const { error } = await megaworkClient.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { error: 'E-mail ou senha inválidos.' };
      return { error: null };
    },
    signOut: async () => {
      await megaworkClient.auth.signOut();
      setUser(null); setOpsUser(null);
    },
  };

  return <MegaWorkAuthContext.Provider value={value}>{children}</MegaWorkAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMegaWorkAuth(): MegaWorkAuthState {
  const ctx = useContext(MegaWorkAuthContext);
  if (!ctx) throw new Error('useMegaWorkAuth deve ser usado dentro de MegaWorkAuthProvider');
  return ctx;
}
