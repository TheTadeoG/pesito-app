-- Tipo de documento del cliente (por defecto CUIT; también CUIL, DNI, pasaporte o CDI) y número sin guiones ni puntos.
-- El número se guarda sólo con dígitos (o letras y números en un pasaporte) y se muestra con su formato (20-12345678-9).
alter table public.customers
  add column if not exists document_type text check (document_type in ('cuit', 'cuil', 'dni', 'pasaporte', 'cdi'));

-- Los que ya estaban: se limpia el número si es sólo números con separadores, y se deduce el tipo por la cantidad de dígitos.
update public.customers
set document = regexp_replace(document, '\D', '', 'g')
where document ~ '^[0-9.\- ]+$' and document <> regexp_replace(document, '\D', '', 'g');

update public.customers
set document_type = case when length(document) = 11 then 'cuit' when length(document) in (7, 8) then 'dni' end
where document is not null and document ~ '^[0-9]+$' and document_type is null;
