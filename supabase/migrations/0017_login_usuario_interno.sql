-- Pesito: alta directa de vendedores con usuario/contraseña interno (sin
-- depender de un email real ni de invitación), login con email O usuario,
-- y bloqueo temporal tras varios intentos fallidos para frenar fuerza
-- bruta/DDoS sobre el login.
-- Corre sobre una base que ya tiene 0001..0016 aplicadas.

alter table memberships add column if not exists username text;

create unique index if not exists memberships_username_key
  on memberships (lower(username))
  where username is not null;

create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from memberships where lower(username) = lower(p_username)
  );
$$;

-- El usuario de auth (auth.users) ya se creó del lado del servidor con la
-- service role key (admin.createUser) antes de llamar a esta función; acá
-- sólo sumamos la membresía, validando que quien llama sea admin/dueño.
create or replace function public.create_member_direct(
  p_org_id uuid,
  p_user_id uuid,
  p_role text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para agregar usuarios en esta organización';
  end if;

  if p_role not in ('admin', 'vendedor') then
    raise exception 'rol inválido';
  end if;

  if exists (select 1 from memberships where org_id = p_org_id and user_id = p_user_id) then
    raise exception 'ese usuario ya pertenece a esta organización';
  end if;

  insert into memberships (org_id, user_id, role, username)
  values (p_org_id, p_user_id, p_role, p_username);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bloqueo por intentos fallidos de login
-- ---------------------------------------------------------------------------

create table if not exists login_lockouts (
  email text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table login_lockouts enable row level security;
-- Sin policies de select/insert/update: sólo se toca a través de las
-- funciones security definer de abajo (igual que el resto de las tablas
-- de sólo-RPC de este proyecto).

create or replace function public.check_login_lockout(p_email text)
returns table(locked boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until
  from login_lockouts
  where email = lower(p_email);

  if v_locked_until is not null and v_locked_until > now() then
    return query
      select true, greatest(0, ceil(extract(epoch from (v_locked_until - now())))::int);
  else
    return query select false, 0;
  end if;
end;
$$;

create or replace function public.register_login_failure(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(p_email);
  v_count integer;
  v_max_attempts constant integer := 5;
  v_lockout_minutes constant integer := 15;
begin
  insert into login_lockouts (email, failed_count, updated_at)
  values (v_email, 1, now())
  on conflict (email) do update
    set failed_count = login_lockouts.failed_count + 1,
        updated_at = now()
  returning failed_count into v_count;

  if v_count >= v_max_attempts then
    update login_lockouts
    set locked_until = now() + (v_lockout_minutes || ' minutes')::interval,
        failed_count = 0
    where email = v_email;
  end if;
end;
$$;

create or replace function public.register_login_success(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from login_lockouts where email = lower(p_email);
$$;
