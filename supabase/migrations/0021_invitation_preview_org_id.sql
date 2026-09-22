-- Pesito: get_invitation_preview ahora también devuelve org_id, para poder
-- buscar la membresía exacta de quien la visita y mostrarle su usuario si
-- ya la había aceptado antes (en vez de un error de "no disponible" o un
-- redirect ciego que se salteaba mostrarle el usuario#código).
-- Como cambia el tipo de retorno (returns table), hay que dropear la
-- función vieja antes de recrearla — Postgres no deja cambiar el rowtype
-- de una función table-returning con sólo CREATE OR REPLACE.
-- Corre sobre una base que ya tiene 0001..0020 aplicadas.

drop function if exists public.get_invitation_preview(text);

create or replace function public.get_invitation_preview(p_code text)
returns table(org_id uuid, org_name text, role text, valid boolean)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.name, i.role, (i.used_at is null and i.expires_at > now()) as valid
  from invitations i
  join organizations o on o.id = i.org_id
  where i.code = p_code;
$$;
