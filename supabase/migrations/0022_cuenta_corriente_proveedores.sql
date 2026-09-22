-- Pesito: cuenta corriente con proveedores. Espeja lo que ya existe para el
-- fiado de clientes (customers.balance + customer_payments), pero en el otro
-- sentido: lo que la organización le debe al proveedor.
-- Corre sobre una base que ya tiene 0001..0021 aplicadas.

alter table suppliers add column if not exists balance numeric(12, 2) not null default 0;

-- Cuánto de cada compra quedó "a cuenta" (sin pagar en el momento). Se guarda
-- en la compra para poder revertirlo si se anula.
alter table purchases add column if not exists account_amount numeric(12, 2) not null default 0;

create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  supplier_id uuid not null references suppliers (id) on delete cascade,
  cash_register_id uuid references cash_registers (id) on delete set null,
  method text not null check (method in ('efectivo', 'tarjeta', 'transferencia', 'qr')),
  amount numeric(12, 2) not null check (amount > 0),
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists supplier_payments_supplier_id_idx on supplier_payments (supplier_id);
create index if not exists supplier_payments_cash_register_method_idx
  on supplier_payments (cash_register_id, method);

alter table supplier_payments enable row level security;

create policy "members can view supplier payments in their org"
  on supplier_payments for select
  using (public.is_org_member(org_id));

-- register_purchase ahora acepta cuánto de la compra queda a cuenta
-- corriente con el proveedor. Cambia la lista de parámetros (se agrega
-- p_account_amount), así que hay que borrar la versión anterior primero:
-- un CREATE OR REPLACE con distinta firma crea un overload en vez de
-- reemplazarla.
drop function if exists public.register_purchase(uuid, uuid, jsonb, text);

create or replace function public.register_purchase(
  p_org_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_account_amount numeric default 0
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

  insert into purchases (org_id, supplier_id, user_id, subtotal, total, notes, account_amount)
  values (p_org_id, p_supplier_id, auth.uid(), v_subtotal, v_subtotal, nullif(p_notes, ''), v_account_amount)
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

-- void_purchase: misma firma (sólo cambia el cuerpo), así que CREATE OR
-- REPLACE alcanza. Ahora también revierte el saldo a cuenta corriente que
-- haya dejado la compra.
create or replace function public.void_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_item record;
  v_product products%rowtype;
begin
  select * into v_purchase from purchases where id = p_purchase_id;

  if v_purchase.id is null then
    raise exception 'compra no encontrada';
  end if;

  if not public.is_org_member(v_purchase.org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if v_purchase.status = 'anulada' then
    raise exception 'la compra ya está anulada';
  end if;

  for v_item in select * from purchase_items where purchase_id = p_purchase_id loop
    select * into v_product from products where id = v_item.product_id for update;

    if v_product.id is not null then
      if v_product.stock < v_item.quantity then
        raise exception 'no se puede anular: % ya no tiene stock suficiente para revertir', v_product.name;
      end if;

      update products set stock = stock - v_item.quantity where id = v_product.id;

      insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
      values (
        v_purchase.org_id,
        v_product.id,
        'ajuste',
        -1 * v_item.quantity,
        'Anulación de compra ' || p_purchase_id::text,
        auth.uid()
      );
    end if;
  end loop;

  if coalesce(v_purchase.account_amount, 0) > 0 and v_purchase.supplier_id is not null then
    update suppliers set balance = balance - v_purchase.account_amount where id = v_purchase.supplier_id;
  end if;

  update purchases set status = 'anulada' where id = p_purchase_id;
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

  insert into supplier_payments (org_id, supplier_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, p_amount, auth.uid());

  update suppliers set balance = balance - p_amount where id = p_supplier_id;
end;
$$;
