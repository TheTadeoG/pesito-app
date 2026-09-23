-- Pesito: reseñas de clientes para mostrar en la landing. Contenido de la
-- plataforma (no por negocio), así que no lleva org_id — se administra
-- desde /admin, igual que los planes.
-- Corre sobre una base que ya tiene 0001..0027 aplicadas.

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  business_type text,
  rating smallint not null default 5 check (rating between 1 and 5),
  quote text not null,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testimonials_published_sort_idx
  on testimonials (published, sort_order, created_at);

alter table testimonials enable row level security;

-- La landing es pública (sin login): cualquiera puede leer las reseñas
-- publicadas. Sin policies de insert/update/delete para
-- anon/authenticated a propósito — sólo se escribe con la service role,
-- desde las acciones de /admin (igual que organization_subscriptions).
create policy "anyone can view published testimonials"
  on testimonials for select
  using (published = true);

drop trigger if exists testimonials_set_updated_at on testimonials;
create trigger testimonials_set_updated_at
  before update on testimonials
  for each row execute function public.handle_updated_at();
