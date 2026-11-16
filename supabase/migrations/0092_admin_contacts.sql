-- Remarketing del panel de admin: a quién se le escribió (WhatsApp o mail), desde qué lista y cuándo, y las pruebas
-- Pro regaladas. Sirve para no repetir mensajes y para medir si las pruebas regaladas terminan en un pago.
-- Sólo la lee y escribe la service role desde /admin.
create table if not exists public.admin_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('whatsapp', 'mail', 'prueba')),
  audience text,
  days integer check (days is null or days > 0),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists admin_contacts_org_idx on public.admin_contacts (org_id, created_at desc);
create index if not exists admin_contacts_recent_idx on public.admin_contacts (created_at desc);
alter table public.admin_contacts enable row level security;
revoke all on public.admin_contacts from anon, authenticated;
