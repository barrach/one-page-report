import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Cliente Supabase do One Page Report — dados (FRIGO, NTS, OXICORTE, GUAXE, ...)
// e autenticação do próprio app vivem no projeto bpcfsdrhnxdvahmocdjp
// (migrado do Lovable Cloud em 2026-08-11).
const OPR_DATA_URL = 'https://bpcfsdrhnxdvahmocdjp.supabase.co';
const OPR_DATA_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwY2ZzZHJobnhkdmFobW9jZGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDY4NzMsImV4cCI6MjEwMjAyMjg3M30.V5_kOKK0L8JOyNTqRgOqNNnl6S30gqRCaaHaByIHSO4';

export const oprDataClient = createClient<Database>(OPR_DATA_URL, OPR_DATA_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
