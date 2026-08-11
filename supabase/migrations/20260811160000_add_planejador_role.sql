-- Papel "planejador": faz tudo dentro dos projetos atribuídos (importar, lançar,
-- editar), menos criar ou excluir projetos.
--
-- ALTER TYPE ... ADD VALUE não roda dentro de transação em versões antigas do
-- Postgres; no Supabase (PG 15+) roda, mas o IF NOT EXISTS evita erro ao
-- reaplicar a migration.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'planejador' AFTER 'admin';
