-- Pesito: pagar una compra combinando varios medios (ej: parte efectivo +
-- parte cuenta corriente, o parte tarjeta + parte transferencia), igual que
-- ya se puede combinar medios de pago en una venta. Reemplaza los parámetros
-- sueltos p_account_amount/p_payment_method de 0023 por un desglose único
-- p_payments (mismo patrón que sale_payments/checkout_sale).
-- Corre sobre una base que ya tiene 0001..0023 aplicadas.

create table if not exists purchase_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  purchase_id uuid not null references purchases (id) on delete cascade,
  cash_register_id uuid references cash_registers (id) on delete set null,
  method text not null check (method in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'cuenta_corriente')),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists purchase_payments_purchase_id_idx on purchase_payments (purchase_id);
create index if not exists purchase_payments_cash_register_method_idx
  on purchase_payments (cash_register_id, method);

alter table purchase_payments enable row level security;

create policy "members can view purchase payments in their org"
  on purchase_payments for select
  using (public.is_org_member(org_id));

-- purchases.payment_method ahora también puede ser 'mixto' (varios medios
-- para la parte que no es a cuenta corriente), igual que sales.payment_method.
alter table purchases drop constraint if exists purchases_payment_method_check;
alter table purchases add constraint purchases_payment_method_check
  check (payment_method is null or payment_method in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto'));

-- register_purchase cambia p_account_amount + p_payment_method por un único
-- p_payments (jsonb, [{method, amount}, ...]) que cubre el total completo
-- (incluyendo 'cuenta_corriente' como un medio más). Firma distinta: hay que
-- borrar la versión anterior antes de recrearla.
drop function if exists public.register_purchase(uuid, uuid, jsonb, text, numeric, uuid, text);

create or replace function public.register_purchase(
  p_org_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_cash_register_id uuid default null,
  p_payments jsonb default null
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
  v_pay jsonb;
  v_pay_sum numeric := 0;
  v_account_amount numeric := 0;
  v_method text;
  v_amount numeric;
  v_methods text[] := '{}';
  v_payment_method text;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'la compra no tiene productos';
  end if;

  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'elegí cómo se paga la compra';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_cost')::numeric;
  end loop;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_method := v_pay ->> 'method';
    v_amount := (v_pay ->> 'amount')::numeric;

    if v_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'cuenta_corriente') then
      raise exception 'medio de pago inválido';
    end if;

    v_pay_sum := v_pay_sum + v_amount;

    if v_amount > 0 then
      if v_method = 'cuenta_corriente' then
        v_account_amount := v_account_amount + v_amount;
      elsif not (v_method = any(v_methods)) then
        v_methods := array_append(v_methods, v_method);
      end if;
    end if;
  end loop;

  if abs(v_pay_sum - v_subtotal) > 0.01 then
    raise exception 'la suma de los medios de pago no coincide con el total de la compra';
  end if;

  if v_account_amount > 0 and p_supplier_id is null then
    raise exception 'para dejar saldo a cuenta corriente primero elegí un proveedor';
  end if;

  if 'efectivo' = any(v_methods) and p_cash_register_id is null then
    raise exception 'abrí tu caja para poder pagar en efectivo';
  end if;

  v_payment_method := case
    when array_length(v_methods, 1) is null then null
    when array_length(v_methods, 1) = 1 then v_methods[1]
    else 'mixto'
  end;

  insert into purchases (
    org_id, supplier_id, user_id, subtotal, total, notes, account_amount,
    cash_register_id, payment_method
  )
  values (
    p_org_id, p_supplier_id, auth.uid(), v_subtotal, v_subtotal, nullif(p_notes, ''), v_account_amount,
    p_cash_register_id, v_payment_method
  )
  returning id into v_purchase_id;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    if (v_pay ->> 'amount')::numeric > 0 then
      insert into purchase_payments (org_id, purchase_id, cash_register_id, method, amount)
      values (p_org_id, v_purchase_id, p_cash_register_id, v_pay ->> 'method', (v_pay ->> 'amount')::numeric);
    end if;
  end loop;

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
