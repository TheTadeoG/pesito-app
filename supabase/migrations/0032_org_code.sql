-- Pesito: código corto y random por negocio (ej. "a82d23"), para usar en
-- soporte técnico en vez del UUID completo de organizations.id (correcto
-- pero imposible de dictar/tipear a mano). A propósito NO es secuencial:
-- un número tipo "Negocio N° 3" revela cuántos clientes tenemos en total.
-- Corre sobre una base que ya tiene 0001..0031 aplicadas.
--
-- Los pasos van separados (agregar columna / rellenar / poner constraints)
-- a propósito: un DEFAULT que consulta la misma tabla dentro de un
-- ADD COLUMN con reescritura de tabla rompe con un error de lectura de
-- bloque (el ALTER todavía está reescribiendo el relfilenode viejo
-- mientras la función intenta leerlo). Separando en pasos, cada consulta
-- corre sobre una tabla ya estable.

create or replace function public.generate_org_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := substr(md5(gen_random_uuid()::text), 1, 6);
    exit when not exists (select 1 from organizations where org_code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table organizations add column if not exists org_code text;

update organizations set org_code = public.generate_org_code() where org_code is null;

alter table organizations alter column org_code set not null;

alter table organizations
  drop constraint if exists organizations_org_code_key,
  add constraint organizations_org_code_key unique (org_code);

alter table organizations alter column org_code set default public.generate_org_code();
