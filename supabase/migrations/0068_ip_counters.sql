-- Contadores por IP para pedir CAPTCHA sólo cuando alguien está forzando algo
-- (login con varios intentos fallidos seguidos, altas repetidas).
--
-- Se apoyan en la tabla ip_rate_limits de la 0067. Sólo el servidor (clave
-- secreta) las puede llamar.
--   ip_hits:  cuántos pedidos lleva esa huella en el tipo dado, dentro de la
--             ventana (0 si la ventana ya venció o no hay nada).
--   ip_clear: borra el contador de esa huella y tipo.

create or replace function public.ip_hits(p_key text, p_bucket text, p_window_seconds integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select hits from ip_rate_limits
     where key = p_key and bucket = p_bucket
       and window_start >= now() - make_interval(secs => p_window_seconds)),
    0);
$$;

create or replace function public.ip_clear(p_key text, p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from ip_rate_limits where key = p_key and bucket = p_bucket;
$$;

revoke all on function public.ip_hits(text, text, integer) from public, anon, authenticated;
revoke all on function public.ip_clear(text, text) from public, anon, authenticated;
grant execute on function public.ip_hits(text, text, integer) to service_role;
grant execute on function public.ip_clear(text, text) to service_role;
