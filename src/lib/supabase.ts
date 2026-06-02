import { createClient } from '@supabase/supabase-js';

// Projeto Supabase dedicado à AUTENTICAÇÃO e permissões do MegaHub.
// (Os dados dos módulos — OPR, ProdControl etc. — usam outros clients.)
const SUPABASE_URL = 'https://rlpmwuaaosmxlrqtruol.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VwRu9H9CZAauaBReX2SZ_Q_maYAKGje';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'megahub-auth',
  },
});
