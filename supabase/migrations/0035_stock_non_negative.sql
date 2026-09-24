-- Pesito: "que no me deje usar stock negativo".
--
-- checkout_sale y void_purchase (definidos en 0029 y 0022) ya frenan la
-- venta o la anulación cuando no hay stock suficiente, y adjustStock
-- (código de la app) ya rechaza un ajuste que deje el stock en negativo.
-- Lo que faltaba:
--   1. El alta de un producto nuevo podía cargarse con stock inicial o
--      stock mínimo negativo (sin validación ni en el form ni en el
--      server action) — ya se corrigió del lado de la app en este mismo
--      cambio (product-form.tsx / actions.ts).
--   2. Una cantidad negativa en un ítem de venta o de compra podía burlar
--      el chequeo de "stock insuficiente" (una cantidad negativa siempre
--      es menor al stock disponible) y terminar sumando o restando stock
--      al revés de lo esperado.
--   3. No había ninguna barrera a nivel de base de datos: cualquier otro
--      camino (una fila cargada a mano desde el SQL Editor, una futura
--      función que no reutilice adjustStock/checkout_sale) podía dejar
--      products.stock en negativo sin que nada lo impidiera.
--
-- Este archivo cierra 2 y 3. Corre sobre una base que ya tiene 0001..0034
-- aplicadas.
--
-- IMPORTANTE: si ya tenés algún producto con stock negativo (llegó a
-- pasar antes de este fix, por ej. cargando el alta con un stock inicial
-- negativo), el CHECK de abajo no se puede validar hasta corregirlo. Este
-- archivo lo hace automáticamente: lleva a 0 cualquier stock negativo
-- existente y deja un movimiento de "ajuste" con el motivo, para que
-- quede el rastro en el historial en vez de perderse en silencio.
insert into stock_movements (org_id, product_id, type, quantity, reference)
select org_id, id, 'ajuste', -stock, 'Corrección automática: el stock estaba en negativo'
from products
where stock < 0;

update products set stock = 0 where stock < 0;
update products set min_stock = 0 where min_stock < 0;

-- CHECK como red de seguridad final: todo lo que ya valida antes (RPCs,
-- server actions) nunca debería dispararlo, pero si algo se escapa, la
-- fila directamente no se guarda en vez de quedar con stock negativo.
-- NOT VALID + VALIDATE para no bloquear la tabla mientras se confirma que
-- las filas existentes ya cumplen (ya corregidas arriba).
alter table products
  add constraint products_stock_non_negative check (stock >= 0) not valid;
alter table products
  validate constraint products_stock_non_negative;

alter table products
  add constraint products_min_stock_non_negative check (min_stock >= 0) not valid;
alter table products
  validate constraint products_min_stock_non_negative;

-- checkout_sale: misma firma que en 0029, se agrega el chequeo de que la
-- cantidad vendida sea positiva (antes, una cantidad negativa pasaba el
-- "stock insuficiente" de largo porque siempre es menor al stock
-- disponible, y terminaba sumando stock en vez de restarlo).
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
    if (v_item ->> 'quantity')::numeric <= 0 then
      raise exception 'la cantidad tiene que ser mayor a cero';
    end if;
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

-- register_purchase: misma firma que en 0029, se agrega el mismo chequeo
-- de cantidad positiva (una cantidad negativa en una compra restaría
-- stock en vez de sumarlo, y podía dejarlo negativo sin pasar por
-- checkout_sale ni por void_purchase).
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
    if (v_item ->> 'quantity')::numeric <= 0 then
      raise exception 'la cantidad tiene que ser mayor a cero';
    end if;
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
