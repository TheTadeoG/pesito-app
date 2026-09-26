-- Pesito 0046: verificación en dos pasos y registro de ingresos.
--
-- 1. Quien activó la verificación en dos pasos (app de códigos) no ve ni
--    toca datos del negocio hasta ingresar el código: lo exige la base en
--    is_org_member / is_org_admin (que usan todas las políticas y funciones),
--    no sólo la pantalla. Quien no la activó sigue igual que antes.
-- 2. login_events: cada ingreso con su dispositivo, para avisarle al dueño
--    cuando alguien del equipo entra desde un dispositivo nuevo. Sólo lo
--    escribe el servidor (service role).
--
-- Compatible con la app anterior y la nueva (misma firma de funciones).

-- ---------------------------------------------------------------------------
-- 1. Verificación en dos pasos
-- ---------------------------------------------------------------------------

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id and user_id = auth.uid()
  ) and public.mfa_ok();
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) and public.mfa_ok();
$$;

-- ---------------------------------------------------------------------------
-- 2. Registro de ingresos
-- ---------------------------------------------------------------------------

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  user_agent text,
  ip text,
  new_device boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_events_org_created_idx on public.login_events (org_id, created_at desc);
create index if not exists login_events_user_device_idx on public.login_events (user_id, device_id);

alter table public.login_events enable row level security;

drop policy if exists "admins see their team logins, users see their own" on public.login_events;
create policy "admins see their team logins, users see their own"
  on public.login_events for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(org_id));
