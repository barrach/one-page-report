-- ════════════════════════════════════════════════════════════════════════
-- Evidências fotográficas da obra — bucket de Storage e suas políticas.
--
-- O bucket é PRIVADO: foto de dentro da planta do cliente não pode ficar
-- acessível por quem tiver o link. O app lê por URL assinada, de validade curta.
--
-- Ao contrário das tabelas, o RLS de `storage.objects` vem LIGADO por padrão no
-- Supabase — então aqui as políticas realmente valem, e é por elas que só quem
-- lança dados consegue subir ou apagar arquivo.
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  10485760, -- 10 MB: o app já reduz a foto antes de subir; isto é só o teto
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Quem edita: administrador, gestor e planejador. Mesma regra do app.
create or replace function public.pode_lancar_dados(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('admin', 'gestor', 'planejador')
  )
$$;

-- Ler: qualquer usuário autenticado. O cliente precisa ver as evidências do
-- relatório dele.
drop policy if exists "Evidencias visiveis para autenticados" on storage.objects;
create policy "Evidencias visiveis para autenticados"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidencias');

-- Subir, substituir e apagar: só quem lança dados.
drop policy if exists "Evidencias enviadas por quem lanca" on storage.objects;
create policy "Evidencias enviadas por quem lanca"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidencias' and public.pode_lancar_dados(auth.uid()));

drop policy if exists "Evidencias atualizadas por quem lanca" on storage.objects;
create policy "Evidencias atualizadas por quem lanca"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'evidencias' and public.pode_lancar_dados(auth.uid()));

drop policy if exists "Evidencias apagadas por quem lanca" on storage.objects;
create policy "Evidencias apagadas por quem lanca"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'evidencias' and public.pode_lancar_dados(auth.uid()));
