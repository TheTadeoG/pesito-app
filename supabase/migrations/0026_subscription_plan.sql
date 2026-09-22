-- Pesito: plan de suscripción por negocio (gratis / esencial / pro / ia) y
-- prueba gratuita de funciones Pro para el plan gratis.
--
-- El plan vive en una tabla aparte (no en `organizations`) a propósito: la
-- política de UPDATE de `organizations` (0010) permite a cualquier miembro
-- actualizar la fila entera, así que si el plan fuera una columna ahí,
-- cualquier usuario podría subirse su propio plan a mano con un update
-- directo. Acá no hay policy de INSERT/UPDATE/DELETE para authenticated,
-- así que sólo se puede escribir con la service role (panel /admin o
-- create_organization, que es security definer).
-- Corre sobre una base que ya tiene 0001..0025 aplicadas.

create table if not exists organization_subscriptions (
  org_id uuid primary key references organizations (id) on delete cascade,
  plan text not null default 'gratis' check (plan in ('gratis', 'esencial', 'pro', 'ia')),
  -- Hasta cuándo tiene funciones Pro activas aunque su plan sea "gratis"
  -- (prueba de 7 días). Null = sin prueba (o ya se le asignó un plan pago).
  pro_trial_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table organization_subscriptions enable row level security;

create policy "members can view their subscription"
  on organization_subscriptions for select
  using (public.is_org_member(org_id));

-- A los negocios que ya existían les damos la misma prueba de 7 días desde
-- que se activa esta función, para que nadie pierda acceso de un día para
-- el otro.
insert into organization_subscriptions (org_id, plan, pro_trial_ends_at)
select id, 'gratis', now() + interval '7 days'
from organizations
on conflict (org_id) do nothing;

drop trigger if exists organization_subscriptions_set_updated_at on organization_subscriptions;
create trigger organization_subscriptions_set_updated_at
  before update on organization_subscriptions
  for each row execute function public.handle_updated_at();

-- A los negocios nuevos también les damos la prueba de 7 días de entrada.
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
  values (v_org_id, 'gratis', now() + interval '7 days');

  return v_org_id;
end;
$$;
