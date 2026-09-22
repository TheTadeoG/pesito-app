-- Pesito: la prueba de funciones Pro del plan gratis pasa de 7 a 14 días.
-- El límite de 150 ventas/mes del plan gratis (una vez pasada la prueba)
-- se valida en el server action de checkout, no acá.
-- Corre sobre una base que ya tiene 0001..0026 aplicadas. Ejecutar una sola
-- vez (el UPDATE de abajo suma 7 días a las pruebas ya otorgadas; correrlo
-- de nuevo las alargaría otra vez).

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_business_type text default 'kiosco'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into organizations (name, slug, business_type)
  values (p_name, p_slug, coalesce(nullif(p_business_type, ''), 'kiosco'))
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role) values (v_org_id, auth.uid(), 'owner');

  insert into organization_subscriptions (org_id, plan, pro_trial_ends_at)
  values (v_org_id, 'gratis', now() + interval '14 days');

  return v_org_id;
end;
$$;

-- A los negocios que ya estaban en la prueba de 7 días (otorgada por la
-- migración 0026) les sumamos 7 días más, para que nadie pierda tiempo de
-- prueba por este cambio.
update organization_subscriptions
set pro_trial_ends_at = pro_trial_ends_at + interval '7 days'
where plan = 'gratis' and pro_trial_ends_at is not null;
