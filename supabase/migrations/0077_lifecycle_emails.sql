-- Correos automáticos del ciclo de vida (bienvenida, "cargá tus productos", fin de la prueba Pro,
-- pago fallido). Los manda una tarea diaria (/api/cron/lifecycle) con la service role.
--
-- lifecycle_emails: qué correo se le mandó a cada negocio y cuándo (para no repetir ni mandar
-- dos seguidos). lifecycle_optout: negocios que pidieron no recibir más. Nadie las lee ni las
-- escribe con su sesión: sólo la service role.

create table if not exists public.lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (org_id, kind)
);

create index if not exists lifecycle_emails_org_idx on public.lifecycle_emails (org_id, sent_at desc);

create table if not exists public.lifecycle_optout (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.lifecycle_emails enable row level security;
alter table public.lifecycle_optout enable row level security;
revoke all on public.lifecycle_emails from public, anon, authenticated;
revoke all on public.lifecycle_optout from public, anon, authenticated;
