-- Pesito: teléfono de contacto del negocio, capturado en el registro.
-- Corre sobre una base que ya tiene 0001..0012 aplicadas.

alter table organizations add column if not exists phone text;

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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into organizations (name, slug, business_type, phone)
  values (p_name, p_slug, coalesce(nullif(p_business_type, ''), 'kiosco'), nullif(p_phone, ''))
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role) values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;
