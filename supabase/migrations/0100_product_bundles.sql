-- Combos y kits: un producto armado con otros productos.
--
-- * El combo no tiene stock propio: vender uno descuenta cada componente (y anular la venta lo devuelve). Cuántos se pueden
--   armar se calcula con el stock de los componentes.
-- * Precio: fijo (lo pone el negocio) o la suma de los componentes menos un descuento %, que se recalcula solo cuando cambia
--   el precio de un componente. El costo del combo es siempre la suma de los costos de sus componentes (la ganancia sale bien).
-- * Un combo no puede contener otro combo.
-- * Plan Básico en adelante (require_plan con 'basico': desde 0081 los planes se llaman gratis/basico/pro/max).
-- * checkout_sale y void_sale se redefinen con la MISMA firma que en 0043 (si no, quedaría un overload aparte; ver 0037).

alter table public.products
  add column if not exists is_bundle boolean not null default false,
  add column if not exists bundle_price_mode text not null default 'fixed' check (bundle_price_mode in ('fixed', 'discount')),
  add column if not exists bundle_discount_pct numeric(5, 2) not null default 0 check (bundle_discount_pct >= 0 and bundle_discount_pct < 100);

create table if not exists public.product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  bundle_id uuid not null references public.products (id) on delete cascade,
  component_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null check (quantity > 0 and quantity <= 100000),
  unique (bundle_id, component_id)
);
create index if not exists product_bundle_items_component_idx on public.product_bundle_items (component_id);
create index if not exists product_bundle_items_org_idx on public.product_bundle_items (org_id);

alter table public.product_bundle_items enable row level security;
drop policy if exists "members can view bundle items" on public.product_bundle_items;
create policy "members can view bundle items" on public.product_bundle_items for select using (public.is_org_member(org_id));
drop policy if exists "members can add bundle items" on public.product_bundle_items;
create policy "members can add bundle items" on public.product_bundle_items for insert with check (public.is_org_member(org_id));
drop policy if exists "members can edit bundle items" on public.product_bundle_items;
create policy "members can edit bundle items" on public.product_bundle_items for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "members can remove bundle items" on public.product_bundle_items;
create policy "members can remove bundle items" on public.product_bundle_items for delete using (public.is_org_member(org_id));

-- Lo que se descontó de cada componente en cada venta de un combo (para devolverlo igual si se anula, aunque el combo cambie).
create table if not exists public.sale_item_components (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null check (quantity > 0)
);
create index if not exists sale_item_components_item_idx on public.sale_item_components (sale_item_id);
alter table public.sale_item_components enable row level security;
drop policy if exists "members can view sale item components" on public.sale_item_components;
create policy "members can view sale item components" on public.sale_item_components for select using (public.is_org_member(org_id));
-- Sin policy de insert/update/delete: sólo las escribe checkout_sale (security definer).

-- Controles al armar un combo: plan, mismo negocio, sin combos adentro ni a sí mismo.
create or replace function public.guard_bundle_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle products%rowtype;
  v_comp products%rowtype;
begin
  perform public.require_plan(new.org_id, 'basico', 'armar combos y kits');
  select * into v_bundle from products where id = new.bundle_id;
  select * into v_comp from products where id = new.component_id;
  if v_bundle.id is null or v_comp.id is null or v_bundle.org_id <> new.org_id or v_comp.org_id <> new.org_id then
    raise exception 'producto no encontrado';
  end if;
  if not v_bundle.is_bundle then
    raise exception 'El producto no está marcado como combo';
  end if;
  if v_comp.is_bundle or new.bundle_id = new.component_id then
    raise exception 'Un combo no puede llevar otro combo adentro';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_bundle_item on public.product_bundle_items;
create trigger guard_bundle_item before insert or update on public.product_bundle_items
  for each row execute function public.guard_bundle_item();

