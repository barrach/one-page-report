import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// CLIENTE DE DADOS DO ONE PAGE REPORT
// Os projetos/contratos do OPR (FRIGO, NTS, OXICORTE, GUAXE, ...) vivem no
// projeto Supabase ORIGINAL: bxmvzxtbjxlicjaewvfg.
// A AUTENTICAÇÃO do MegaHub continua no projeto rlpmwuaaosmxlrqtruol
// (ver ./client.ts) — por isso este client é separado e usado SÓ para dados.
const OPR_DATA_URL = 'https://bxmvzxtbjxlicjaewvfg.supabase.co';
const OPR_DATA_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bXZ6eHRianhsaWNqYWV3dmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjU3MDcsImV4cCI6MjA4NzAwMTcwN30.uM4H1zXJeLedPzTcsntolpP-JSuqyIIPqT4wQxqgOhI';

// storageKey próprio para não conflitar com a sessão de auth (rlpmw).
export const oprDataClient = createClient<Database>(OPR_DATA_URL, OPR_DATA_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'opr-data-bxmvz',
    persistSession: false,
    autoRefreshToken: false,
  },
});
