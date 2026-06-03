-- ════════════════════════════════════════════════════════════════════════
-- One Page Report — tabela 'projects' no projeto rlpmwuaaosmxlrqtruol
-- (OPCIONAL) Rodar no SQL Editor desse projeto para persistir os projetos do
-- OPR no Supabase. Sem isso, o OPR persiste no localStorage (fallback).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.projects (
  id          text primary key,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.projects disable row level security;
