-- Pesito: configuración por organización para la facturación automática según medio de pago.
-- Corre sobre una base que ya tiene 0001..0008 aplicadas.

alter table organizations
  add column if not exists auto_invoice_by_payment boolean not null default false;
