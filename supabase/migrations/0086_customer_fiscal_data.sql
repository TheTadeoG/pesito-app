-- Datos de domicilio y condición fiscal del cliente (se completan solos al buscar el CUIT en ARCA, o a mano).
-- Salen en las facturas a su nombre (domicilio) y sirven para elegir el tipo de comprobante.
alter table public.customers
  add column if not exists address text check (char_length(address) <= 200),
  add column if not exists city text check (char_length(city) <= 100),
  add column if not exists postal_code text check (char_length(postal_code) <= 12),
  add column if not exists province text check (char_length(province) <= 60),
  add column if not exists tax_condition text
    check (tax_condition in ('responsable_inscripto', 'monotributo', 'exento', 'no_alcanzado', 'consumidor_final'));
