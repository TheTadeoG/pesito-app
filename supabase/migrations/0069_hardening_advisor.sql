-- Avisos del Security Advisor de Supabase (lints 0011, 0025, 0028).
--
-- 1) Funciones sin search_path fijo: se les fija (mismo comportamiento, sin
--    depender del search_path de quien llama).
-- 2) Funciones del esquema public: ni anon ni PUBLIC las pueden ejecutar. Los
--    usuarios con sesión (authenticated) y el servidor (service_role) conservan
--    lo que ya podían. Excepciones para anon: las que usa la página de
--    invitación antes de iniciar sesión.
-- 3) Fotos de productos: se saca la lectura amplia de storage.objects (permitía
--    listar todos los archivos). Las URL públicas de las fotos siguen andando
--    (el bucket es público). Quienes suben fotos conservan la lectura de la
--    carpeta de su negocio (hace falta para `upsert`).

-- 1) search_path fijo
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'handle_updated_at', 'plan_rank', 'log_product_cost_change', 'generate_org_code',
        'log_product_price_change', 'set_stock_branch', 'is_direct_write'
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- 2) Cerrar anon / PUBLIC (se conserva lo de authenticated y service_role)
do $$
declare r record;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
           has_function_privilege('service_role', p.oid, 'execute') as service_ok
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('get_invitation_preview', 'username_available', 'accept_invitation')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    if r.auth_ok then execute format('grant execute on function %s to authenticated', r.sig); end if;
    if r.service_ok then execute format('grant execute on function %s to service_role', r.sig); end if;
  end loop;
end $$;

-- Funciones que cree este rol de acá en adelante: sin acceso para anon.
alter default privileges in schema public revoke execute on functions from anon;

-- 3) Fotos: sin listado público
drop policy if exists "product images: public read" on storage.objects;
drop policy if exists "product images: org members can read" on storage.objects;
create policy "product images: org members can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]
    )
  );
