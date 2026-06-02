-- ════════════════════════════════════════════════════════════════════════
-- OpsControl — Gestão de campo (LPS, check-in, RDO, planejamento puxado)
-- ════════════════════════════════════════════════════════════════════════

-- ── Roles ──────────────────────────────────────────────────────────────────
create table if not exists public.ops_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name in ('Admin','Gestor','Engenheiro','Encarregado')),
  created_at  timestamptz not null default now()
);

insert into public.ops_roles (name) values
  ('Admin'), ('Gestor'), ('Engenheiro'), ('Encarregado')
on conflict (name) do nothing;

-- ── Usuários ───────────────────────────────────────────────────────────────
create table if not exists public.ops_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  nome        text not null default '',
  role        text not null default 'Encarregado'
              check (role in ('Admin','Gestor','Engenheiro','Encarregado')),
  obra_id     uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Obras / Contratos ──────────────────────────────────────────────────────
create table if not exists public.ops_obras (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,
  cliente              text not null default '',
  contrato             text not null default '',
  data_inicio          date,
  data_termino         date,
  status               text not null default 'ativa' check (status in ('ativa','encerrada')),
  gestor_responsavel   text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.ops_users add constraint ops_users_obra_fk
  foreign key (obra_id) references public.ops_obras(id) on delete set null;

-- updated_at automático
create or replace function public.ops_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_ops_users_updated on public.ops_users;
create trigger trg_ops_users_updated before update on public.ops_users
  for each row execute function public.ops_set_updated_at();

drop trigger if exists trg_ops_obras_updated on public.ops_obras;
create trigger trg_ops_obras_updated before update on public.ops_obras
  for each row execute function public.ops_set_updated_at();

-- RLS desabilitado (ferramenta interna; acesso via anon key como as demais tabelas)
alter table public.ops_roles  disable row level security;
alter table public.ops_users  disable row level security;
alter table public.ops_obras  disable row level security;

-- Seed: admin conhecido
insert into public.ops_users (email, nome, role) values
  ('michel.zabalia@megasteam.com.br', 'Michel Zabalia', 'Admin')
on conflict (email) do update set role = excluded.role;
