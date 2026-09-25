-- Pesito: resumen de caja en una sola consulta.
--
-- La página de Caja calculaba el efectivo y el desglose por medio de pago
-- caja por caja (la abierta, las 20 últimas cerradas y, para el dueño, las
-- abiertas del equipo), con 3 a 8 consultas por caja: ~194 consultas por
-- visita y ~582 al cerrar la caja. Esta función devuelve lo mismo para todas
-- las cajas pedidas de una vez.
--
-- Replica exactamente las reglas de src/lib/caja.ts (computeCashBreakdown y
-- computePaymentBreakdown):
--   * Ventas: sólo las 'completada'. De una venta 'mixto' cuenta el desglose
--     de sale_payments; una 'mixto' vieja sin desglose va entera a "mixto" en
--     el desglose por medio y no suma al efectivo.
--   * Cobros de fiado (customer_payments): suman al desglose en su medio y,
--     si son en efectivo, al efectivo.
--   * Ingresos y retiros manuales (cash_movements).
--   * Pagos a proveedores en efectivo (supplier_payments) restan.
--   * Compras 'completada' de la caja: resta la parte en efectivo de
--     purchase_payments.
--
-- Las cajas que el usuario no puede ver (de otro negocio) no aparecen en el
-- resultado. Corre sobre una base con 0001..0037 aplicadas; se puede correr
-- más de una vez.

-- Las ventas se buscaban por caja sin índice (sólo había org_id, created_at).
create index if not exists sales_cash_register_id_idx on sales (cash_register_id);

create or replace function public.cash_register_summaries(p_register_ids uuid[])
returns table (
  cash_register_id uuid,
  sales_cash numeric,
  debt_payments numeric,
  ingresos numeric,
  retiros numeric,
  supplier_payments numeric,
  cash_purchases numeric,
  payment_breakdown jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with regs as (
    select r.id
    from cash_registers r
    where r.id = any(p_register_ids)
      and public.is_org_member(r.org_id)
  ),
  sales_done as (
    select s.id, s.cash_register_id, s.payment_method, s.total
    from sales s
    where s.cash_register_id in (select id from regs)
      and s.status = 'completada'
  ),
  mixed_payments as (
    select sd.cash_register_id, sp.method, sp.amount
    from sales_done sd
    join sale_payments sp on sp.sale_id = sd.id
    where sd.payment_method = 'mixto'
  ),
  debt as (
    select cp.cash_register_id, cp.method, cp.amount
    from customer_payments cp
    where cp.cash_register_id in (select id from regs)
  ),
  by_method as (
    select sd.cash_register_id, sd.payment_method as method, sd.total as amount
    from sales_done sd
    where sd.payment_method <> 'mixto'
    union all
    select mp.cash_register_id, mp.method, mp.amount
    from mixed_payments mp
    union all
    select sd.cash_register_id, 'mixto', sd.total
    from sales_done sd
    where sd.payment_method = 'mixto'
      and not exists (select 1 from sale_payments sp where sp.sale_id = sd.id)
    union all
    select d.cash_register_id, d.method, d.amount
    from debt d
  ),
  breakdown as (
    select m.cash_register_id,
      jsonb_agg(jsonb_build_object('method', m.method, 'total', m.total) order by m.total desc) as rows
    from (
      select bm.cash_register_id, bm.method, sum(bm.amount) as total
      from by_method bm
      group by bm.cash_register_id, bm.method
    ) m
    group by m.cash_register_id
  ),
  sales_cash as (
    select x.cash_register_id, sum(x.amount) as total
    from (
      select sd.cash_register_id, sd.total as amount
      from sales_done sd
      where sd.payment_method = 'efectivo'
      union all
      select mp.cash_register_id, mp.amount
      from mixed_payments mp
      where mp.method = 'efectivo'
    ) x
    group by x.cash_register_id
  ),
  debt_cash as (
    select d.cash_register_id, sum(d.amount) as total
    from debt d
    where d.method = 'efectivo'
    group by d.cash_register_id
  ),
  movements as (
    select cm.cash_register_id,
      sum(cm.amount) filter (where cm.type = 'ingreso') as ingresos,
      sum(cm.amount) filter (where cm.type = 'retiro') as retiros
    from cash_movements cm
    where cm.cash_register_id in (select id from regs)
    group by cm.cash_register_id
  ),
  supplier_cash as (
    select sp.cash_register_id, sum(sp.amount) as total
    from supplier_payments sp
    where sp.cash_register_id in (select id from regs)
      and sp.method = 'efectivo'
    group by sp.cash_register_id
  ),
  purchases_cash as (
    select p.cash_register_id, sum(pp.amount) as total
    from purchases p
    join purchase_payments pp on pp.purchase_id = p.id
    where p.cash_register_id in (select id from regs)
      and p.status = 'completada'
      and pp.method = 'efectivo'
    group by p.cash_register_id
  )
  select
    r.id,
    coalesce(sc.total, 0),
    coalesce(dc.total, 0),
    coalesce(mv.ingresos, 0),
    coalesce(mv.retiros, 0),
    coalesce(spc.total, 0),
    coalesce(pc.total, 0),
    coalesce(b.rows, '[]'::jsonb)
  from regs r
  left join sales_cash sc on sc.cash_register_id = r.id
  left join debt_cash dc on dc.cash_register_id = r.id
  left join movements mv on mv.cash_register_id = r.id
  left join supplier_cash spc on spc.cash_register_id = r.id
  left join purchases_cash pc on pc.cash_register_id = r.id
  left join breakdown b on b.cash_register_id = r.id;
$$;
