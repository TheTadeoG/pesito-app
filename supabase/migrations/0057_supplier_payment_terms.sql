-- Pesito: plazo de pago por proveedor.
--
-- suppliers.payment_terms_days: en cuántos días se le paga al proveedor
-- (0 = contado, null = sin plazo cargado). Al registrar una compra a cuenta,
-- el vencimiento se completa solo con este plazo (se puede cambiar).
--
-- Corre sobre una base con 0001..0056 aplicadas; se puede correr más de una vez.

alter table public.suppliers
  add column if not exists payment_terms_days smallint
    check (payment_terms_days is null or (payment_terms_days >= 0 and payment_terms_days <= 365));

comment on column public.suppliers.payment_terms_days is
  'Días de plazo para pagarle al proveedor. 0 = contado. null = sin plazo cargado.';
