-- Pesito: pantalla "En vivo" (dueños y administradores).
--
-- Una sola consulta con todo lo que muestra la pantalla: totales de hoy, la
-- comparación con ayer a la misma hora, ventas por hora, cada integrante del
-- equipo con su caja (abierta o cerrada hoy) y las últimas ventas. La
-- pantalla la pide cada 30 s mientras está a la vista, directo desde el
-- navegador (sin pasar por Vercel), así que tiene que ser una sola llamada
-- y devolver poco.
--
-- "Hoy" es el día calendario de Argentina. El efectivo en caja usa
-- cash_register_summaries (0038), con las mismas reglas que la página de
-- Caja. Sólo owner/admin pueden llamarla.
--
-- Corre sobre una base con 0001..0041 aplicadas; se puede correr más de una
-- vez.

create or replace function public.live_overview(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_today timestamptz;
  v_yesterday timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;

  v_today := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;
  v_yesterday := v_today - interval '1 day';

  with today_sales as (
    select s.id, s.user_id, s.total, s.payment_method, s.created_at, s.cash_register_id
    from sales s
    where s.org_id = p_org_id
      and s.status = 'completada'
      and s.created_at >= v_today
  ),
  registers as (
    -- Cajas abiertas (aunque se hayan abierto otro día) y las cerradas hoy.
    select r.id, r.user_id, r.status, r.opened_at, r.closed_at,
      r.opening_amount, r.closing_amount, r.expected_amount
    from cash_registers r
    where r.org_id = p_org_id
      and (r.status = 'abierta' or r.closed_at >= v_today)
  ),
  open_cash as (
    select cs.cash_register_id,
      r.opening_amount + cs.sales_cash + cs.debt_payments + cs.ingresos
        - cs.retiros - cs.supplier_payments - cs.cash_purchases as cash
    from public.cash_register_summaries(
      array(select id from registers where status = 'abierta')
    ) cs
    join registers r on r.id = cs.cash_register_id
  ),
  per_user as (
    select m.user_id,
      coalesce(m.username, m.email) as label,
      m.role,
      coalesce(st.sales_count, 0) as sales_count,
      coalesce(st.sales_total, 0) as sales_total,
      st.last_sale_at,
      (
        select jsonb_build_object(
          'id', r.id,
          'opened_at', r.opened_at,
          'opening_amount', r.opening_amount,
          'cash', oc.cash
        )
        from registers r
        left join open_cash oc on oc.cash_register_id = r.id
        where r.user_id = m.user_id and r.status = 'abierta'
        order by r.opened_at desc
        limit 1
      ) as open_register,
      (
        select jsonb_agg(jsonb_build_object(
          'closed_at', r.closed_at,
          'difference', coalesce(r.closing_amount, 0) - coalesce(r.expected_amount, 0)
        ) order by r.closed_at)
        from registers r
        where r.user_id = m.user_id and r.status = 'cerrada'
      ) as closed_today
    from memberships m
    left join (
      select ts.user_id,
        count(*) as sales_count,
        sum(ts.total) as sales_total,
        max(ts.created_at) as last_sale_at
      from today_sales ts
      group by ts.user_id
    ) st on st.user_id = m.user_id
    where m.org_id = p_org_id
  ),
  recent as (
    select ts.id, ts.user_id, ts.total, ts.payment_method, ts.created_at,
      (
        select string_agg(
          case when si.quantity = 1 then si.product_name
               else si.product_name || ' x' || trim(to_char(si.quantity, 'FM999990.###')) end,
          ', ' order by si.id)
        from sale_items si
        where si.sale_id = ts.id
      ) as items
    from today_sales ts
    order by ts.created_at desc
    limit 10
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'today', jsonb_build_object(
      'count', (select count(*) from today_sales),
      'total', coalesce((select sum(total) from today_sales), 0)
    ),
    'yesterday_same_time', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(s.total), 0))
      from sales s
      where s.org_id = p_org_id
        and s.status = 'completada'
        and s.created_at >= v_yesterday
        and s.created_at < v_now - interval '1 day'
    ),
    'by_hour', (
      select jsonb_agg(coalesce(h.total, 0) order by g.hour)
      from generate_series(0, 23) as g(hour)
      left join (
        select extract(hour from ts.created_at at time zone v_tz)::int as hour, sum(ts.total) as total
        from today_sales ts
        group by 1
      ) h on h.hour = g.hour
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pu.user_id,
        'label', pu.label,
        'role', pu.role,
        'sales_count', pu.sales_count,
        'sales_total', pu.sales_total,
        'last_sale_at', pu.last_sale_at,
        'open_register', pu.open_register,
        'closed_today', coalesce(pu.closed_today, '[]'::jsonb)
      ) order by (pu.open_register is null), pu.sales_total desc)
      from per_user pu
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'total', r.total,
        'payment_method', r.payment_method,
        'created_at', r.created_at,
        'items', r.items
      ) order by r.created_at desc)
      from recent r
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- Para "hoy" y "ayer a esta hora" por negocio.
create index if not exists sales_org_id_created_at_idx on sales (org_id, created_at);
