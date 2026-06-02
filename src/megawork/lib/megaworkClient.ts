import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// MegaWork usa o projeto Supabase "megahub" (rlpmwuaaosmxlrqtruol) — o MESMO
// onde estão as tabelas ops_obras, ops_users e ops_checkins (e user_permissions).
// Permite override por env; cai no padrão hardcoded se não definido.
const URL = import.meta.env.VITE_MEGAWORK_SUPABASE_URL || 'https://rlpmwuaaosmxlrqtruol.supabase.co';
const KEY = import.meta.env.VITE_MEGAWORK_SUPABASE_ANON_KEY || 'sb_publishable_VwRu9H9CZAauaBReX2SZ_Q_maYAKGje';

// persistSession:false — não interfere na sessão de auth (que vive em outro projeto)
export const megaworkClient: SupabaseClient = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'megawork-data' },
});
