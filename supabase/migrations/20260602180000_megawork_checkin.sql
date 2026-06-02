-- ════════════════════════════════════════════════════════════════════════
-- MegaWork — Check-in / Check-out (LPS)
-- ════════════════════════════════════════════════════════════════════════

-- Número de turnos por obra
alter table public.ops_obras add column if not exists num_turnos int not null default 1;

-- Registros de check-in / check-out
create table if not exists public.ops_checkins (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.ops_obras(id) on delete cascade,
  data              date not null default current_date,
  turno             int not null default 1,
  tipo              text not null check (tipo in ('checkin','checkout')),
  horario           text not null default '',          -- HH:MM
  encarregado_email text not null default '',
  encarregado_nome  text not null default '',
  atividades        text not null default '',
  observacoes       text not null default '',
  created_at        timestamptz not null default now(),
  -- um registro por obra/data/turno/tipo
  unique (obra_id, data, turno, tipo)
);

alter table public.ops_checkins disable row level security;

create index if not exists idx_ops_checkins_obra_data
  on public.ops_checkins (obra_id, data);
