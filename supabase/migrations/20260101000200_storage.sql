-- ============================================================
-- Storage privado de fichas.
-- Estrutura de path: <tenant_id>/<ficha_id>/<arquivo>
-- Upload público é feito pelo Worker com service_role.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fichas',
  'fichas',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pelo tenant dono da pasta
drop policy if exists fichas_storage_select on storage.objects;
create policy fichas_storage_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fichas'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- Upload/atualização/remoção pelo tenant dono da pasta
drop policy if exists fichas_storage_insert on storage.objects;
create policy fichas_storage_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fichas'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists fichas_storage_update on storage.objects;
create policy fichas_storage_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fichas'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'fichas'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists fichas_storage_delete on storage.objects;
create policy fichas_storage_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fichas'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
