-- Pesito: panel interno del dueño de Pesito (no de un kiosco) con
-- estadísticas de toda la plataforma. platform_admins es una lista
-- separada de los roles owner/admin/vendedor de cada negocio — esos son
-- por organización (vía RLS is_org_member); esto es "puede ver todos los
-- negocios", así que se maneja aparte y no tiene alta desde la app: se
-- agrega a mano por SQL la primera vez.
-- Corre sobre una base que ya tiene 0001..0017 aplicadas.

create table if not exists platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;
-- Sin policies: no se lee ni se escribe vía anon/authenticated key. La
-- única forma de consultar "¿soy admin?" es la función de abajo, y la
-- única forma de sumar un admin es un insert manual por SQL.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
