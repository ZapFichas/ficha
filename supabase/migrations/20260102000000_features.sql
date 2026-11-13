-- ============================================================
-- FichaPro — features de produto (v2)
-- Campos personalizados, equipe, pendências, alterações e permissões.
-- Idempotente: pode ser aplicada em bancos que já têm o núcleo.
-- ============================================================

-- ------------------------------------------------------------
-- Permissões operacionais do tenant (fluxos de exceção)
-- ------------------------------------------------------------
alter table public.tenants
  add column if not exists permissoes jsonb not null default jsonb_build_object(
    'permite_pendencia_responsavel', true,
    'permite_alteracao_dados', true,
    'exige_aprovacao_alteracao', true,
    'mostrar_vitrine', true,
    'permitir_profissional_customizado', false
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_permissoes_check'
  ) then
    alter table public.tenants
      add constraint tenants_permissoes_check check (jsonb_typeof(permissoes) = 'object');
  end if;
end $$;

-- O RLS já limita a linha; a coluna precisa constar no grant de update.
grant update (permissoes) on public.tenants to authenticated;

-- ------------------------------------------------------------
-- Campos personalizados por formulário
-- ------------------------------------------------------------
alter table public.formularios
  add column if not exists campos_customizados jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'formularios_campos_customizados_check'
  ) then
    alter table public.formularios
      add constraint formularios_campos_customizados_check
      check (jsonb_typeof(campos_customizados) = 'array');
  end if;
end $$;

-- ------------------------------------------------------------
-- Profissionais responsáveis (equipe do tenant)
-- Não cria login: é o cadastro operacional usado nas fichas.
-- ------------------------------------------------------------
create table if not exists public.profissionais (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null,
  email citext,
  telefone text,
  especialidade text,
  registro text,
  cor text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_profissionais_tenant
  on public.profissionais (tenant_id) where ativo;

create trigger trg_profissionais_atualizado
before update on public.profissionais
for each row execute function public.set_atualizado_em();

alter table public.profissionais enable row level security;

revoke all on public.profissionais from anon;
grant select, insert, update, delete on public.profissionais to authenticated;

drop policy if exists profissionais_select_tenant on public.profissionais;
create policy profissionais_select_tenant
  on public.profissionais for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists profissionais_insert_owner on public.profissionais;
create policy profissionais_insert_owner
  on public.profissionais for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists profissionais_update_owner on public.profissionais;
create policy profissionais_update_owner
  on public.profissionais for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists profissionais_delete_owner on public.profissionais;
create policy profissionais_delete_owner
  on public.profissionais for delete
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner());

-- ------------------------------------------------------------
-- Vínculo da ficha com o profissional
-- ------------------------------------------------------------
alter table public.fichas
  add column if not exists profissional_id uuid references public.profissionais (id) on delete set null;

create index if not exists idx_fichas_profissional
  on public.fichas (tenant_id, profissional_id, criado_em desc);

-- ------------------------------------------------------------
-- Pendências da ficha (ex.: documentação do responsável legal)
-- ------------------------------------------------------------
alter table public.fichas
  add column if not exists pendencias jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fichas_pendencias_check'
  ) then
    alter table public.fichas
      add constraint fichas_pendencias_check check (jsonb_typeof(pendencias) = 'array');
  end if;
end $$;

-- ------------------------------------------------------------
-- Anexos: identificador externo (Drive) para download posterior
-- ------------------------------------------------------------
alter table public.ficha_anexos
  add column if not exists storage_external_id text;

-- ------------------------------------------------------------
-- Solicitações de alteração de dados
-- O cliente abre pelo protocolo + últimos 4 do CPF.
-- O dono aprova e aplica a edição com auditoria.
-- ------------------------------------------------------------
create table if not exists public.ficha_alteracoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'recusada', 'cancelada')),
  justificativa text not null,
  campos jsonb not null default '[]'::jsonb,
  resposta text,
  origem text not null default 'cliente',
  ip inet,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users (id) on delete set null
);

create index if not exists idx_alteracoes_tenant_status
  on public.ficha_alteracoes (tenant_id, status, criado_em desc);
create index if not exists idx_alteracoes_ficha
  on public.ficha_alteracoes (ficha_id, criado_em desc);

alter table public.ficha_alteracoes enable row level security;

revoke all on public.ficha_alteracoes from anon;
revoke insert, delete on public.ficha_alteracoes from authenticated;
grant select on public.ficha_alteracoes to authenticated;
grant update (status, resposta, resolvido_em, resolvido_por) on public.ficha_alteracoes to authenticated;

drop policy if exists alteracoes_select_tenant on public.ficha_alteracoes;
create policy alteracoes_select_tenant
  on public.ficha_alteracoes for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists alteracoes_update_owner on public.ficha_alteracoes;
create policy alteracoes_update_owner
  on public.ficha_alteracoes for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

-- Escrita pública/entrada de solicitações é feita exclusivamente pela API
-- com service_role. Nenhuma policy de INSERT para anon/authenticated.

-- ------------------------------------------------------------
-- View de apoio para a jornada do cliente (opcional, sem PII)
-- ------------------------------------------------------------
create or replace view public.clientes_jornada as
select
  tenant_id,
  cliente_cpf_hash,
  min(cliente_nome) as cliente_nome,
  max(cliente_cpf_ultimos4) as cliente_cpf_ultimos4,
  count(*)::int as total_fichas,
  max(criado_em) as ultima_ficha_em,
  min(criado_em) as primeira_ficha_em
from public.fichas
where cliente_cpf_hash is not null
group by tenant_id, cliente_cpf_hash;

-- A view respeita o RLS das fichas quando consultada por authenticated.
alter view public.clientes_jornada set (security_invoker = true);
revoke all on public.clientes_jornada from anon;
grant select on public.clientes_jornada to authenticated;

-- ------------------------------------------------------------
-- Índice para busca por CPF (hash) e recência
-- ------------------------------------------------------------
create index if not exists idx_fichas_cpf_recencia
  on public.fichas (tenant_id, cliente_cpf_hash, criado_em desc);

-- ------------------------------------------------------------
-- Backfill: todo usu�rio do tenant vira um profissional inicial.
-- Evita que o select de profissional fique vazio ap�s a migration.
-- ------------------------------------------------------------
insert into public.profissionais (tenant_id, nome, email, ativo)
select u.tenant_id,
       coalesce(nullif(trim(u.nome), ''), split_part(u.email::text, '@', 1)),
       u.email,
       true
from public.usuarios u
where u.ativo = true
  and u.email is not null
  and not exists (
    select 1 from public.profissionais p
    where p.tenant_id = u.tenant_id
      and p.email = u.email
  );
