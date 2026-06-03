import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as mainClient } from '@/integrations/supabase/client';

// AUTENTICAÇÃO DO MEGAHUB
// Usa o cliente PRINCIPAL (projeto rlpmwuaaosmxlrqtruol) — onde os usuários do
// MegaHub (ex.: michel.zabalia) estão cadastrados. NÃO usar o client do
// ProdControl/Budget.
export const supabase = mainClient as unknown as SupabaseClient;
