-- Pesito 0048: período de gracia al bajar de plan.
--
-- Sólo para quien venía pagando (la prueba Pro de 14 días no tiene gracia:
-- al terminar pasa directo a Gratis):
--   * Cambio a un plan más barato: 7 días más con el plan anterior
--     (grace_plan hasta plan_grace_until). Lo escribe el servidor al aplicar
--     el pago del plan nuevo.
--   * Débito cancelado o pago único vencido: 7 días más después del fin del
--     período pago.
--   * Cobro fallido: sigue igual (7 días, grace_until, 0047).
-- Pasada la gracia valen las funciones y los límites del plan nuevo: los
-- usuarios de más quedan pausados (lo controla la app).
--
-- org_effective_plan mantiene la misma firma (0045/0047).
-- Compatible con la app anterior y la nueva.

alter table public.organization_subscriptions
  add column if not exists grace_plan text,
  add column if not exists plan_grace_until timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_subscriptions_grace_plan_check') then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_grace_plan_check
      check (grace_plan is null or grace_plan in ('esencial', 'pro', 'ia'));
  end if;
end $$;

create or replace function public.org_effective_plan(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when s.grace_plan is not null and s.plan_grace_until > now() then s.grace_plan
      when s.plan = 'gratis' and s.pro_trial_ends_at > now() then 'pro'
      when s.plan <> 'gratis' and s.payment_status = 'past_due' and s.grace_until < now() then 'gratis'
      when s.plan <> 'gratis' and s.payment_status = 'cancelled'
        and s.current_period_end + interval '7 days' < now() then 'gratis'
      else s.plan
    end
    from organization_subscriptions s
    where s.org_id = p_org_id
  ), 'gratis')
$$;
