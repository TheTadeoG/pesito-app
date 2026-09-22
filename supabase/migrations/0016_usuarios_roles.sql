-- Pesito: gestión de usuarios y roles. Invitaciones por link (sin enviar
-- mails ni requerir la service role key: todo funciona con el flujo normal
-- de auth.signUp/signInWithPassword ya existente), listado de miembros del
-- equipo con su rol, cambio de rol y baja de un miembro.
-- Corre sobre una base que ya tiene 0001..0015 aplicadas.

-- memberships.email queda denormalizado acá porque el cliente (anon key)
-- no tiene forma de leer auth.users de otros usuarios; lo completamos desde
-- las funciones security definer de abajo, que sí pueden leer auth.users.
alter table memberships add column if not exists email text;

update memberships m
set email = u.email
from auth.users u
where m.user_id = u.id and m.email is null;

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('admin', 'vendedor')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references auth.users (id)
);

create index if not exists invitations_org_id_idx on invitations (org_id);

alter table invitations enable row level security;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create policy "admins can view invitations in their org"
  on invitations for select
  using (public.is_org_admin(org_id));

create or replace function public.create_invitation(p_org_id uuid, p_role text)
returns invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations%rowtype;
  v_code text;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para invitar usuarios en esta organización';
  end if;

  if p_role not in ('admin', 'vendedor') then
    raise exception 'rol inválido';
  end if;

  v_code := left(replace(gen_random_uuid()::text, '-', ''), 10);

  insert into invitations (org_id, code, role, created_by)
  values (p_org_id, v_code, p_role, auth.uid())
  returning * into v_invitation;

  return v_invitation;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from invitations where id = p_invitation_id;

  if v_org_id is null then
    raise exception 'invitación no encontrada';
  end if;

  if not public.is_org_admin(v_org_id) then
    raise exception 'no tenés permiso para gestionar invitaciones en esta organización';
  end if;

  delete from invitations where id = p_invitation_id;
end;
$$;

-- Sin RLS de select para usuarios anónimos/no-miembros: la vista previa de
-- una invitación (antes de loguearse) se sirve sólo a través de esta
-- función, que expone lo mínimo necesario (nombre del negocio y rol).
create or replace function public.get_invitation_preview(p_code text)
returns table(org_name text, role text, valid boolean)
language sql
security definer
set search_path = public
stable
as $$
  select o.name, i.role, (i.used_at is null and i.expires_at > now()) as valid
  from invitations i
  join organizations o on o.id = i.org_id
  where i.code = p_code;
$$;

create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;

  select * into v_invitation from invitations where code = p_code for update;

  if v_invitation.id is null then
    raise exception 'invitación no encontrada';
  end if;

  if v_invitation.used_at is not null then
    raise exception 'la invitación ya fue usada';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'la invitación expiró';
  end if;

  -- Ya es miembro de esa organización (ej. reintentó el link): sólo marcamos
  -- la invitación como usada y devolvemos, sin duplicar la membresía.
  if exists (
    select 1 from memberships where org_id = v_invitation.org_id and user_id = auth.uid()
  ) then
    update invitations set used_at = now(), used_by = auth.uid() where id = v_invitation.id;
    return v_invitation.org_id;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into memberships (org_id, user_id, role, email)
  values (v_invitation.org_id, auth.uid(), v_invitation.role, v_email);

  update invitations set used_at = now(), used_by = auth.uid() where id = v_invitation.id;

  return v_invitation.org_id;
end;
$$;

create or replace function public.update_member_role(p_membership_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target memberships%rowtype;
begin
  select * into v_target from memberships where id = p_membership_id;

  if v_target.id is null then
    raise exception 'usuario no encontrado';
  end if;

  if not public.is_org_admin(v_target.org_id) then
    raise exception 'no tenés permiso para cambiar roles en esta organización';
  end if;

  if v_target.role = 'owner' then
    raise exception 'no se puede cambiar el rol del dueño de la cuenta';
  end if;

  if p_role not in ('admin', 'vendedor') then
    raise exception 'rol inválido';
  end if;

  update memberships set role = p_role where id = p_membership_id;
end;
$$;

create or replace function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target memberships%rowtype;
begin
  select * into v_target from memberships where id = p_membership_id;

  if v_target.id is null then
    raise exception 'usuario no encontrado';
  end if;

  if not public.is_org_admin(v_target.org_id) then
    raise exception 'no tenés permiso para quitar usuarios de esta organización';
  end if;

  if v_target.role = 'owner' then
    raise exception 'no se puede quitar al dueño de la cuenta';
  end if;

  delete from memberships where id = p_membership_id;
end;
$$;

-- create_organization queda con la misma firma (no genera overload nuevo);
-- sólo agregamos que la membresía del dueño también guarde su email.
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_business_type text default 'kiosco',
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into organizations (name, slug, business_type, phone)
  values (p_name, p_slug, coalesce(nullif(p_business_type, ''), 'kiosco'), nullif(p_phone, ''))
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role, email)
  values (v_org_id, auth.uid(), 'owner', v_email);

  return v_org_id;
end;
$$;