-- Precio y costo del combo según sus componentes.
create or replace function public.recompute_bundle(p_bundle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b products%rowtype;
  v_sum_price numeric;
  v_sum_cost numeric;
begin
  select * into v_b from products where id = p_bundle_id and is_bundle;
  if v_b.id is null then return; end if;

  select coalesce(sum(p.price * bi.quantity), 0),
         coalesce(sum(coalesce(p.cost, 0) * bi.quantity), 0)
    into v_sum_price, v_sum_cost
  from product_bundle_items bi join products p on p.id = bi.component_id
  where bi.bundle_id = p_bundle_id;

  update products
  set cost = case when exists (select 1 from product_bundle_items where bundle_id = p_bundle_id) then v_sum_cost else cost end,
      price = case when v_b.bundle_price_mode = 'discount'
                   then round(v_sum_price * (1 - v_b.bundle_discount_pct / 100), 2)
                   else price end
  where id = p_bundle_id
    and (cost is distinct from case when exists (select 1 from product_bundle_items where bundle_id = p_bundle_id) then v_sum_cost else cost end
         or (v_b.bundle_price_mode = 'discount' and price is distinct from round(v_sum_price * (1 - v_b.bundle_discount_pct / 100), 2)));
end;
$$;

create or replace function public.bundle_items_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_bundle(coalesce(new.bundle_id, old.bundle_id));
  return null;
end;
$$;
drop trigger if exists bundle_items_changed on public.product_bundle_items;
create trigger bundle_items_changed after insert or update or delete on public.product_bundle_items
  for each row execute function public.bundle_items_changed();

create or replace function public.component_price_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in select bundle_id from product_bundle_items where component_id = new.id loop
    perform public.recompute_bundle(v_id);
  end loop;
  return null;
end;
$$;
drop trigger if exists component_price_changed on public.products;
create trigger component_price_changed after update of price, cost on public.products
  for each row when (old.price is distinct from new.price or old.cost is distinct from new.cost)
  execute function public.component_price_changed();

create or replace function public.bundle_mode_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_bundle(new.id);
  return null;
end;
$$;
drop trigger if exists bundle_mode_changed on public.products;
create trigger bundle_mode_changed after update of bundle_price_mode, bundle_discount_pct, is_bundle on public.products
  for each row when (new.is_bundle) execute function public.bundle_mode_changed();

-- Ayudantes internos: los llaman los triggers, no la app.
revoke all on function public.recompute_bundle(uuid) from public, anon, authenticated;
revoke all on function public.bundle_items_changed() from public, anon, authenticated;
revoke all on function public.component_price_changed() from public, anon, authenticated;
revoke all on function public.bundle_mode_changed() from public, anon, authenticated;
revoke all on function public.guard_bundle_item() from public, anon, authenticated;

-- Arreglo de 0098: el control de plan de los grupos de variantes usaba 'esencial', que desde 0081 ya no es un plan
-- (plan_rank daba 0 y el control no frenaba a nadie). Mismo trigger, con 'basico'.
create or replace function public.guard_variant_group_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_plan(new.org_id, 'basico', 'cargar productos con talles y colores');
  return new;
end;
$$;

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

    -- Combos y kits (0100): no tienen stock propio; vender uno descuenta cada componente.
    if v_product.is_bundle then
      declare
        v_comp record;
        v_need numeric;
        v_item_id uuid;
      begin
        if not exists (select 1 from product_bundle_items where bundle_id = v_product.id) then
          raise exception 'el combo % no tiene productos', v_product.name;
        end if;

        insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
        values (
          v_sale_id,
          v_product.id,
          v_product.name,
          v_quantity,
          (v_item ->> 'unit_price')::numeric,
          v_quantity * (v_item ->> 'unit_price')::numeric
        )
        returning id into v_item_id;

        for v_comp in
          select bi.component_id, bi.quantity as units, p.name as comp_name
          from product_bundle_items bi
          join products p on p.id = bi.component_id
          where bi.bundle_id = v_product.id
          order by bi.component_id
        loop
          v_need := v_comp.units * v_quantity;

          perform 1 from products where id = v_comp.component_id for update;

          select stock into v_branch_stock from branch_stock
            where branch_id = v_branch_id and product_id = v_comp.component_id
            for update;

          if coalesce(v_branch_stock, 0) < v_need then
            raise exception 'stock insuficiente de % para el combo %', v_comp.comp_name, v_product.name;
          end if;

          update products set stock = stock - v_need where id = v_comp.component_id;

          insert into sale_item_components (org_id, sale_item_id, product_id, quantity)
          values (p_org_id, v_item_id, v_comp.component_id, v_need);

          insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
          values (p_org_id, v_comp.component_id, 'venta', -1 * v_need, v_sale_id::text, auth.uid());
        end loop;
      end;
      continue;
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

  -- Combos y kits (0100): lo que se descontó de cada componente al vender vuelve al stock.
  for v_item in
    select c.product_id as comp_id, c.quantity as comp_qty
    from sale_item_components c
    join sale_items si on si.id = c.sale_item_id
    where si.sale_id = p_sale_id
  loop
    update products set stock = stock + v_item.comp_qty where id = v_item.comp_id;

    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
    values (
      v_sale.org_id,
      v_item.comp_id,
      'ajuste',
      v_item.comp_qty,
      'Anulación de venta ' || p_sale_id::text,
      auth.uid()
    );
  end loop;

  for v_item in select * from sale_items si where si.sale_id = p_sale_id
      and not exists (select 1 from sale_item_components c where c.sale_item_id = si.id) loop
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
