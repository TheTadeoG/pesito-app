-- Panel de admin: última venta de cada negocio (para saber quién dejó de vender) y notas internas por negocio
-- (con quién se habló, qué se acordó). Las notas sólo las lee y escribe la service role desde /admin.

create or replace view public.platform_org_activity as
select
  o.id as org_id,
  o.created_at,
  (select min(p.created_at) from public.products p where p.org_id = o.id) as first_product_at,
  (select count(*) from public.products p where p.org_id = o.id) as product_count,
  (select min(s.created_at) from public.sales s where s.org_id = o.id and s.status = 'completada') as first_sale_at,
  (select count(*) from public.sales s where s.org_id = o.id and s.status = 'completada') as sale_count,
  exists (select 1 from public.purchases x where x.org_id = o.id) as has_purchase,
  exists (select 1 from public.cash_registers x where x.org_id = o.id) as has_cash,
  exists (select 1 from public.cash_registers x where x.org_id = o.id and x.status = 'cerrada') as has_cash_closed,
  exists (select 1 from public.customers x where x.org_id = o.id) as has_customer,
  exists (select 1 from public.suppliers x where x.org_id = o.id) as has_supplier,
  (select count(*) from public.memberships m where m.org_id = o.id) as member_count,
  (select max(s.created_at) from public.sales s where s.org_id = o.id and s.status = 'completada') as last_sale_at
from public.organizations o;

revoke all on public.platform_org_activity from public, anon, authenticated;
grant select on public.platform_org_activity to service_role;

create table if not exists public.admin_org_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists admin_org_notes_org_idx on public.admin_org_notes (org_id, created_at desc);
alter table public.admin_org_notes enable row level security;
revoke all on public.admin_org_notes from anon, authenticated;
