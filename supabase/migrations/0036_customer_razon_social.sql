-- Pesito: permitir cargar la razón social del cliente, además del nombre
-- con el que aparece en el resto de la pantalla (útil para clientes que
-- piden factura A/B a nombre de una empresa distinta del nombre de fantasía
-- por el que se lo conoce en el kiosco).

alter table public.customers
  add column if not exists razon_social text;
