import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as prodSupabase } from '@prodcontrol/integrations/supabase/client';

// AUTENTICAÇÃO UNIFICADA DO MEGAHUB
// Reutiliza o MESMO client/projeto Supabase do ProdControl (adpwboqltejtfzcvrvon).
// Assim a sessão é única (SSO real): login no MegaHub já autentica o ProdControl,
// e a tabela `user_permissions` vive neste mesmo projeto.
//
// Tipado como SupabaseClient genérico para permitir queries a `user_permissions`
// (que não está no Database tipado do ProdControl).
export const supabase = prodSupabase as unknown as SupabaseClient;
