-- Pesito: método de pago para la parte de una compra que se paga en el
-- momento (lo que no queda a cuenta corriente con el proveedor). Si se paga
-- en efectivo, se descuenta de la caja abierta del usuario que la registra,
-- igual que ya pasa con las ventas y los cobros/pagos de cuenta corriente.
-- Corre sobre una base que ya tiene 0001..0022 aplicadas.

alter table purchases add column if not exists cash_register_id uuid
  references cash_registers (id) on delete set null;

alter table purchases add column if not exists payment_method text;

alter table purchases drop constraint if exists purchases_payment_method_check;
alter table purchases add constraint purchases_payment_method_check
  check (payment_method is null or payment_method in ('efectivo', 'tarjeta', 'transferencia', 'qr'));

create index if not exists purchases_cash_register_method_idx
  on purchases (cash_register_id, payment_method);

-- register_purchase suma dos parámetros nuevos: cambia la firma, así que
-- hay que borrar la versión anterior antes de recrearla.
drop function if exists public.register_purchase(uuid, uuid, jsonb, text, numeric);

create or replace function public.register_purchase(
  p_org_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_account_amount numeric default 0,
  p_cash_register_id uuid default null,
  p_payment_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_unit_cost numeric;
  v_account_amount numeric := coalesce(p_account_amount, 0);
  v_paid_now numeric;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'la compra no tiene productos';
  end if;

  if v_account_amount < 0 then
    raise exception 'el monto a cuenta corriente no puede ser negativo';
  end if;

  if v_account_amount > 0 and p_supplier_id is null then
    raise exception 'para dejar saldo a cuenta corriente primero elegí un proveedor';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_cost')::numeric;
  end loop;

  if v_account_amount > v_subtotal then
    raise exception 'el monto a cuenta corriente no puede ser mayor al total de la compra';
  end if;

  v_paid_now := v_subtotal - v_account_amount;

  if v_paid_now > 0 then
    if p_payment_method is null or p_payment_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr') then
      raise exception 'elegí cómo pagás la parte que no queda a cuenta corriente';
    end if;

    if p_payment_method = 'efectivo' and p_cash_register_id is null then
      raise exception 'abrí tu caja para poder pagar en efectivo';
    end if;
  end if;

  insert into purchases (
    org_id, supplier_id, user_id, subtotal, total, notes, account_amount,
    cash_register_id, payment_method
  )
  values (
    p_org_id, p_supplier_id, auth.uid(), v_subtotal, v_subtotal, nullif(p_notes, ''), v_account_amount,
    p_cash_register_id,
    case when v_paid_now > 0 then p_payment_method else null end
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_cost := (v_item ->> 'unit_cost')::numeric;

    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and org_id = p_org_id
      for update;

    if v_product.id is null then
      raise exception 'producto no encontrado';
    end if;

    insert into purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, subtotal)
    values (
      v_purchase_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_unit_cost,
      v_quantity * v_unit_cost
    );

    update products
      set stock = stock + v_quantity, cost = v_unit_cost
      where id = v_product.id;

    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
    values (p_org_id, v_product.id, 'compra', v_quantity, v_purchase_id::text, auth.uid());
  end loop;

  if v_account_amount > 0 then
    update suppliers set balance = balance + v_account_amount where id = p_supplier_id;
  end if;

  return v_purchase_id;
end;
$$;
