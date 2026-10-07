-- Límite de ritmo por IP para los formularios públicos (login, registro y alta
-- desde una invitación), sin servicios de afuera ni costo extra.
--
-- La app guarda una huella de la IP (no la IP: HMAC con la clave del servidor)
-- y cuenta los pedidos en ventanas fijas. Sólo la llama el servidor con la clave
-- secreta (service_role): el navegador no puede ni leerla ni resetearla.
-- Si la función falla o no existe, la app deja pasar (no frena a nadie).

create unlogged table if not exists public.ip_rate_limits (
  key text not null,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (key, bucket)
);
alter table public.ip_rate_limits enable row level security;

create or replace function public.rate_limit_ip(
  p_key text,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into ip_rate_limits as r (key, bucket, window_start, hits)
  values (p_key, p_bucket, now(), 1)
  on conflict (key, bucket) do update
    set window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start end,
        hits = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.hits + 1 end
  returning r.hits into v_hits;

  -- Limpieza: de vez en cuando se borran las huellas de hace más de un día.
  if random() < 0.01 then
    delete from ip_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.rate_limit_ip(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_ip(text, text, integer, integer) to service_role;
