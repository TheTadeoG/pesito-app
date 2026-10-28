-- Renombra por dentro los planes: esencial -> basico, ia -> max (pro y gratis quedan). Los nombres que se ven
-- ya eran Básico y Max. Sin suscripciones vigentes al hacerlo. Es repetible: si se corta a la mitad se vuelve
-- a correr entera.
--
-- 1) Se sacan las restricciones que listan los ids viejos.
-- 2) Se actualizan los datos.
-- 3) Se reescriben, con el mismo texto y la misma firma, todas las funciones que mencionan 'esencial' o 'ia'
--    (require_plan, límites por plan, sucursales, cuenta corriente de proveedores, avisos…).
-- 4) Se vuelven a poner las restricciones con los ids nuevos.

do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.organization_subscriptions'::regclass, 'public.plan_history'::regclass)
      and (pg_get_constraintdef(c.oid) like '%''esencial''%' or pg_get_constraintdef(c.oid) like '%''ia''%')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

update public.organization_subscriptions
set plan = case plan when 'esencial' then 'basico' when 'ia' then 'max' else plan end
where plan in ('esencial', 'ia');

-- grace_plan existe sólo si se aplicó la 0048.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_subscriptions' and column_name = 'grace_plan'
  ) then
    execute $q$
      update public.organization_subscriptions
      set grace_plan = case grace_plan when 'esencial' then 'basico' when 'ia' then 'max' else grace_plan end
      where grace_plan in ('esencial', 'ia')
    $q$;
  end if;
end $$;

update public.plan_history
set from_plan = case from_plan when 'esencial' then 'basico' when 'ia' then 'max' else from_plan end,
    to_plan = case to_plan when 'esencial' then 'basico' when 'ia' then 'max' else to_plan end
where from_plan in ('esencial', 'ia') or to_plan in ('esencial', 'ia');

do $$
declare
  r record;
  def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.prosrc like '%''esencial''%' or p.prosrc like '%''ia''%' or p.proname = 'require_plan')
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, '''esencial''', '''basico''');
    def := replace(def, '''ia''', '''max''');
    def := replace(def, '''Esencial''', '''Básico''');
    def := replace(def, '''IA''', '''Max''');
    execute def;
  end loop;
end $$;

alter table public.organization_subscriptions drop constraint if exists organization_subscriptions_plan_check;
alter table public.organization_subscriptions
  add constraint organization_subscriptions_plan_check check (plan in ('gratis', 'basico', 'pro', 'max'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_subscriptions' and column_name = 'grace_plan'
  ) then
    alter table public.organization_subscriptions drop constraint if exists organization_subscriptions_grace_plan_check;
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_grace_plan_check check (grace_plan is null or grace_plan in ('basico', 'pro', 'max'));
  end if;
end $$;

alter table public.plan_history
  drop constraint if exists plan_history_from_plan_check,
  drop constraint if exists plan_history_to_plan_check;
alter table public.plan_history
  add constraint plan_history_from_plan_check check (from_plan in ('gratis', 'basico', 'pro', 'max')),
  add constraint plan_history_to_plan_check check (to_plan in ('gratis', 'basico', 'pro', 'max'));

-- Control: no tiene que quedar ninguna función con los ids viejos (devuelve 0 filas).
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and (p.prosrc like '%''esencial''%' or p.prosrc like '%''ia''%');
