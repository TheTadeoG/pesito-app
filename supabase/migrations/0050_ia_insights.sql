-- Pesito 0050: funciones del Plan IA (baja rotación, reposición y
-- sugerencia de precios).
--
-- 1. product_sales_stats: por producto, lo vendido en los últimos p_days
--    días y la última venta del último año, en una sola consulta (traer
--    los renglones de venta a la app eran ~22.000 filas para 90 días de un
--    negocio mediano). Con p_branch_id, sólo las ventas de esa sucursal.
--
-- Funciones nuevas: compatible con la app anterior.

create or replace function public.product_sales_stats(
  p_org_id uuid,
  p_days integer,
  p_branch_id uuid default null
)
returns table (
  product_id uuid,
  qty_sold numeric,
  revenue numeric,
  sale_days integer,
  last_sold_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  perform public.require_plan(p_org_id, 'ia', 'ver el análisis de ventas por producto');

  return query
  select
    si.product_id,
    coalesce(sum(si.quantity) filter (where s.created_at >= v_since), 0),
    coalesce(sum(si.subtotal) filter (where s.created_at >= v_since), 0),
    (count(distinct (s.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
      filter (where s.created_at >= v_since))::integer,
    max(s.created_at)
  from sales s
  join sale_items si on si.sale_id = s.id
  where s.org_id = p_org_id
    and s.status = 'completada'
    and s.created_at >= now() - interval '365 days'
    and si.product_id is not null
    and (p_branch_id is null or s.branch_id = p_branch_id)
  group by si.product_id;
end;
$$;

revoke all on function public.product_sales_stats(uuid, integer, uuid) from public, anon;
grant execute on function public.product_sales_stats(uuid, integer, uuid) to authenticated;
