-- Pesito: los negocios nuevos no estaban recibiendo la prueba Pro de 14 días.
--
-- 0014 dejó como única firma de create_organization la de 4 parámetros
-- (con p_phone), y 0016 la redefinió así. Pero 0026 y 0027 agregaron el alta
-- en organization_subscriptions con `create or replace` sobre la firma vieja
-- de 3 parámetros — lo que no reemplazó nada, sino que volvió a crear un
-- overload aparte. La app llama con p_phone (onboarding/actions.ts), así que
-- siempre corría la versión de 4 parámetros, sin fila de suscripción: el
-- negocio arrancaba en Plan Gratis sin prueba, con el tope de 150 ventas por
-- mes desde el primer día y sin los reportes Pro.
--
-- Corre sobre una base que ya tiene 0001..0036 aplicadas. Se puede correr
-- más de una vez sin efectos de más.

drop function if exists public.create_organization(text, text, text);

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_business_type text default 'kiosco',
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into organizations (name, slug, business_type, phone)
  values (p_name, p_slug, coalesce(nullif(p_business_type, ''), 'kiosco'), nullif(p_phone, ''))
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role, email)
  values (v_org_id, auth.uid(), 'owner', v_email);

  insert into organization_subscriptions (org_id, plan, pro_trial_ends_at)
  values (v_org_id, 'gratis', now() + interval '14 days');

  return v_org_id;
end;
$$;

-- Los negocios que se registraron sin fila de suscripción reciben la prueba
-- que les correspondía: 14 días desde que se crearon. A los que ya se les
-- pasó ese plazo les queda vencida (igual que a cualquier otro negocio), y
-- los que se registraron hace poco recuperan los días que les quedan.
insert into organization_subscriptions (org_id, plan, pro_trial_ends_at)
select id, 'gratis', created_at + interval '14 days'
from organizations
on conflict (org_id) do nothing;
