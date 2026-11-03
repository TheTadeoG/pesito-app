-- Paquetes de facturas: facturas por mes que se suman a las incluidas en el plan. Van dentro de la misma suscripción
-- (se cobran y se renuevan junto con el plan). 0 = sin paquete. Las notas de crédito cuentan como factura.
alter table public.organization_subscriptions
  add column if not exists invoice_pack integer not null default 0 check (invoice_pack >= 0);
