-- Qué lleva impreso el comprobante interno X (el ticket de venta sin factura): el nombre del negocio y el
-- número correlativo (0084) se pueden ocultar. Por defecto, los dos se muestran.
alter table public.organizations
  add column if not exists ticket_show_org_name boolean not null default true,
  add column if not exists ticket_show_number boolean not null default true;
