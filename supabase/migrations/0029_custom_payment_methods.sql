-- Pesito: medios de pago personalizados por organización (ej: "Mercado
-- Pago", "Talo", "Ualá"), además de los fijos (efectivo/tarjeta/
-- transferencia/qr). Se guardan por su nombre visible, no por un slug: ese
-- mismo texto es el valor que termina en payment_method/method en
-- sales/sale_payments/purchases/purchase_payments, así que todas las
-- pantallas que ya muestran `paymentLabels[method] ?? method` (todas la
-- tienen) los etiquetan bien sin tocarlas.
--
-- A fines de caja y facturación un medio personalizado se comporta siempre
-- como "no efectivo" (igual que tarjeta/transferencia): no entra en el
-- arqueo de efectivo (que sólo mira 'efectivo') y por defecto sugiere
-- Factura B en vez de Consumidor Final.
-- Corre sobre una base que ya tiene 0001..0028 aplicadas.

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

alter table payment_methods enable row level security;

create policy "members can manage payment methods"
  on payment_methods for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Los CHECK de fila no pueden mirar otra tabla, así que acá sólo se valida
-- formato (no vacío); la pertenencia real (medio fijo u org propio) la
-- validan checkout_sale/register_purchase más abajo, antes de insertar.
alter table sales drop constraint if exists sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method is not null and length(trim(payment_method)) > 0);

alter table sale_payments drop constraint if exists sale_payments_method_check;
alter table sale_payments add constraint sale_payments_method_check
  check (length(trim(method)) > 0);

alter table purchases drop constraint if exists purchases_payment_method_check;
alter table purchases add constraint purchases_payment_method_check
  check (payment_method is null or length(trim(payment_method)) > 0);

alter table purchase_payments drop constraint if exists purchase_payments_method_check;
alter table purchase_payments add constraint purchase_payments_method_check
  check (length(trim(method)) > 0);

alter table customer_payments drop constraint if exists customer_payments_method_check;
alter table customer_payments add constraint customer_payments_method_check
  check (length(trim(method)) > 0);

alter table supplier_payments drop constraint if exists supplier_payments_method_check;
alter table supplier_payments add constraint supplier_payments_method_check
  check (length(trim(method)) > 0);

-- checkout_sale: misma firma que en 0014, se agrega la validación de medio
-- de pago (fijo, o personalizado cargado por la organización) que antes
-- hacía el CHECK constraint ahora relajado.
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

  if p_payment_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto', 'fiado')
     and not exists (
       select 1 from payment_methods where org_id = p_org_id and name = p_payment_method
     ) then
    raise exception 'medio de pago inválido';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric;
  end loop;

  v_total := v_subtotal - coalesce(p_discount, 0) + coalesce(p_surcharge, 0);

  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    for v_pay in select * from jsonb_array_elements(p_payments) loop
      v_method := v_pay ->> 'method';

      if v_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'fiado')
         and not exists (
           select 1 from payment_methods where org_id = p_org_id and name = v_method
         ) then
        raise exception 'medio de pago inválido';
      end if;

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

-- register_purchase: misma firma que en 0024, sólo se amplía la validación
-- de v_method para aceptar también medios personalizados de la org.
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

    if v_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'cuenta_corriente')
       and not exists (
         select 1 from payment_methods where org_id = p_org_id and name = v_method
       ) then
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

-- register_customer_payment / register_supplier_payment: misma firma que en
-- 0012/0022, se agrega la misma validación de medio de pago.
create or replace function public.register_customer_payment(
  p_customer_id uuid,
  p_cash_register_id uuid,
  p_method text,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from customers where id = p_customer_id;

  if v_org_id is null then
    raise exception 'cliente no encontrado';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'monto inválido';
  end if;

  if p_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr')
     and not exists (
       select 1 from payment_methods where org_id = v_org_id and name = p_method
     ) then
    raise exception 'medio de pago inválido';
  end if;

  insert into customer_payments (org_id, customer_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_customer_id, p_cash_register_id, p_method, p_amount, auth.uid());

  update customers set balance = balance - p_amount where id = p_customer_id;
end;
$$;

create or replace function public.register_supplier_payment(
  p_supplier_id uuid,
  p_cash_register_id uuid,
  p_method text,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from suppliers where id = p_supplier_id;

  if v_org_id is null then
    raise exception 'proveedor no encontrado';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'monto inválido';
  end if;

  if p_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr')
     and not exists (
       select 1 from payment_methods where org_id = v_org_id and name = p_method
     ) then
    raise exception 'medio de pago inválido';
  end if;

  insert into supplier_payments (org_id, supplier_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, p_amount, auth.uid());

  update suppliers set balance = balance - p_amount where id = p_supplier_id;
end;
$$;
