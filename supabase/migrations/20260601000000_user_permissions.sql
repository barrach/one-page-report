-- ════════════════════════════════════════════════════════════════════════
-- MegaHub — Sistema de permissões por módulo
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

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_user_permissions_updated_at on public.user_permissions;
create trigger trg_user_permissions_updated_at
  before update on public.user_permissions
  for each row execute function public.set_updated_at();

-- ── Helper: o usuário atual é admin? ──────────────────────────────────────
create or replace function public.is_megahub_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin'
       from public.user_permissions
      where email = (select auth.jwt() ->> 'email')),
    (select auth.jwt() ->> 'email') = 'michel.zabalia@megasteam.com.br'
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.user_permissions enable row level security;

drop policy if exists "read own permissions"  on public.user_permissions;
drop policy if exists "admin reads all"        on public.user_permissions;
drop policy if exists "admin writes all"       on public.user_permissions;

-- usuário lê o próprio registro
create policy "read own permissions" on public.user_permissions
  for select to authenticated
  using (email = (select auth.jwt() ->> 'email'));

-- admin lê todos
create policy "admin reads all" on public.user_permissions
  for select to authenticated
  using (public.is_megahub_admin());

-- admin insere / atualiza / remove todos
create policy "admin writes all" on public.user_permissions
  for all to authenticated
  using (public.is_megahub_admin())
  with check (public.is_megahub_admin());

-- ── SEED: usuários e permissões iniciais ──────────────────────────────────
insert into public.user_permissions (email, role, modules) values
  -- ADMIN — todos os módulos
  ('michel.zabalia@megasteam.com.br',     'admin',     array['megapricing','controladoria','prodcontrol','opr']),
  -- DIRETOR — todos os módulos
  ('paulo.araujo@megasteam.com.br',       'diretor',   array['megapricing','controladoria','prodcontrol','opr']),
  ('thiago.cellular@megasteam.com.br',    'diretor',   array['megapricing','controladoria','prodcontrol','opr']),
  ('alexsandro.stolarski@megasteam.com.br','diretor',  array['megapricing','controladoria','prodcontrol','opr']),
  -- ORÇAMENTO — apenas MegaPricing
  ('beatriz.romeu@megasteam.com.br',      'orcamento', array['megapricing']),
  ('sirlaine.meira@megasteam.com.br',     'orcamento', array['megapricing']),
  ('jefferson.figueiredo@megasteam.com.br','orcamento',array['megapricing']),
  ('maiara.silva@megasteam.com.br',       'orcamento', array['megapricing']),
  -- OBRA — ProdControl + One Page Report
  ('edmilson.netto@megasteam.com.br',     'obra',      array['prodcontrol','opr']),
  ('robinson.amaral@megasteam.com.br',    'obra',      array['prodcontrol','opr']),
  ('pedro.melecardi@megasteam.com.br',    'obra',      array['prodcontrol','opr']),
  ('pedro.rosa@megasteam.com.br',         'obra',      array['prodcontrol','opr']),
  ('anderson.melo@megasteam.com.br',      'obra',      array['prodcontrol','opr']),
  ('lucas.albuquerque@megasteam.com.br',  'obra',      array['prodcontrol','opr']),
  -- CLIENTE — apenas One Page Report
  ('perene@megasteam.com.br',             'cliente',   array['opr'])
on conflict (email) do update
  set role = excluded.role, modules = excluded.modules, updated_at = now();
