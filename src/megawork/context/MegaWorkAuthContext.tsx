import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { megaworkClient } from '@megawork/lib/megaworkClient';
import type { OpsRole, OpsUser } from '@megawork/types';

interface MegaWorkAuthState {
  email: string | null;
  opsUser: OpsUser | null;
  role: OpsRole | null;
  loading: boolean;
}

const MegaWorkAuthContext = createContext<MegaWorkAuthState | undefined>(undefined);

export function MegaWorkAuthProvider({ children }: { children: ReactNode }) {
  const { email, isAdmin } = useAuth();
  const [opsUser, setOpsUser] = useState<OpsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (!email) { setOpsUser(null); setLoading(false); return; }
      try {
        const { data } = await megaworkClient
          .from('ops_users')
          .select('id, email, nome, role, obra_id')
          .eq('email', email)
          .maybeSingle();
        if (!active) return;
        if (data) {
          setOpsUser(data as OpsUser);
        } else {
          // Fallback: admin do MegaHub → Admin; demais → Encarregado
          setOpsUser({
            id: '', email, nome: email.split('@')[0],
            role: isAdmin ? 'Admin' : 'Encarregado', obra_id: null,
          });
        }
      } catch {
        setOpsUser({ id: '', email, nome: email.split('@')[0], role: isAdmin ? 'Admin' : 'Encarregado', obra_id: null });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [email, isAdmin]);

  return (
    <MegaWorkAuthContext.Provider value={{ email, opsUser, role: opsUser?.role ?? null, loading }}>
      {children}
    </MegaWorkAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMegaWorkAuth(): MegaWorkAuthState {
  const ctx = useContext(MegaWorkAuthContext);
  if (!ctx) throw new Error('useMegaWorkAuth deve ser usado dentro de MegaWorkAuthProvider');
  return ctx;
}
