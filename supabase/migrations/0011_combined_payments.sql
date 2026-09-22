-- Pesito: permitir combinar medios de pago en una misma venta (ej: parte
-- efectivo + parte fiado, o parte transferencia + parte efectivo), guardando
-- el detalle en sale_payments. También permite cargar a fiado la diferencia
-- cuando el pago en efectivo no alcanza a cubrir el total.
-- Corre sobre una base que ya tiene 0001..0010 aplicadas.

create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  cash_register_id uuid references cash_registers (id) on delete set null,
  method text not null check (method in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'fiado')),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_id_idx on sale_payments (sale_id);
create index if not exists sale_payments_cash_register_method_idx
  on sale_payments (cash_register_id, method);

alter table sale_payments enable row level security;

create policy "members can view sale payments in their org"
  on sale_payments for select
  using (public.is_org_member(org_id));

create or replace function public.checkout_sale(
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_pay jsonb;
  v_pay_sum numeric := 0;
  v_fiado_amount numeric := 0;
  v_method text;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'el carrito está vacío';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric;
  end loop;

  v_total := v_subtotal - coalesce(p_discount, 0) + coalesce(p_surcharge, 0);

  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    for v_pay in select * from jsonb_array_elements(p_payments) loop
      v_pay_sum := v_pay_sum + (v_pay ->> 'amount')::numeric;
    end loop;

    if abs(v_pay_sum - v_total) > 0.01 then
      raise exception 'la suma de los medios de pago no coincide con el total de la venta';
    end if;
  end if;

  insert into sales (
    org_id, cash_register_id, customer_id, user_id,
    subtotal, discount, surcharge, total, payment_method, invoice_type
  )
  values (
    p_org_id,
    p_cash_register_id,
    p_customer_id,
    auth.uid(),
    v_subtotal,
    coalesce(p_discount, 0),
    coalesce(p_surcharge, 0),
    v_total,
    p_payment_method,
    coalesce(nullif(p_invoice_type, ''), 'consumidor_final')
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;

    if nullif(v_item ->> 'product_id', '') is null then
      insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
      values (
        v_sale_id,
        null,
        coalesce(nullif(v_item ->> 'product_name', ''), 'Monto libre'),
        v_quantity,
        (v_item ->> 'unit_price')::numeric,
        v_quantity * (v_item ->> 'unit_price')::numeric
      );
      continue;
    end if;

    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and org_id = p_org_id
      for update;

    if v_product.id is null then
      raise exception 'producto no encontrado';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'stock insuficiente para %', v_product.name;
    end if;

    insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      (v_item ->> 'unit_price')::numeric,
      v_quantity * (v_item ->> 'unit_price')::numeric
    );

    update products set stock = stock - v_quantity where id = v_product.id;

    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
    values (p_org_id, v_product.id, 'venta', -1 * v_quantity, v_sale_id::text, auth.uid());
  end loop;

  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    for v_pay in select * from jsonb_array_elements(p_payments) loop
      v_method := v_pay ->> 'method';

      insert into sale_payments (org_id, sale_id, cash_register_id, method, amount)
      values (p_org_id, v_sale_id, p_cash_register_id, v_method, (v_pay ->> 'amount')::numeric);

      if v_method = 'fiado' then
        v_fiado_amount := v_fiado_amount + (v_pay ->> 'amount')::numeric;
      end if;
    end loop;
  else
    insert into sale_payments (org_id, sale_id, cash_register_id, method, amount)
    values (p_org_id, v_sale_id, p_cash_register_id, p_payment_method, v_total);

    if p_payment_method = 'fiado' then
      v_fiado_amount := v_total;
    end if;
  end if;

  if v_fiado_amount > 0 then
    if p_customer_id is null then
      raise exception 'para vender fiado primero elegí un cliente';
    end if;
    update customers set balance = balance + v_fiado_amount
      where id = p_customer_id and org_id = p_org_id;
  end if;

  return v_sale_id;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales%rowtype;
  v_item record;
  v_fiado_amount numeric;
begin
  select * into v_sale from sales where id = p_sale_id;

  if v_sale.id is null then
    raise exception 'venta no encontrada';
  end if;

  if not public.is_org_member(v_sale.org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if v_sale.status = 'anulada' then
    raise exception 'la venta ya está anulada';
  end if;

  for v_item in select * from sale_items where sale_id = p_sale_id loop
    if v_item.product_id is not null then
      update products set stock = stock + v_item.quantity where id = v_item.product_id;

      insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
      values (
        v_sale.org_id,
        v_item.product_id,
        'ajuste',
        v_item.quantity,
        'Anulación de venta ' || p_sale_id::text,
        auth.uid()
      );
    end if;
  end loop;

  select coalesce(sum(amount), 0) into v_fiado_amount
    from sale_payments where sale_id = p_sale_id and method = 'fiado';

  -- Ventas fiado registradas antes de esta migración no tienen filas en
  -- sale_payments: usamos el total de la venta como respaldo.
  if v_fiado_amount = 0 and v_sale.payment_method = 'fiado' then
    v_fiado_amount := v_sale.total;
  end if;

  if v_fiado_amount > 0 and v_sale.customer_id is not null then
    update customers set balance = balance - v_fiado_amount where id = v_sale.customer_id;
  end if;

  update sales set status = 'anulada' where id = p_sale_id;
end;
$$;
