-- ════════════════════════════════════════════════════════════════════════
-- MegaWork — Solicitações de acesso (rodar no projeto rlpmwuaaosmxlrqtruol)
-- ════════════════════════════════════════════════════════════════════════
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

alter table public.ops_solicitacoes disable row level security;
