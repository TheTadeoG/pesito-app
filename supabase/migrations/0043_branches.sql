-- Pesito: sucursales con stock propio.
--
-- Cada negocio tiene una o más sucursales (branches). Una es la "principal"
-- (se crea sola para cada negocio). El stock pasa a ser por sucursal
-- (branch_stock) y products.stock queda como el total de todas, mantenido
-- por la base, para que todo lo que hoy lo lee (reportes, listados) siga
-- andando igual.
--
-- Cada caja se abre en una sucursal; las ventas, compras y movimientos de
-- stock guardan la sucursal. Vender descuenta y comprar suma en la sucursal
-- de la caja. Cada integrante puede tener una sucursal asignada
-- (memberships.branch_id); sin asignar = la principal.
--
-- Compatible con el código anterior: cualquier cambio directo a
-- products.stock (el alta de producto con stock inicial, el ajuste de stock
-- de la app vieja, el SQL Editor) se aplica a la sucursal "de contexto" —la
-- que fija la función que está corriendo (set_stock_branch) o, si ninguna,
-- la principal—. Así esta migración se puede aplicar antes o después de
-- publicar el código nuevo.
--
-- La primera sucursal es de todos los planes; crear más requiere Pro (plan
-- pro/ia o prueba vigente).
--
-- Corre sobre una base con 0001..0042 aplicadas; se puede correr más de una
-- vez.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists branches_one_main_per_org on branches (org_id) where is_main;
create unique index if not exists branches_org_name on branches (org_id, lower(name));

alter table branches enable row level security;

drop policy if exists "members can view branches" on branches;
create policy "members can view branches"
  on branches for select
  using (public.is_org_member(org_id));

