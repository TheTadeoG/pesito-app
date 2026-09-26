-- Pesito 0047: cobro de los planes con Mercado Pago (suscripciones).
--
-- organization_subscriptions guarda el estado del cobro (lo escribe sólo el
-- servidor con la service role, al recibir los avisos de Mercado Pago):
--   billing_cycle        'mensual' | 'anual'
--   mp_preapproval_id    la suscripción en Mercado Pago
--   payment_status       'active' | 'past_due' (falló un cobro) | 'cancelled'
--   current_period_end   hasta cuándo está pago (próximo cobro)
--   grace_until          con un cobro fallido: hasta cuándo se mantiene el plan
--
-- El plan que vale lo decide la base (org_effective_plan, misma firma que en
-- 0045): con un cobro fallido y la gracia vencida, o cancelada y el período
-- pago terminado, el negocio pasa a funcionar como Gratis sin perder datos.
-- No hace falta ninguna tarea programada. La app replica la misma regla en
-- lib/subscription.ts.
--
-- Compatible con la app anterior y la nueva.

alter table public.organization_subscriptions
  add column if not exists billing_cycle text,
  add column if not exists mp_preapproval_id text,
  add column if not exists payment_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists payer_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_subscriptions_billing_cycle_check') then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_billing_cycle_check
      check (billing_cycle is null or billing_cycle in ('mensual', 'anual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_subscriptions_payment_status_check') then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_payment_status_check
      check (payment_status is null or payment_status in ('active', 'past_due', 'cancelled'));
  end if;
end $$;

create index if not exists organization_subscriptions_mp_idx
  on public.organization_subscriptions (mp_preapproval_id);

-- Registro de lo que llega de Mercado Pago (para soporte y para no procesar
-- dos veces el mismo aviso).
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  topic text not null,
  mp_id text not null,
  status text,
  amount numeric(12, 2),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_org_idx on public.billing_events (org_id, created_at desc);

alter table public.billing_events enable row level security;

drop policy if exists "admins can view their billing events" on public.billing_events;
create policy "admins can view their billing events"
  on public.billing_events for select to authenticated
  using (public.is_org_admin(org_id));

create or replace function public.org_effective_plan(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when s.plan = 'gratis' and s.pro_trial_ends_at > now() then 'pro'
      when s.plan <> 'gratis' and s.payment_status = 'past_due' and s.grace_until < now() then 'gratis'
      when s.plan <> 'gratis' and s.payment_status = 'cancelled' and s.current_period_end < now() then 'gratis'
      else s.plan
    end
    from organization_subscriptions s
    where s.org_id = p_org_id
  ), 'gratis')
$$;
