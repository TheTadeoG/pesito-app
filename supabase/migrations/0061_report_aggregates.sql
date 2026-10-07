-- Reportes con agregados en SQL.
--
-- Antes la página de Reportes traía TODAS las ventas del período (de a 1000),
-- sus ítems (de a 100 ids) y los costos, y sumaba en el servidor: a 500 ventas
-- por día eran ~360 consultas y ~28 MB por visita. Ahora la base devuelve ya
-- sumado lo que se muestra (unos pocos KB en 1 consulta).
--
-- security definer con control explícito de membresía (is_org_member): las
-- políticas RLS de sale_items buscan la venta fila por fila y, con 15.000
-- ventas, tardaban ~13 s; sin RLS la misma cuenta tarda decenas de ms. Lo que
-- ve cada quien es lo mismo que antes (cualquier miembro ve las ventas de su
-- negocio). No escriben nada.

create or replace function public.report_overview(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_seller uuid default null,
  p_branch uuid default null,
  p_group text default 'day'
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
  return (
  with s as (
    select id, user_id, total, payment_method, invoice_type, created_at, customer_id, branch_id,
      created_at at time zone 'America/Argentina/Buenos_Aires' as lt
    from sales
    where org_id = p_org_id
      and status = 'completada'
      and created_at >= p_start
      and created_at < p_end
      and (p_seller is null or user_id = p_seller)
      and (p_branch is null or branch_id = p_branch)
  ),
  it as (
    select i.sale_id, i.product_id, i.product_name, i.quantity, i.subtotal,
      case when i.product_id is null then 0 else i.quantity * coalesce(p.cost, 0) end as cost
    from sale_items i
    join s on s.id = i.sale_id
    left join products p on p.id = i.product_id
  ),
  sale_cost as (
    select sale_id, sum(cost) as cost from it group by sale_id
  ),
  by_product as (
    select product_id, max(product_name) as name, sum(quantity) as quantity,
      sum(subtotal - cost) as margin
    from it
    where product_id is not null
    group by product_id
  ),
  by_customer as (
    select s.customer_id, c.name, sum(s.total) as total
    from s
    left join customers c on c.id = s.customer_id
    group by s.customer_id, c.name
    order by total desc
    limit 5
  ),
  recent as (
    select s.id, s.created_at, s.total, s.payment_method, s.invoice_type, s.customer_id,
      c.name as customer_name,
      (
        select coalesce(
          jsonb_agg(
            case when i.quantity > 1
              then i.product_name || ' x' || trim(trailing '.' from trim(trailing '0' from i.quantity::text))
              else i.product_name end
            order by i.id
          ), '[]'::jsonb)
        from sale_items i where i.sale_id = s.id
      ) as items
    from s
    left join customers c on c.id = s.customer_id
    order by s.created_at desc, s.id
    limit 15
  )
  select jsonb_build_object(
    'ventas', (select count(*) from s),
    'ingresos', (select coalesce(sum(total), 0) from s),
    'costo', (select coalesce(sum(cost), 0) from it),
    'chart', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'v', v) order by k), '[]'::jsonb)
      from (
        select case p_group
            when 'hour' then to_char(lt, 'HH24')
            when 'month' then to_char(lt, 'YYYY-MM')
            else to_char(lt, 'YYYY-MM-DD') end as k,
          sum(total) as v
        from s group by 1
      ) x
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'total', v) order by v desc), '[]'::jsonb)
      from (select payment_method, sum(total) as v from s group by 1) x
    ),
    'sellers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'ventas', n, 'ingresos', v, 'costo', coalesce(c, 0))), '[]'::jsonb)
      from (
        select s.user_id, count(*) as n, sum(s.total) as v, sum(sc.cost) as c
        from s left join sale_cost sc on sc.sale_id = s.id
        group by s.user_id
      ) x
    ),
    'branches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'branch_id', branch_id, 'ventas', n, 'ingresos', v, 'costo', coalesce(c, 0))), '[]'::jsonb)
      from (
        select s.branch_id, count(*) as n, sum(s.total) as v, sum(sc.cost) as c
        from s left join sale_cost sc on sc.sale_id = s.id
        group by s.branch_id
      ) x
    ),
    'top_quantity', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity)), '[]'::jsonb)
      from (select name, quantity from by_product order by quantity desc limit 5) x
    ),
    'top_margin', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'margin', margin)), '[]'::jsonb)
      from (select name, margin from by_product where margin >= 0 order by margin desc limit 5) x
    ),
    'loss', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'loss', -margin)), '[]'::jsonb)
      from (select name, quantity, margin from by_product where margin < 0 order by margin limit 5) x
    ),
    'customers', (
      select coalesce(jsonb_agg(jsonb_build_object('customer_id', customer_id, 'name', name, 'total', total) order by total desc), '[]'::jsonb)
      from by_customer
    ),
    'weekdays', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'total', v, 'days', d)), '[]'::jsonb)
      from (
        select extract(dow from lt)::int as dow, sum(total) as v, count(distinct lt::date) as d
        from s group by 1
      ) x
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'total', v)), '[]'::jsonb)
      from (select extract(hour from lt)::int as h, sum(total) as v from s group by 1) x
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'created_at', created_at, 'total', total, 'payment_method', payment_method,
        'invoice_type', invoice_type, 'customer_id', customer_id, 'customer_name', customer_name,
        'items', items) order by created_at desc, id), '[]'::jsonb)
      from recent
    )
  )
  );
end;
$$;

-- Sólo los totales de un período (para compararlo con el anterior).
create or replace function public.report_totals(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_seller uuid default null,
  p_branch uuid default null
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
  return (
  with s as (
    select id, total
    from sales
    where org_id = p_org_id
      and status = 'completada'
      and created_at >= p_start
      and created_at < p_end
      and (p_seller is null or user_id = p_seller)
      and (p_branch is null or branch_id = p_branch)
  )
  select jsonb_build_object(
    'ventas', (select count(*) from s),
    'ingresos', (select coalesce(sum(total), 0) from s),
    'costo', (
      select coalesce(sum(i.quantity * coalesce(p.cost, 0)), 0)
      from sale_items i
      join s on s.id = i.sale_id
      join products p on p.id = i.product_id
    )
  )
  );
end;
$$;

grant execute on function public.report_overview(uuid, timestamptz, timestamptz, uuid, uuid, text) to authenticated;
grant execute on function public.report_totals(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;

-- Stock valorizado (al costo y al precio de venta) sin traer todos los productos.
create or replace function public.report_stock_value(p_org_id uuid)
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
  return (
    select jsonb_build_object(
      'at_cost', coalesce(sum(stock * coalesce(cost, 0)), 0),
      'at_price', coalesce(sum(stock * price), 0)
    )
    from products
    where org_id = p_org_id and active
  );
end;
$$;

grant execute on function public.report_stock_value(uuid) to authenticated;
