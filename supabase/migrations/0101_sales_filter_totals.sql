-- Totales de Ventas (Vendido, Facturado, Sin facturar, Anuladas, En fiado) para TODO el filtro,
-- sin traer las ventas a la aplicación: la pantalla sólo carga la página que se está viendo.
-- Mismos filtros que la lista de /ventas. Nueva función (sin versión anterior): no hay overloads.

create or replace function public.sales_filter_totals(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_medio text default null,
  p_estado text default null,
  p_branch uuid default null,
  p_seller uuid default null,
  p_min numeric default null,
  p_max numeric default null,
  p_comprobante text default null,        -- 'factura' | 'nc' | 'x' | null
  p_search boolean default false,         -- hay algo escrito en "Buscar"
  p_customer_ids uuid[] default null,
  p_sale_ids uuid[] default null,
  p_internal_number integer default null,
  p_amount numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  perform public.rate_limit_hit(p_org_id, 'ventas_totales', 60, 60);

  return (
    with s as (
      select
        sa.id, sa.total, sa.status, sa.payment_method,
        exists (
          select 1 from arca_vouchers v
          where v.sale_id = sa.id and v.status = 'authorized' and v.kind = 'invoice'
        ) as invoiced
      from sales sa
      where sa.org_id = p_org_id
        and sa.created_at >= p_start
        and sa.created_at < p_end
        and (p_medio is null or sa.payment_method = p_medio)
        and (p_estado is null or sa.status = p_estado)
        and (p_branch is null or sa.branch_id = p_branch)
        and (p_seller is null or sa.user_id = p_seller)
        and (p_min is null or sa.total >= p_min)
        and (p_max is null or sa.total <= p_max)
        and (
          not p_search
          or (p_customer_ids is not null and sa.customer_id = any (p_customer_ids))
          or (p_sale_ids is not null and sa.id = any (p_sale_ids))
          or (p_internal_number is not null and sa.internal_number = p_internal_number)
          or (p_amount is not null and sa.total = p_amount)
        )
        and (
          p_comprobante is null
          or (p_comprobante = 'factura' and exists (
                select 1 from arca_vouchers v
                where v.sale_id = sa.id and v.status = 'authorized' and v.kind = 'invoice'))
          or (p_comprobante = 'nc' and exists (
                select 1 from arca_vouchers v
                where v.sale_id = sa.id and v.status = 'authorized' and v.kind = 'credit_note'))
          or (p_comprobante = 'x' and not exists (
                select 1 from arca_vouchers v
                where v.sale_id = sa.id and v.status = 'authorized'))
        )
    )
    select jsonb_build_object(
      'count',          count(*) filter (where status <> 'anulada'),
      'vendido',        coalesce(sum(total) filter (where status <> 'anulada'), 0),
      'facturadoCount', count(*) filter (where status <> 'anulada' and invoiced),
      'facturado',      coalesce(sum(total) filter (where status <> 'anulada' and invoiced), 0),
      'sinFacturarCount', count(*) filter (where status <> 'anulada' and not invoiced),
      'sinFacturar',    coalesce(sum(total) filter (where status <> 'anulada' and not invoiced), 0),
      'anuladasCount',  count(*) filter (where status = 'anulada'),
      'anuladas',       coalesce(sum(total) filter (where status = 'anulada'), 0),
      'fiado',          coalesce(sum(total) filter (where status <> 'anulada' and payment_method = 'fiado'), 0)
    )
    from s
  );
end;
$$;

grant execute on function public.sales_filter_totals(uuid, timestamptz, timestamptz, text, text, uuid, uuid, numeric, numeric, text, boolean, uuid[], uuid[], integer, numeric) to authenticated;
