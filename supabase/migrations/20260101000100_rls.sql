-- ============================================================
-- FichaPro — RLS e autorização
-- Regra: tenant A nunca enxerga tenant B.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers de sessão
-- O tenant vem do claim `tenant_id` (custom access token hook) ou,
-- como fallback, da tabela usuarios. SECURITY DEFINER evita recursão
-- de RLS ao consultar usuarios.
-- ------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'tenant_id', '')::uuid,
    (
      select u.tenant_id
      from public.usuarios u
      where u.id = auth.uid()
        and u.ativo = true
      limit 1
    )
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.ativo = true
      and u.role = 'owner'
      and u.tenant_id = public.current_tenant_id()
  );
$$;

revoke execute on function public.current_tenant_id() from public;
revoke execute on function public.is_owner() from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- ------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ------------------------------------------------------------
alter table public.templates       enable row level security;
alter table public.tenants         enable row level security;
alter table public.usuarios        enable row level security;
alter table public.tenant_secrets  enable row level security;
alter table public.formularios     enable row level security;
alter table public.fichas          enable row level security;
alter table public.ficha_anexos    enable row level security;
alter table public.assinaturas     enable row level security;
alter table public.consentimentos  enable row level security;
alter table public.eventos         enable row level security;
alter table public.webhook_eventos enable row level security;

-- ------------------------------------------------------------
-- Privilégios de coluna: mesmo com RLS, um usuário não pode
-- alterar tenant_id, role, plano ou status.
-- ------------------------------------------------------------
revoke insert, update, delete on public.templates from anon, authenticated;

revoke insert, delete on public.tenants from anon, authenticated;
revoke update on public.tenants from anon, authenticated;
grant update (nome_negocio, branding, email_contato, whatsapp, timezone, retencao_anos, onboarding_concluido_em)
  on public.tenants to authenticated;

revoke insert, delete on public.usuarios from anon, authenticated;
revoke update on public.usuarios from anon, authenticated;
grant update (nome, email) on public.usuarios to authenticated;

revoke all on public.tenant_secrets from anon, authenticated;

revoke insert, update, delete on public.fichas from anon, authenticated;
revoke insert, update, delete on public.ficha_anexos from anon, authenticated;
revoke insert, update, delete on public.assinaturas from anon, authenticated;
revoke insert, update, delete on public.consentimentos from anon, authenticated;
revoke update, delete on public.eventos from anon, authenticated;
revoke all on public.webhook_eventos from anon, authenticated;

-- ------------------------------------------------------------
-- TEMPLATES — leitura pública dos ativos
-- ------------------------------------------------------------
drop policy if exists templates_select_publico on public.templates;
create policy templates_select_publico
  on public.templates for select
  to anon, authenticated
  using (ativo = true);

-- ------------------------------------------------------------
-- TENANTS
-- ------------------------------------------------------------
drop policy if exists tenants_select_tenant on public.tenants;
create policy tenants_select_tenant
  on public.tenants for select
  to authenticated
  using (id = public.current_tenant_id());

drop policy if exists tenants_update_owner on public.tenants;
create policy tenants_update_owner
  on public.tenants for update
  to authenticated
  using (id = public.current_tenant_id() and public.is_owner())
  with check (id = public.current_tenant_id() and public.is_owner());

-- ------------------------------------------------------------
-- USUÁRIOS
-- ------------------------------------------------------------
drop policy if exists usuarios_select_tenant on public.usuarios;
create policy usuarios_select_tenant
  on public.usuarios for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists usuarios_update_proprio on public.usuarios;
create policy usuarios_update_proprio
  on public.usuarios for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and tenant_id = public.current_tenant_id());

drop policy if exists usuarios_update_owner on public.usuarios;
create policy usuarios_update_owner
  on public.usuarios for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id());

-- ------------------------------------------------------------
-- FORMULÁRIOS DO TENANT
-- ------------------------------------------------------------
drop policy if exists formularios_select_tenant on public.formularios;
create policy formularios_select_tenant
  on public.formularios for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists formularios_insert_owner on public.formularios;
create policy formularios_insert_owner
  on public.formularios for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists formularios_update_owner on public.formularios;
create policy formularios_update_owner
  on public.formularios for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists formularios_delete_owner on public.formularios;
create policy formularios_delete_owner
  on public.formularios for delete
  to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_owner());

-- ------------------------------------------------------------
-- FICHAS — leitura pelo tenant; escrita só via service_role/API
-- ------------------------------------------------------------
drop policy if exists fichas_select_tenant on public.fichas;
create policy fichas_select_tenant
  on public.fichas for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- ------------------------------------------------------------
-- ANEXOS
-- ------------------------------------------------------------
drop policy if exists anexos_select_tenant on public.ficha_anexos;
create policy anexos_select_tenant
  on public.ficha_anexos for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- ------------------------------------------------------------
-- ASSINATURAS
-- ------------------------------------------------------------
drop policy if exists assinaturas_select_tenant on public.assinaturas;
create policy assinaturas_select_tenant
  on public.assinaturas for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- ------------------------------------------------------------
-- CONSENTIMENTOS
-- ------------------------------------------------------------
drop policy if exists consentimentos_select_tenant on public.consentimentos;
create policy consentimentos_select_tenant
  on public.consentimentos for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- ------------------------------------------------------------
-- EVENTOS — leitura e inserção de eventos pelo próprio tenant
-- ------------------------------------------------------------
drop policy if exists eventos_select_tenant on public.eventos;
create policy eventos_select_tenant
  on public.eventos for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists eventos_insert_tenant on public.eventos;
create policy eventos_insert_tenant
  on public.eventos for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (
      ficha_id is null
      or exists (
        select 1 from public.fichas f
        where f.id = ficha_id
          and f.tenant_id = public.current_tenant_id()
      )
    )
  );

-- ------------------------------------------------------------
-- Custom Access Token Hook: injeta tenant_id no JWT.
-- Configure em Authentication > Hooks > Custom Access Token.
-- ------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims jsonb;
  tenant uuid;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  select u.tenant_id
    into tenant
  from public.usuarios u
  where u.id = (event ->> 'user_id')::uuid
    and u.ativo = true
  limit 1;

  if tenant is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(tenant::text), true);
    claims := jsonb_set(claims, '{tenant_role}',
      to_jsonb((select u.role from public.usuarios u where u.id = (event ->> 'user_id')::uuid limit 1)),
      true);
  end if;

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

