-- Pesito: historial real de cambios de plan por negocio (no de pagos —
-- todavía no hay pasarela conectada, los planes pagos se asignan a mano
-- desde /admin). Se registra cada vez que cambia organization_subscriptions.plan,
-- para mostrarlo en Configuración > Suscripción.
-- Corre sobre una base que ya tiene 0001..0032 aplicadas.

create table if not exists plan_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  from_plan text not null check (from_plan in ('gratis', 'esencial', 'pro', 'ia')),
  to_plan text not null check (to_plan in ('gratis', 'esencial', 'pro', 'ia')),
  -- Quién lo cambió (un platform admin de Pesito, no un miembro del
  -- negocio) — se guarda para auditoría interna, no se lo mostramos al
  -- cliente en el historial.
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_history_org_id_idx on plan_history (org_id, created_at desc);

alter table plan_history enable row level security;

-- Mismo criterio de visibilidad que la sección de Suscripción hoy: la ve
-- cualquier miembro del negocio, no sólo dueño/admin.
create policy "members can view their plan history"
  on plan_history for select
  using (public.is_org_member(org_id));

-- Sin policies de insert/update/delete para authenticated: sólo se escribe
-- con la service role, desde updateOrgPlan (src/app/admin/actions.ts).
