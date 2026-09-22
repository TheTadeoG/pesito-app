-- Pesito: preferencia de comprobante por cliente.
-- Corre sobre una base que ya tiene 0001..0004 aplicadas.

alter table customers add column if not exists invoice_type text;

alter table customers drop constraint if exists customers_invoice_type_check;
alter table customers add constraint customers_invoice_type_check
  check (invoice_type is null or invoice_type in ('consumidor_final', 'factura_a', 'factura_b', 'factura_c'));
