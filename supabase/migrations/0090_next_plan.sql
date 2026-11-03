-- Plan al que se baja en la próxima renovación (con débito automático): se cobra el plan nuevo desde el próximo cobro y
-- hasta entonces sigue valiendo el actual, que ya está pago. null = sin cambio pendiente.
alter table public.organization_subscriptions
  add column if not exists next_plan text check (next_plan is null or next_plan in ('basico', 'pro', 'max'));
