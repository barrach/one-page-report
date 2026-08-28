-- ════════════════════════════════════════════════════════════════════════
-- Acesso por obra, valendo no BANCO.
--
-- O app já recorta a lista de obras por papel, mas isso é filtro de tela: a
-- chave anônima vai no bundle do site, e sem RLS qualquer pessoa com ela lê
-- `projects` inteiro por HTTP — com valor de contrato, cronograma e as fotos
-- registradas. Esta migration é a metade que realmente nega.
--
-- Regra:
--   • admin, planejador, gestor  → todas as obras (é a equipe da Megasteam)
--   • visualizador, cliente      → só as obras em `project_assignments`
--   • escrever                   → só quem lança dados
--
-- Rodar no SQL Editor do projeto bpcfsdrhnxdvahmocdjp.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Funções de apoio ───────────────────────────────────────────────────
-- SECURITY DEFINER porque elas consultam `user_roles`, que também tem RLS:
-- sem isso a política de `projects` faria uma leitura que a própria política
-- de `user_roles` bloquearia, e ninguém enxergaria nada.

create or replace function public.tem_papel(_user_id uuid, _papeis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = any(_papeis)
  )
$$;

/** Equipe da Megasteam: enxerga todas as obras. */
create or replace function public.ve_todas_as_obras(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel(_user_id, array['admin', 'planejador', 'gestor'])
$$;

/** Quem lança número: mesma regra do `canEdit` do app. */
create or replace function public.pode_lancar_dados(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel(_user_id, array['admin', 'gestor', 'planejador'])
$$;

create or replace function public.obra_liberada(_user_id uuid, _project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_assignments
    where user_id = _user_id and project_id::text = _project_id
  )
$$;

-- ─── projects ───────────────────────────────────────────────────────────
alter table public.projects enable row level security;

drop policy if exists "Obras visiveis conforme o papel" on public.projects;
create policy "Obras visiveis conforme o papel"
  on public.projects for select
  to authenticated
  using (
    public.ve_todas_as_obras(auth.uid())
    or public.obra_liberada(auth.uid(), id::text)
  );

-- Escrita: quem lança dados. O update repete a condição no WITH CHECK para
-- que ninguém possa reescrever a linha de um jeito que ela deixe de ser sua.
drop policy if exists "Obras criadas por quem lanca" on public.projects;
create policy "Obras criadas por quem lanca"
  on public.projects for insert
  to authenticated
  with check (public.pode_lancar_dados(auth.uid()));

drop policy if exists "Obras alteradas por quem lanca" on public.projects;
create policy "Obras alteradas por quem lanca"
  on public.projects for update
  to authenticated
  using (public.pode_lancar_dados(auth.uid()))
  with check (public.pode_lancar_dados(auth.uid()));

-- Excluir obra é só do administrador, como já é na tela.
drop policy if exists "Obras excluidas pelo administrador" on public.projects;
create policy "Obras excluidas pelo administrador"
  on public.projects for delete
  to authenticated
  using (public.tem_papel(auth.uid(), array['admin']));

-- ─── user_roles ─────────────────────────────────────────────────────────
-- Cada um lê o próprio papel; o administrador lê todos. Quem escreve papel é a
-- edge function `admin-users`, que roda com a service key e passa por cima do
-- RLS — por isso não há policy de escrita aqui.
alter table public.user_roles enable row level security;

drop policy if exists "Cada um le o proprio papel" on public.user_roles;
create policy "Cada um le o proprio papel"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.tem_papel(auth.uid(), array['admin']));

-- ─── project_assignments ────────────────────────────────────────────────
alter table public.project_assignments enable row level security;

drop policy if exists "Cada um le as proprias atribuicoes" on public.project_assignments;
create policy "Cada um le as proprias atribuicoes"
  on public.project_assignments for select
  to authenticated
  using (user_id = auth.uid() or public.tem_papel(auth.uid(), array['admin']));

-- ─── profiles ───────────────────────────────────────────────────────────
-- Nome e e-mail de todo mundo não é dado de obra, mas também não é público.
alter table public.profiles enable row level security;

drop policy if exists "Perfil proprio e do administrador" on public.profiles;
create policy "Perfil proprio e do administrador"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid() or public.tem_papel(auth.uid(), array['admin']));

drop policy if exists "Cada um edita o proprio perfil" on public.profiles;
create policy "Cada um edita o proprio perfil"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
