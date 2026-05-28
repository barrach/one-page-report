import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@budget/integrations/supabase/client";

const STORAGE_PREFIX = "financeiro_access_granted_v1::";
// Senha definida pelo admin
const FINANCEIRO_PASSWORD = "#MegaBudget2026";
const ADMIN_EMAIL = "michel.zabalia@megasteam.com.br";

const storageKeyFor = (userId: string) => `${STORAGE_PREFIX}${userId}`;

interface FinanceiroAccessContextValue {
  granted: boolean;
  /** True quando admin (acesso automático sem senha). */
  isAdmin: boolean;
  /** Tries to validate a password. Returns true on success. */
  tryUnlock: (password: string) => boolean;
  /** Revokes access (e.g. on logout). */
  revoke: () => void;
}

const FinanceiroAccessContext = createContext<FinanceiroAccessContextValue | null>(null);

export const FinanceiroAccessProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [granted, setGranted] = useState<boolean>(false);

  const isAdmin = userEmail === ADMIN_EMAIL;

  // Read granted flag for the current user from localStorage (persists across sessions
  // until logout). Admin doesn't need any flag.
  const refreshGranted = useCallback((uid: string | null, email: string | null) => {
    if (!uid) {
      setGranted(false);
      return;
    }
    if (email === ADMIN_EMAIL) {
      setGranted(true);
      return;
    }
    try {
      setGranted(localStorage.getItem(storageKeyFor(uid)) === "1");
    } catch {
      setGranted(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;
      setUserId(uid);
      setUserEmail(email);
      refreshGranted(uid, email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;

      if (event === "SIGNED_OUT") {
        // Clean up any persisted grant for the previously logged-in user
        if (userId) {
          try {
            localStorage.removeItem(storageKeyFor(userId));
          } catch {
            /* ignore */
          }
        }
        setUserId(null);
        setUserEmail(null);
        setGranted(false);
        return;
      }

      setUserId(uid);
      setUserEmail(email);
      refreshGranted(uid, email);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshGranted]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (!userId) return;
      if (e.key === storageKeyFor(userId)) {
        setGranted(e.newValue === "1");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [userId]);

  const tryUnlock = useCallback(
    (password: string) => {
      if (password !== FINANCEIRO_PASSWORD) return false;
      if (userId) {
        try {
          localStorage.setItem(storageKeyFor(userId), "1");
        } catch {
          /* ignore */
        }
      }
      setGranted(true);
      return true;
    },
    [userId],
  );

  const revoke = useCallback(() => {
    if (userId) {
      try {
        localStorage.removeItem(storageKeyFor(userId));
      } catch {
        /* ignore */
      }
    }
    setGranted(false);
  }, [userId]);

  const value = useMemo<FinanceiroAccessContextValue>(
    () => ({ granted, isAdmin, tryUnlock, revoke }),
    [granted, isAdmin, tryUnlock, revoke],
  );

  return (
    <FinanceiroAccessContext.Provider value={value}>{children}</FinanceiroAccessContext.Provider>
  );
};

export const useFinanceiroAccess = () => {
  const ctx = useContext(FinanceiroAccessContext);
  if (!ctx) {
    throw new Error("useFinanceiroAccess deve ser usado dentro de FinanceiroAccessProvider");
  }
  return ctx;
};
