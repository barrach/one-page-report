import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// MegaWork — projeto Supabase "megahub" (rlpmwuaaosmxlrqtruol): mesmas tabelas
// ops_* E auth próprio do MegaWork (sessão independente do MegaHub).
const URL = import.meta.env.VITE_MEGAWORK_SUPABASE_URL || 'https://rlpmwuaaosmxlrqtruol.supabase.co';
const KEY = import.meta.env.VITE_MEGAWORK_SUPABASE_ANON_KEY || 'sb_publishable_VwRu9H9CZAauaBReX2SZ_Q_maYAKGje';

// persistSession:true com storageKey próprio → sessão do MegaWork separada da
// sessão do MegaHub (que vive em outro projeto).
export const megaworkClient: SupabaseClient = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'megawork-auth',
  },
});

// Cria um client efêmero (sem persistência) para operações que não devem
// tocar a sessão atual — ex.: signUp de um novo usuário pelo admin.
export const makeEphemeralClient = (): SupabaseClient =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
