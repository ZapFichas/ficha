-- ============================================================
-- FichaPro — núcleo multi-tenant
-- Supabase / Postgres 15+
-- Regra de ouro: toda tabela de dados de tenant tem tenant_id.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- Trigger padrão de atualizado_em
-- ------------------------------------------------------------
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- TEMPLATES (catálogo global, um por nicho)
-- ------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  nicho_slug text not null unique,
  nome text not null,
  nome_comercial text,
  dominio text,
  publico text,
  dor_principal text,
  -- Estrutura: { secoes: [...], consentimentos_extras: [...] }
  campos_json jsonb not null,
  termo_texto text not null,
  consentimento_lgpd text not null,
  landing_copy jsonb not null default '{}'::jsonb,
  versao integer not null default 1 check (versao > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint templates_nicho_slug_check check (nicho_slug ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint templates_campos_json_check check (jsonb_typeof(campos_json) = 'object'),
  constraint templates_campos_secoes_check check (jsonb_typeof(campos_json -> 'secoes') = 'array')
);

create trigger trg_templates_atualizado
before update on public.templates
for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- TENANTS (um por estúdio/clínica/consultório)
-- ------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome_negocio text not null,
  nicho_slug text not null references public.templates (nicho_slug)
    on update cascade on delete restrict,
  plano text not null default 'solo'
    check (plano in ('solo', 'estudio', 'pro')),
  status text not null default 'trial'
    check (status in ('trial', 'ativo', 'suspenso', 'cancelado')),
  storage_mode text not null default 'drive'
    check (storage_mode in ('drive', 'r2')),
  branding jsonb not null default jsonb_build_object(
    'cor_primaria', '#4F7963',
    'cor_secundaria', '#3a5c4a',
    'cor_fundo', '#dce8e0'
  ),
  email_contato citext,
  whatsapp text,
  timezone text not null default 'America/Sao_Paulo',
  retencao_anos integer not null default 5 check (retencao_anos between 1 and 30),
  trial_expira_em timestamptz not null default (now() + interval '7 days'),
  onboarding_concluido_em timestamptz,
  gateway text check (gateway in ('stripe', 'asaas')),
  gateway_customer_id text,
  gateway_assinatura_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tenants_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$' and slug !~ '-$'),
  constraint tenants_branding_check check (jsonb_typeof(branding) = 'object')
);

create index if not exists idx_tenants_status on public.tenants (status);
create index if not exists idx_tenants_nicho on public.tenants (nicho_slug);

create trigger trg_tenants_atualizado
before update on public.tenants
for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- USUÁRIOS DO TENANT
-- Um login = um tenant no MVP (ver ADR 0006).
-- ------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email citext not null,
  nome text,
  role text not null default 'profissional'
    check (role in ('owner', 'profissional')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists idx_usuarios_tenant on public.usuarios (tenant_id) where ativo;

create trigger trg_usuarios_atualizado
before update on public.usuarios
for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- SEGREDOS DO TENANT (tokens OAuth do Drive)
-- Sem policies: somente service_role acessa.
-- ------------------------------------------------------------
create table if not exists public.tenant_secrets (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  drive_refresh_token_enc text,
  drive_access_token_enc text,
  drive_token_expira_em timestamptz,
  drive_folder_id text,
  drive_email citext,
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- FORMULÁRIOS ATIVOS DO TENANT
-- ------------------------------------------------------------
create table if not exists public.formularios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete restrict,
  nome text not null default 'Ficha padrão',
  -- null = todos os campos; ou { secoes: [{ id, campos: [ids] }] }
  campos_ativos jsonb,
  branding_override jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint formularios_campos_ativos_check check (
    campos_ativos is null or jsonb_typeof(campos_ativos) in ('array', 'object')
  )
);

create unique index if not exists uq_formularios_tenant_template_ativo
  on public.formularios (tenant_id, template_id) where ativo;
create index if not exists idx_formularios_tenant on public.formularios (tenant_id);

create trigger trg_formularios_atualizado
before update on public.formularios
for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- FICHAS
-- dados_json  = resumo não sensível (indexável)
-- dados_cifrados = payload completo (AES-GCM, aplicação)
-- ------------------------------------------------------------
create or replace function public.gerar_protocolo()
returns text
language sql
volatile
as $$
  select 'F' || to_char(now(), 'YYMMDD') || '-' ||
         upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create table if not exists public.fichas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  formulario_id uuid not null references public.formularios (id) on delete restrict,
  template_id uuid not null references public.templates (id) on delete restrict,
  protocolo text not null unique default public.gerar_protocolo(),
  cliente_nome text not null,
  cliente_cpf_hash text,
  cliente_cpf_ultimos4 text check (
    cliente_cpf_ultimos4 is null or cliente_cpf_ultimos4 ~ '^\d{4}$'
  ),
  cliente_data_nasc date,
  menor_idade boolean not null default false,
  status text not null default 'preenchida'
    check (status in ('rascunho', 'preenchida', 'pdf_gerado', 'salva', 'erro')),
  dados_json jsonb not null default '{}'::jsonb,
  dados_cifrados text not null,
  hash_pdf text,
  drive_file_id text,
  r2_key text,
  ip_assinatura inet,
  user_agent_assinatura text,
  timestamp_assinatura timestamptz,
  pdf_gerado_em timestamptz,
  erro_ultimo text,
  tentativas_pdf integer not null default 0,
  retencao_ate date,
  origem text not null default 'form_publico',
  idempotency_key text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint fichas_dados_json_check check (jsonb_typeof(dados_json) = 'object')
);

