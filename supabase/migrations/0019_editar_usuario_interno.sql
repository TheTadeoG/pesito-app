-- Pesito: permite al dueño/admin editar el usuario (nombre#código) de una
-- cuenta interna ya creada. El email de auth y la contraseña se actualizan
-- aparte con la Admin API (service role) desde el server action; acá sólo
-- se actualiza la columna username una vez que ese cambio ya se aplicó.
-- Corre sobre una base que ya tiene 0001..0018 aplicadas.

create or replace function public.update_member_username(p_membership_id uuid, p_username text)
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
    raise exception 'no tenés permiso para editar usuarios en esta organización';
  end if;

  if v_target.role = 'owner' then
    raise exception 'no se puede editar el usuario del dueño de la cuenta';
  end if;

  update memberships set username = p_username where id = p_membership_id;
end;
$$;
