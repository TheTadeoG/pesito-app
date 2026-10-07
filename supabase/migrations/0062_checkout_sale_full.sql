-- Cobrar en una sola consulta.
--
-- Hasta ahora, después de checkout_sale el servidor hacía ~7 consultas más
-- (la caja, el stock, el saldo del cliente y las ventas recientes con sus
-- ítems, clientes y fiado). Esta función llama a checkout_sale y devuelve en el
-- mismo viaje lo que el POS necesita para actualizarse.
--
-- Nombre nuevo a propósito (no `checkout_sale`): redefinir con otra firma
-- crearía un overload (ver 0037). checkout_sale queda igual y es la que escribe
-- el dinero y el stock; esta sólo la llama y lee. security invoker: lee con los
-- mismos permisos que antes.

create or replace function public.checkout_sale_full(
  p_org_id uuid,
  p_cash_register_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_discount numeric,
  p_items jsonb,
  p_surcharge numeric default 0,
  p_invoice_type text default 'consumidor_final',
  p_payments jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale uuid;
  v_branch uuid;
  v_ids uuid[];
begin
  v_sale := public.checkout_sale(
    p_org_id, p_cash_register_id, p_customer_id, p_payment_method, p_discount,
    p_items, p_surcharge, p_invoice_type, p_payments
  );

  select branch_id into v_branch from cash_registers where id = p_cash_register_id;

  select coalesce(array_agg(distinct (e ->> 'product_id')::uuid)
      filter (where nullif(e ->> 'product_id', '') is not null), '{}')
    into v_ids
  from jsonb_array_elements(p_items) e;

  return jsonb_build_object(
    'sale_id', v_sale,
    -- Stock que queda en la sucursal de la caja (o el total, sin sucursales).
    'stock', (
      select coalesce(jsonb_object_agg(id::text, stock), '{}'::jsonb)
      from (
        select bs.product_id as id, bs.stock
        from branch_stock bs
        where v_branch is not null and bs.branch_id = v_branch and bs.product_id = any (v_ids)
        union all
        select p.id, p.stock
        from products p
        where v_branch is null and p.id = any (v_ids)
      ) x
    ),
    'customer_balance', case
      when p_customer_id is null then null
      else (select jsonb_build_object('id', c.id, 'balance', c.balance) from customers c where c.id = p_customer_id)
    end,
    -- Ventas recientes de la caja (8), como las muestra el POS.
    'recent', (
      select coalesce(jsonb_agg(row order by created_at desc, id), '[]'::jsonb)
      from (
        select s.id, s.created_at,
          jsonb_build_object(
            'id', s.id,
            'created_at', s.created_at,
            'total', s.total,
            'payment_method', s.payment_method,
            'invoice_type', s.invoice_type,
            'customer_id', s.customer_id,
            'customer_name', c.name,
            'fiado', coalesce((select sum(sp.amount) from sale_payments sp where sp.sale_id = s.id and sp.method = 'fiado'), 0),
            'items', (
              select coalesce(jsonb_agg(
                case when i.quantity > 1
                  then i.product_name || ' x' || trim(trailing '.' from trim(trailing '0' from i.quantity::text))
                  else i.product_name end
                order by i.id), '[]'::jsonb)
              from sale_items i where i.sale_id = s.id
            )
          ) as row
        from sales s
        left join customers c on c.id = s.customer_id
        where s.cash_register_id = p_cash_register_id and s.status = 'completada'
        order by s.created_at desc, s.id
        limit 8
      ) r
    )
  );
end;
$$;

grant execute on function public.checkout_sale_full(uuid, uuid, uuid, text, numeric, jsonb, numeric, text, jsonb) to authenticated;
