-- Paquete de facturas que rige desde la próxima renovación (cuando se baja o se quita un paquete: lo ya pagado se
-- conserva hasta que termina el período). null = sin cambio pendiente.
alter table public.organization_subscriptions
  add column if not exists next_invoice_pack integer check (next_invoice_pack is null or next_invoice_pack >= 0);
