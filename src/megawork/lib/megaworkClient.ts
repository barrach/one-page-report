import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// MegaWork usa o Supabase principal do projeto (mesmo do One Page Report).
// Cast genérico para permitir queries às tabelas ops_* (fora do Database tipado).
export const megaworkClient = supabase as unknown as SupabaseClient;