create unique index if not exists uq_fichas_idempotencia
  on public.fichas (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_fichas_tenant_criado
  on public.fichas (tenant_id, criado_em desc);
create index if not exists idx_fichas_tenant_status
  on public.fichas (tenant_id, status);
create index if not exists idx_fichas_cpf_hash
  on public.fichas (tenant_id, cliente_cpf_hash);
create index if not exists idx_fichas_protocolo on public.fichas (protocolo);
create index if not exists idx_fichas_nome_trgm
  on public.fichas using gin (cliente_nome gin_trgm_ops);

create trigger trg_fichas_atualizado
before update on public.fichas
for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- ANEXOS (documento, autorização, foto, liberação médica)
-- O conteúdo base64 fica aqui até o Worker enviar ao storage.
-- ------------------------------------------------------------
create table if not exists public.ficha_anexos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  tipo text not null,
  nome_arquivo text,
  mime text not null,
  tamanho_bytes bigint,
  conteudo_base64 text,
  storage_key text,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'erro')),
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  constraint ficha_anexos_conteudo_check check (
    conteudo_base64 is not null or storage_key is not null
  )
);

create index if not exists idx_anexos_ficha on public.ficha_anexos (ficha_id);
create index if not exists idx_anexos_pendentes
  on public.ficha_anexos (status) where status = 'pendente';

-- ------------------------------------------------------------
-- ASSINATURAS (trilha probatória)
-- ------------------------------------------------------------
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  papel text not null default 'cliente'
    check (papel in ('cliente', 'responsavel')),
  imagem_base64 text not null,
  hash_conteudo text not null,
  ip inet,
  user_agent text,
  timestamp timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (ficha_id, papel)
);

create index if not exists idx_assinaturas_tenant on public.assinaturas (tenant_id);

-- ------------------------------------------------------------
-- CONSENTIMENTOS (LGPD, termo e extras por nicho)
-- tipo = 'lgpd' | 'termo' | 'extra:<id>'
-- ------------------------------------------------------------
create table if not exists public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  tipo text not null,
  texto_aceito text not null,
  versao_termo text,
  aceito boolean not null default false,
  ip inet,
  user_agent text,
  timestamp timestamptz not null default now(),
  unique (ficha_id, tipo)
);

create index if not exists idx_consentimentos_tenant on public.consentimentos (tenant_id);

-- ------------------------------------------------------------
-- EVENTOS (funil / observabilidade)
-- ------------------------------------------------------------
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  ficha_id uuid references public.fichas (id) on delete set null,
  tipo text not null,
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_eventos_tenant_tipo
  on public.eventos (tenant_id, tipo, criado_em desc);
create index if not exists idx_eventos_ficha on public.eventos (ficha_id);
create index if not exists idx_eventos_criado on public.eventos (criado_em desc);

-- ------------------------------------------------------------
-- WEBHOOKS (idempotência de billing)
-- ------------------------------------------------------------
create table if not exists public.webhook_eventos (
  id text primary key,
  gateway text not null,
  payload jsonb not null,
  processado_em timestamptz,
  erro text,
  criado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Expurgo por retenção (LGPD)
-- A limpeza dos arquivos no storage é feita pelo Worker/cron.
-- ------------------------------------------------------------
create or replace function public.expurgar_fichas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removidas integer;
begin
  with apagadas as (
    delete from public.fichas
    where retencao_ate is not null
      and retencao_ate < current_date
      and status = 'salva'
    returning 1
  )
  select count(*) into removidas from apagadas;
  return removidas;
end;
$$;

revoke execute on function public.expurgar_fichas_vencidas() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Onboarding atômico: tenant + formulário + usuário owner.
-- Chamado apenas pelo Worker com service_role.
-- ------------------------------------------------------------
create or replace function public.criar_tenant(
  p_user_id uuid,
  p_email text,
  p_slug text,
  p_nome_negocio text,
  p_nicho_slug text,
  p_nome_usuario text default null,
  p_branding jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_template public.templates%rowtype;
  v_tenant public.tenants%rowtype;
  v_form public.formularios%rowtype;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' or p_slug ~ '-$' then
    raise exception 'slug_invalido' using errcode = '22023';
  end if;

  if exists (select 1 from public.usuarios u where u.id = p_user_id) then
    raise exception 'usuario_ja_vinculado' using errcode = '23505';
  end if;

  select * into v_template
  from public.templates
  where nicho_slug = p_nicho_slug and ativo = true;

  if not found then
    raise exception 'template_inexistente' using errcode = 'P0002';
  end if;

  insert into public.tenants (
    slug, nome_negocio, nicho_slug, plano, status, storage_mode,
    branding, email_contato, retencao_anos
  ) values (
    p_slug, p_nome_negocio, p_nicho_slug, 'solo', 'trial', 'drive',
    coalesce(p_branding, '{}'::jsonb), p_email, 5
  ) returning * into v_tenant;

  insert into public.formularios (tenant_id, template_id, nome, ativo)
  values (v_tenant.id, v_template.id, 'Ficha padrão', true)
  returning * into v_form;

  insert into public.usuarios (id, tenant_id, email, nome, role, ativo)
  values (p_user_id, v_tenant.id, p_email, coalesce(p_nome_usuario, split_part(p_email, '@', 1)), 'owner', true);

  return jsonb_build_object(
    'tenant_id', v_tenant.id,
    'slug', v_tenant.slug,
    'formulario_id', v_form.id,
    'template_slug', v_template.nicho_slug,
    'status', v_tenant.status
  );
end;
$$;

revoke execute on function public.criar_tenant(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.criar_tenant(uuid, text, text, text, text, text, jsonb)
  to service_role;