drop policy if exists "admins can rename branches" on branches;
create policy "admins can rename branches"
  on branches for update
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create table if not exists branch_stock (
  branch_id uuid not null references branches (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  stock numeric not null default 0 check (stock >= 0),
  primary key (branch_id, product_id)
);

create index if not exists branch_stock_product_idx on branch_stock (product_id);
create index if not exists branch_stock_org_idx on branch_stock (org_id);

alter table branch_stock enable row level security;

drop policy if exists "members can view branch stock" on branch_stock;
create policy "members can view branch stock"
  on branch_stock for select
  using (public.is_org_member(org_id));

alter table cash_registers add column if not exists branch_id uuid references branches (id);
alter table sales add column if not exists branch_id uuid references branches (id);
alter table purchases add column if not exists branch_id uuid references branches (id);
alter table stock_movements add column if not exists branch_id uuid references branches (id);
alter table memberships add column if not exists branch_id uuid references branches (id) on delete set null;

create index if not exists sales_branch_created_idx on sales (branch_id, created_at);
create index if not exists cash_registers_branch_idx on cash_registers (branch_id);

-- Transferencias entre sucursales.
alter table stock_movements drop constraint if exists stock_movements_type_check;
alter table stock_movements add constraint stock_movements_type_check
  check (type in ('venta', 'compra', 'ajuste', 'apertura', 'transferencia'));

-- ---------------------------------------------------------------------------
-- Ayudantes
-- ---------------------------------------------------------------------------

-- Sucursal principal del negocio; si todavía no tiene, la crea.
create or replace function public.main_branch_id(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from branches where org_id = p_org_id and is_main;
  if v_id is null then
    insert into branches (org_id, name, is_main)
    values (p_org_id, 'Principal', true)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from branches where org_id = p_org_id and is_main;
    end if;
  end if;
  return v_id;
end;
$$;

-- Fija la sucursal a la que van los cambios de stock de esta transacción.
create or replace function public.set_stock_branch(p_branch_id uuid)
returns void
language sql
as $$
  select set_config('pesito.stock_branch', coalesce(p_branch_id::text, ''), true);
$$;

create or replace function public.stock_branch_for(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting text := nullif(current_setting('pesito.stock_branch', true), '');
  v_id uuid;
begin
  if v_setting is not null then
    select id into v_id from branches where id = v_setting::uuid and org_id = p_org_id;
  end if;
  return coalesce(v_id, public.main_branch_id(p_org_id));
end;
$$;

-- El negocio tiene funciones Pro (plan pago Pro/IA o prueba vigente).
create or replace function public.org_has_pro_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.plan in ('pro', 'ia')
      or (s.plan = 'gratis' and s.pro_trial_ends_at is not null and s.pro_trial_ends_at > now())
    from organization_subscriptions s
    where s.org_id = p_org_id
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- products.stock = suma de branch_stock
-- ---------------------------------------------------------------------------

-- Cambio en branch_stock -> recalcular el total del producto.
create or replace function public.branch_stock_sync_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  if current_setting('pesito.stock_sync', true) = 'on' then
    return null;
  end if;
  perform set_config('pesito.stock_sync', 'on', true);
  update products
    set stock = coalesce((select sum(stock) from branch_stock where product_id = v_product), 0)
    where id = v_product;
  perform set_config('pesito.stock_sync', 'off', true);
  return null;
end;
$$;

drop trigger if exists branch_stock_sync_total on branch_stock;
create trigger branch_stock_sync_total
  after insert or update or delete on branch_stock
  for each row execute function public.branch_stock_sync_total();

-- Cambio directo a products.stock (código viejo, alta con stock inicial,
-- funciones de venta/compra) -> aplicarlo a la sucursal de contexto.
create or replace function public.products_stock_to_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric;
  v_branch uuid;
begin
  if current_setting('pesito.stock_sync', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_delta := new.stock;
  else
    v_delta := new.stock - old.stock;
  end if;

  if v_delta = 0 then
    return null;
  end if;

  v_branch := public.stock_branch_for(new.org_id);

  perform set_config('pesito.stock_sync', 'on', true);
  -- Primero update: un insert ... on conflict valida el check (stock >= 0)
  -- con la fila nueva (el delta solo) antes de ver que ya existe.
  update branch_stock set stock = stock + v_delta
    where branch_id = v_branch and product_id = new.id;
  if not found then
    insert into branch_stock (branch_id, product_id, org_id, stock)
    values (v_branch, new.id, new.org_id, v_delta);
  end if;
  perform set_config('pesito.stock_sync', 'off', true);

  return null;
exception
  when check_violation then
    perform set_config('pesito.stock_sync', 'off', true);
    raise exception 'stock insuficiente para % en esta sucursal', new.name;
end;
$$;

drop trigger if exists products_stock_to_branch on products;
create trigger products_stock_to_branch
  after insert or update of stock on products
  for each row execute function public.products_stock_to_branch();

-- ---------------------------------------------------------------------------
-- Sucursal por defecto en cajas, ventas, compras y movimientos
-- ---------------------------------------------------------------------------

create or replace function public.cash_registers_set_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    select m.branch_id into new.branch_id
      from memberships m
      where m.org_id = new.org_id and m.user_id = new.user_id;
  end if;
  if new.branch_id is null then
    new.branch_id := public.main_branch_id(new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists cash_registers_set_branch on cash_registers;
create trigger cash_registers_set_branch
  before insert on cash_registers
  for each row execute function public.cash_registers_set_branch();

create or replace function public.row_set_branch_from_register()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null and new.cash_register_id is not null then
    select branch_id into new.branch_id from cash_registers where id = new.cash_register_id;
  end if;
  if new.branch_id is null then
    new.branch_id := public.stock_branch_for(new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sales_set_branch on sales;
create trigger sales_set_branch
  before insert on sales
  for each row execute function public.row_set_branch_from_register();

drop trigger if exists purchases_set_branch on purchases;
create trigger purchases_set_branch
  before insert on purchases
  for each row execute function public.row_set_branch_from_register();

create or replace function public.stock_movements_set_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := public.stock_branch_for(new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists stock_movements_set_branch on stock_movements;
create trigger stock_movements_set_branch
  before insert on stock_movements
  for each row execute function public.stock_movements_set_branch();

-- ---------------------------------------------------------------------------
-- Datos existentes: todo a la sucursal principal
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.main_branch_id(id) from organizations;
end;
$$;

insert into branch_stock (branch_id, product_id, org_id, stock)
select b.id, p.id, p.org_id, p.stock
from products p
join branches b on b.org_id = p.org_id and b.is_main
where p.stock > 0
on conflict (branch_id, product_id) do nothing;

update cash_registers r set branch_id = b.id
  from branches b where b.org_id = r.org_id and b.is_main and r.branch_id is null;
update sales s set branch_id = coalesce(
    (select r.branch_id from cash_registers r where r.id = s.cash_register_id),
    (select b.id from branches b where b.org_id = s.org_id and b.is_main))
  where s.branch_id is null;
update purchases p set branch_id = coalesce(
    (select r.branch_id from cash_registers r where r.id = p.cash_register_id),
    (select b.id from branches b where b.org_id = p.org_id and b.is_main))
  where p.branch_id is null;
update stock_movements m set branch_id = b.id
  from branches b where b.org_id = m.org_id and b.is_main and m.branch_id is null;

-- ---------------------------------------------------------------------------
-- Venta, compra y anulaciones con sucursal
-- ---------------------------------------------------------------------------

create or replace function public.checkout_sale(p_org_id uuid, p_cash_register_id uuid, p_customer_id uuid, p_payment_method text, p_discount numeric, p_items jsonb, p_surcharge numeric DEFAULT 0, p_invoice_type text DEFAULT 'consumidor_final'::text, p_payments jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_branch_id uuid;
  v_branch_stock numeric;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'el carrito está vacío';
  end if;

  -- Sucursales (0043): la venta descuenta stock de la sucursal de la caja.
  select branch_id into v_branch_id
    from cash_registers where id = p_cash_register_id and org_id = p_org_id;
  v_branch_id := coalesce(v_branch_id, public.main_branch_id(p_org_id));
  perform public.set_stock_branch(v_branch_id);

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

    select stock into v_branch_stock from branch_stock
      where branch_id = v_branch_id and product_id = v_product.id
      for update;

    if coalesce(v_branch_stock, 0) < v_quantity then
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
$function$;

drop function if exists public.register_purchase(uuid, uuid, jsonb, text, uuid, jsonb);

create or replace function public.register_purchase(p_org_id uuid, p_supplier_id uuid, p_items jsonb, p_notes text DEFAULT NULL::text, p_cash_register_id uuid DEFAULT NULL::uuid, p_payments jsonb DEFAULT NULL::jsonb, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_branch_id uuid;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'la compra no tiene productos';
  end if;

  -- Sucursales (0043): la mercadería entra en la sucursal de la caja con la
  -- que se paga, o en la que se eligió, o en la principal.
  if p_cash_register_id is not null then
    select branch_id into v_branch_id
      from cash_registers where id = p_cash_register_id and org_id = p_org_id;
  end if;
  if v_branch_id is null and p_branch_id is not null then
    select id into v_branch_id from branches where id = p_branch_id and org_id = p_org_id;
  end if;
  v_branch_id := coalesce(v_branch_id, public.main_branch_id(p_org_id));
  perform public.set_stock_branch(v_branch_id);

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
$function$;

create or replace function public.void_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Sucursales (0043): el stock vuelve a la sucursal donde se vendió.
  perform public.set_stock_branch(coalesce(v_sale.branch_id, public.main_branch_id(v_sale.org_id)));

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
$function$;

create or replace function public.void_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_purchase purchases%rowtype;
  v_item record;
  v_product products%rowtype;
  v_branch_id uuid;
  v_branch_stock numeric;
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

  -- Sucursales (0043): se descuenta de la sucursal donde entró la compra.
  v_branch_id := coalesce(v_purchase.branch_id, public.main_branch_id(v_purchase.org_id));
  perform public.set_stock_branch(v_branch_id);

  for v_item in select * from purchase_items where purchase_id = p_purchase_id loop
    select * into v_product from products where id = v_item.product_id for update;

    if v_product.id is not null then
      select stock into v_branch_stock from branch_stock
        where branch_id = v_branch_id and product_id = v_product.id
        for update;

      if coalesce(v_branch_stock, 0) < v_item.quantity then
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
$function$;

-- ---------------------------------------------------------------------------
-- Gestión de sucursales
-- ---------------------------------------------------------------------------

create or replace function public.create_branch(p_org_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para crear sucursales';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'ponele un nombre a la sucursal';
  end if;

  perform public.main_branch_id(p_org_id);

  if not public.org_has_pro_access(p_org_id) then
    raise exception 'para sumar otra sucursal necesitás el plan Pro';
  end if;

  if exists (select 1 from branches where org_id = p_org_id and lower(name) = lower(trim(p_name))) then
    raise exception 'ya hay una sucursal con ese nombre';
  end if;

  insert into branches (org_id, name) values (p_org_id, trim(p_name)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_member_branch(p_membership_id uuid, p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from memberships where id = p_membership_id;

  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'no tenés permiso para cambiar la sucursal de este usuario';
  end if;

  if p_branch_id is not null
     and not exists (select 1 from branches where id = p_branch_id and org_id = v_org_id) then
    raise exception 'sucursal no encontrada';
  end if;

  update memberships set branch_id = p_branch_id where id = p_membership_id;
end;
$$;

-- Ajuste manual de stock en una sucursal (también el stock inicial de un
-- producto nuevo).
create or replace function public.adjust_branch_stock(
  p_branch_id uuid,
  p_product_id uuid,
  p_delta numeric,
  p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_stock numeric;
begin
  select org_id into v_org_id from branches where id = p_branch_id;

  if v_org_id is null or not public.is_org_member(v_org_id) then
    raise exception 'sucursal no encontrada';
  end if;

  if not exists (select 1 from products where id = p_product_id and org_id = v_org_id) then
    raise exception 'producto no encontrado';
  end if;

  if coalesce(p_delta, 0) = 0 then
    raise exception 'ingresá una cantidad distinta de cero';
  end if;

  select stock into v_stock from branch_stock
    where branch_id = p_branch_id and product_id = p_product_id
    for update;

  if coalesce(v_stock, 0) + p_delta < 0 then
    raise exception 'el ajuste dejaría el stock en negativo';
  end if;

  perform public.set_stock_branch(p_branch_id);
  update products set stock = stock + p_delta where id = p_product_id;

  insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
  values (v_org_id, p_product_id, 'ajuste', p_delta, nullif(trim(coalesce(p_reason, '')), ''), auth.uid(), p_branch_id);

  perform public.set_stock_branch(null);
  return coalesce(v_stock, 0) + p_delta;
end;
$$;

-- Pasar mercadería de una sucursal a otra. p_items: [{product_id, quantity}].
create or replace function public.transfer_stock(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_items jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_stock numeric;
  v_from_name text;
  v_to_name text;
begin
  select org_id, name into v_org_id, v_from_name from branches where id = p_from_branch_id;
  select name into v_to_name from branches where id = p_to_branch_id and org_id = v_org_id;

  if v_org_id is null or v_to_name is null then
    raise exception 'sucursal no encontrada';
  end if;

  if not public.is_org_admin(v_org_id) then
    raise exception 'no tenés permiso para transferir stock';
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'elegí dos sucursales distintas';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'la transferencia no tiene productos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'la cantidad tiene que ser mayor a cero';
    end if;

    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and org_id = v_org_id
      for update;
    if v_product.id is null then
      raise exception 'producto no encontrado';
    end if;

    select stock into v_stock from branch_stock
      where branch_id = p_from_branch_id and product_id = v_product.id
      for update;
    if coalesce(v_stock, 0) < v_quantity then
      raise exception 'no hay stock suficiente de % en %', v_product.name, v_from_name;
    end if;

    perform public.set_stock_branch(p_from_branch_id);
    update products set stock = stock - v_quantity where id = v_product.id;
    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
    values (v_org_id, v_product.id, 'transferencia', -v_quantity,
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'A ' || v_to_name), auth.uid(), p_from_branch_id);

    perform public.set_stock_branch(p_to_branch_id);
    update products set stock = stock + v_quantity where id = v_product.id;
    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
    values (v_org_id, v_product.id, 'transferencia', v_quantity,
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Desde ' || v_from_name), auth.uid(), p_to_branch_id);
  end loop;

  perform public.set_stock_branch(null);
end;
$$;

-- ---------------------------------------------------------------------------
-- "En vivo" con sucursales (reemplaza la de 0042): suma la lista de
-- sucursales con sus totales de hoy, y la sucursal de cada persona, caja y
-- venta.
-- ---------------------------------------------------------------------------

create or replace function public.live_overview(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_today timestamptz;
  v_yesterday timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
  v_main uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;

  v_main := public.main_branch_id(p_org_id);
  v_today := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;
  v_yesterday := v_today - interval '1 day';

  with today_sales as (
    select s.id, s.user_id, s.total, s.payment_method, s.created_at, s.cash_register_id, s.branch_id
    from sales s
    where s.org_id = p_org_id
      and s.status = 'completada'
      and s.created_at >= v_today
  ),
  registers as (
    -- Cajas abiertas (aunque se hayan abierto otro día) y las cerradas hoy.
    select r.id, r.user_id, r.branch_id, r.status, r.opened_at, r.closed_at,
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
      coalesce(
        (select r.branch_id from registers r
          where r.user_id = m.user_id and r.status = 'abierta'
          order by r.opened_at desc limit 1),
        m.branch_id,
        v_main
      ) as branch_id,
      coalesce(m.username, m.email) as label,
      m.role,
      coalesce(st.sales_count, 0) as sales_count,
      coalesce(st.sales_total, 0) as sales_total,
      st.last_sale_at,
      (
        select jsonb_build_object(
          'id', r.id,
          'branch_id', r.branch_id,
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
      ) as closed_today,
      (
        select jsonb_object_agg(x.branch_id, jsonb_build_object(
          'count', x.sales_count, 'total', x.sales_total, 'last_sale_at', x.last_sale_at))
        from (
          select ts.branch_id, count(*) as sales_count, sum(ts.total) as sales_total,
            max(ts.created_at) as last_sale_at
          from today_sales ts
          where ts.user_id = m.user_id and ts.branch_id is not null
          group by ts.branch_id
        ) x
      ) as by_branch
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
    select ts.id, ts.user_id, ts.branch_id, ts.total, ts.payment_method, ts.created_at,
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
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'is_main', b.is_main,
        'count', (select count(*) from today_sales ts where ts.branch_id = b.id),
        'total', coalesce((select sum(ts.total) from today_sales ts where ts.branch_id = b.id), 0),
        'yesterday_total', coalesce((
          select sum(s.total) from sales s
          where s.org_id = p_org_id and s.branch_id = b.id and s.status = 'completada'
            and s.created_at >= v_yesterday and s.created_at < v_now - interval '1 day'
        ), 0),
        'open_registers', (select count(*) from registers r where r.branch_id = b.id and r.status = 'abierta'),
        'by_hour', (
          select jsonb_agg(coalesce(h.total, 0) order by g.hour)
          from generate_series(0, 23) as g(hour)
          left join (
            select extract(hour from ts.created_at at time zone v_tz)::int as hour, sum(ts.total) as total
            from today_sales ts
            where ts.branch_id = b.id
            group by 1
          ) h on h.hour = g.hour
        )
      ) order by b.is_main desc, b.name)
      from branches b
      where b.org_id = p_org_id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pu.user_id,
        'branch_id', pu.branch_id,
        'label', pu.label,
        'role', pu.role,
        'sales_count', pu.sales_count,
        'sales_total', pu.sales_total,
        'last_sale_at', pu.last_sale_at,
        'open_register', pu.open_register,
        'closed_today', coalesce(pu.closed_today, '[]'::jsonb),
        'by_branch', coalesce(pu.by_branch, '{}'::jsonb)
      ) order by (pu.open_register is null), pu.sales_total desc)
      from per_user pu
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'branch_id', r.branch_id,
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
