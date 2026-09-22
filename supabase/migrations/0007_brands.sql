-- Pesito: catálogo de marcas de productos (buscar/cargar en vez de tipear libre).
-- Corre sobre una base que ya tiene 0001..0006 aplicadas.

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table brands enable row level security;

create policy "members can manage brands"
  on brands for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
