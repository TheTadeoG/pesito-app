-- Panel de admin: negocios propios o de prueba. No cuentan como clientes que pagan (segmento "Pagan", embudo y
-- remarketing). Sólo la service role lee y escribe (desde /admin): ningún negocio ve esta tabla.

create table if not exists public.admin_internal_orgs (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_internal_orgs enable row level security;
revoke all on public.admin_internal_orgs from anon, authenticated;
