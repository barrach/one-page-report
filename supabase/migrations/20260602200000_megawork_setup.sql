-- ════════════════════════════════════════════════════════════════════════
-- MegaWork — setup completo no projeto DEDICADO (mdguosdzbhbqytvnvrfx)
-- Rodar no SQL Editor desse projeto. Cria todas as tabelas ops_* + seeds.
-- ════════════════════════════════════════════════════════════════════════

-- updated_at automático (helper)
create or replace function public.ops_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── ops_roles ───────────────────────────────────────────────────────────────
create table if not exists public.ops_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name in ('Admin','Gestor','Engenheiro','Encarregado')),
  created_at  timestamptz not null default now()
);

insert into public.ops_roles (name) values
  ('Admin'), ('Gestor'), ('Engenheiro'), ('Encarregado')
on conflict (name) do nothing;

-- ── ops_obras ───────────────────────────────────────────────────────────────
create table if not exists public.ops_obras (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  cliente             text not null default '',
  contrato            text not null default '',
  data_inicio         date,
  data_termino        date,
  status              text not null default 'ativa' check (status in ('ativa','encerrada')),
  gestor_responsavel  text not null default '',
  num_turnos          int  not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_ops_obras_updated on public.ops_obras;
create trigger trg_ops_obras_updated before update on public.ops_obras
  for each row execute function public.ops_set_updated_at();

-- ── ops_users ───────────────────────────────────────────────────────────────
create table if not exists public.ops_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  nome        text not null default '',
  role        text not null default 'Encarregado'
              check (role in ('Admin','Gestor','Engenheiro','Encarregado')),
  obra_id     uuid references public.ops_obras(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_ops_users_updated on public.ops_users;
create trigger trg_ops_users_updated before update on public.ops_users
  for each row execute function public.ops_set_updated_at();

-- ── ops_checkins ────────────────────────────────────────────────────────────
create table if not exists public.ops_checkins (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.ops_obras(id) on delete cascade,
  data              date not null default current_date,
  turno             int not null default 1,
  tipo              text not null check (tipo in ('checkin','checkout')),
  horario           text not null default '',
  encarregado_email text not null default '',
  encarregado_nome  text not null default '',
  atividades        text not null default '',
  observacoes       text not null default '',
  created_at        timestamptz not null default now(),
  unique (obra_id, data, turno, tipo)
);

create index if not exists idx_ops_checkins_obra_data
  on public.ops_checkins (obra_id, data);

-- ── ops_solicitacoes ────────────────────────────────────────────────────────
create table if not exists public.ops_solicitacoes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  email           text not null,
  telefone        text not null default '',
  obra_interesse  text not null default '',
  role_desejado   text not null default 'Encarregado'
                  check (role_desejado in ('Encarregado','Engenheiro','Gestor')),
  status          text not null default 'pendente'
                  check (status in ('pendente','aprovado','rejeitado')),
  created_at      timestamptz not null default now()
);

-- ── RLS desabilitado (acesso via anon key; controle de acesso no frontend) ──
alter table public.ops_roles        disable row level security;
alter table public.ops_obras        disable row level security;
alter table public.ops_users        disable row level security;
alter table public.ops_checkins     disable row level security;
alter table public.ops_solicitacoes disable row level security;

-- ── Seed: usuário admin do MegaWork ─────────────────────────────────────────
insert into public.ops_users (email, nome, role) values
  ('michel.zabalia@megasteam.com.br', 'Michel Zabalia', 'Admin')
on conflict (email) do update set role = excluded.role, nome = excluded.nome;
