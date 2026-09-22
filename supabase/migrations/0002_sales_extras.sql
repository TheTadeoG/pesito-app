-- Pesito: método de pago QR, recargos y anulación de ventas.
-- Corre sobre una base que ya tiene 0001_init.sql aplicada.

alter table sales drop constraint if exists sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto', 'fiado'));

alter table sales add column if not exists surcharge numeric(12, 2) not null default 0;

create or replace function public.checkout_sale(
  p_org_id uuid,
  p_cash_register_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_discount numeric,
  p_items jsonb,
  p_surcharge numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
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

  insert into sales (org_id, cash_register_id, customer_id, user_id, subtotal, discount, surcharge, total, payment_method)
  values (
    p_org_id,
    p_cash_register_id,
    p_customer_id,
    auth.uid(),
    v_subtotal,
    coalesce(p_discount, 0),
    coalesce(p_surcharge, 0),
    v_subtotal - coalesce(p_discount, 0) + coalesce(p_surcharge, 0),
    p_payment_method
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

  if p_payment_method = 'fiado' and p_customer_id is not null then
    update customers
      set balance = balance + (v_subtotal - coalesce(p_discount, 0) + coalesce(p_surcharge, 0))
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

  if v_sale.payment_method = 'fiado' and v_sale.customer_id is not null then
    update customers set balance = balance - v_sale.total where id = v_sale.customer_id;
  end if;

  update sales set status = 'anulada' where id = p_sale_id;
end;
$$;
