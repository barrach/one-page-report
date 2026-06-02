import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client dedicado à tabela `user_permissions`.
// Projeto rlpmwuaaosmxlrqtruol — RLS DESABILITADO, leitura/escrita via anon key.
// (A sessão de auth e os dados do ProdControl ficam em outro projeto; aqui é
//  apenas o catálogo de permissões por e-mail.)
const PERMISSIONS_URL = 'https://rlpmwuaaosmxlrqtruol.supabase.co';
const PERMISSIONS_KEY = 'sb_publishable_VwRu9H9CZAauaBReX2SZ_Q_maYAKGje';

export const permissionsClient: SupabaseClient = createClient(PERMISSIONS_URL, PERMISSIONS_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'megahub-perms' },
});
