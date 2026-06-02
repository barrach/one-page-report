import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Projeto Supabase DEDICADO e independente do MegaWork (mdguosdzbhbqytvnvrfx).
// Hospeda auth próprio + tabelas ops_* (roles, users, obras, checkins, solicitacoes).
const URL = import.meta.env.VITE_MEGAWORK_SUPABASE_URL || 'https://mdguosdzbhbqytvnvrfx.supabase.co';
const KEY = import.meta.env.VITE_MEGAWORK_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZ3Vvc2R6YmhicXl0dm52cmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjEzNTYsImV4cCI6MjA5NTk5NzM1Nn0.N25xNS-OMZsw7urqG3gs6JCzBpu-k6XnwumY5EIaRKM';

// Sessão própria do MegaWork (storageKey exclusivo → não interfere no MegaHub)
export const megaworkClient: SupabaseClient = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'megawork-auth',
  },
});

// Client efêmero (sem persistência) — usado para signUp pelo admin sem
// afetar a sessão atual.
export const makeEphemeralClient = (): SupabaseClient =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
