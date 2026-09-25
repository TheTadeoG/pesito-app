-- Pesito: hora de cierre del negocio, para recordar cerrar la caja.
--
-- null = sin recordatorio por horario (la app igual avisa cuando una caja
-- quedó abierta desde un día anterior). Se guarda en hora de Argentina.
-- Corre sobre una base que ya tiene 0001..0040 aplicadas.

alter table public.organizations
  add column if not exists cash_close_time time;

comment on column public.organizations.cash_close_time is
  'Hora de cierre (Argentina) a partir de la cual se recuerda cerrar la caja. null = sin recordatorio por horario.';
