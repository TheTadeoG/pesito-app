-- "En vivo": un aviso chico para saber si hay algo nuevo.
--
-- La pantalla consultaba live_overview (~9,5 KB, varias consultas) cada 30 s
-- aunque no hubiera cambiado nada. Ahora consulta live_pulse (unos 100 bytes,
-- 4 búsquedas por índice) cada 60 s y sólo pide live_overview si el resultado
-- cambió (o cada 5 minutos, por si cambió algo que el aviso no mira).
-- Mismo permiso que live_overview: dueños y administradores.

create or replace function public.live_pulse(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
    at time zone 'America/Argentina/Buenos_Aires';
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;

  return jsonb_build_object(
    'sales', (
      select jsonb_build_array(count(*), coalesce(sum(total), 0), max(created_at))
      from sales
      where org_id = p_org_id and status = 'completada' and created_at >= v_today
    ),
    'registers', (
      select jsonb_build_array(
        count(*) filter (where status = 'abierta'),
        max(opened_at),
        max(closed_at))
      from cash_registers
      where org_id = p_org_id and (status = 'abierta' or closed_at >= v_today)
    ),
    'cash', (
      select jsonb_build_array(count(*), max(created_at))
      from cash_movements
      where org_id = p_org_id and created_at >= v_today
    )
  );
end;
$$;

grant execute on function public.live_pulse(uuid) to authenticated;
