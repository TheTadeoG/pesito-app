-- Pesito: aceptar una invitación ahora puede crear una cuenta interna
-- (usuario#código, sin email real) en vez de requerir el registro completo
-- con email/teléfono — pensado para empleados invitados, no para otro
-- dueño de negocio. accept_invitation gana un parámetro p_username
-- opcional; como cambia la lista de parámetros, hay que dropear la firma
-- vieja explícitamente o Postgres deja las dos como overloads separados
-- (el mismo problema ya documentado en 0014).
-- Corre sobre una base que ya tiene 0001..0019 aplicadas.

drop function if exists public.accept_invitation(text);

create or replace function public.accept_invitation(p_code text, p_username text default null)
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

  insert into memberships (org_id, user_id, role, email, username)
  values (v_invitation.org_id, auth.uid(), v_invitation.role, v_email, p_username);

  update invitations set used_at = now(), used_by = auth.uid() where id = v_invitation.id;

  return v_invitation.org_id;
end;
$$;
