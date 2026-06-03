import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as mainClient } from '@/integrations/supabase/client';

// AUTENTICAÇÃO DO MEGAHUB
// Usa o cliente Supabase PRINCIPAL (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY,
// projeto rlpmwuaaosmxlrqtruol) — onde os usuários do MegaHub (ex.: michel.zabalia)
// estão cadastrados. NÃO usar o client do ProdControl/MegaWork/Budget.
//
// Tipado como SupabaseClient genérico para permitir queries a tabelas fora do
// Database tipado (ex.: user_permissions, lidas via permissionsClient).
export const supabase = mainClient as unknown as SupabaseClient;
