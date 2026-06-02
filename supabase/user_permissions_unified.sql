-- ════════════════════════════════════════════════════════════════════════
-- MegaHub — user_permissions no projeto UNIFICADO (ProdControl: adpwboqltejtfzcvrvon)
-- Rodar no SQL Editor do projeto adpwboqltejtfzcvrvon.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.user_permissions (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  modules     text[] not null default '{}',
  role        text not null default 'cliente'
              check (role in ('admin','diretor','orcamento','obra','cliente')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS DESABILITADO (dados são apenas permissões, não sensíveis)
alter table public.user_permissions disable row level security;

-- Seed dos usuários e permissões
insert into public.user_permissions (email, role, modules) values
  ('michel.zabalia@megasteam.com.br',      'admin',     array['megapricing','controladoria','prodcontrol','opr']),
  ('paulo.araujo@megasteam.com.br',        'diretor',   array['megapricing','controladoria','prodcontrol','opr']),
  ('thiago.cellular@megasteam.com.br',     'diretor',   array['megapricing','controladoria','prodcontrol','opr']),
  ('alexsandro.stolarski@megasteam.com.br','diretor',   array['megapricing','controladoria','prodcontrol','opr']),
  ('beatriz.romeu@megasteam.com.br',       'orcamento', array['megapricing']),
  ('sirlaine.meira@megasteam.com.br',      'orcamento', array['megapricing']),
  ('jefferson.figueiredo@megasteam.com.br','orcamento', array['megapricing']),
  ('maiara.silva@megasteam.com.br',        'orcamento', array['megapricing']),
  ('edmilson.netto@megasteam.com.br',      'obra',      array['prodcontrol','opr']),
  ('robinson.amaral@megasteam.com.br',     'obra',      array['prodcontrol','opr']),
  ('pedro.melecardi@megasteam.com.br',     'obra',      array['prodcontrol','opr']),
  ('pedro.rosa@megasteam.com.br',          'obra',      array['prodcontrol','opr']),
  ('anderson.melo@megasteam.com.br',       'obra',      array['prodcontrol','opr']),
  ('lucas.albuquerque@megasteam.com.br',   'obra',      array['prodcontrol','opr']),
  ('perene@megasteam.com.br',              'cliente',   array['opr'])
on conflict (email) do update
  set role = excluded.role, modules = excluded.modules, updated_at = now();
