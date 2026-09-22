-- Pesito: compras a proveedores (ingreso de mercadería con actualización de stock/costo).
-- Corre sobre una base que ya tiene 0001_init.sql, 0002_sales_extras.sql y 0003_invoice_type.sql aplicadas.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  user_id uuid not null,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  quantity numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;

create policy "members can manage suppliers"
  on suppliers for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can view purchases"
  on purchases for select
  using (public.is_org_member(org_id));

create policy "members can insert purchases"
  on purchases for insert
  with check (public.is_org_member(org_id));

create policy "members can view purchase items"
  on purchase_items for select
  using (public.is_org_member((select org_id from purchases where purchases.id = purchase_id)));

create or replace function public.register_purchase(
  p_org_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_notes text default null
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
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'la compra no tiene productos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_cost')::numeric;
  end loop;

  insert into purchases (org_id, supplier_id, user_id, subtotal, total, notes)
  values (p_org_id, p_supplier_id, auth.uid(), v_subtotal, v_subtotal, nullif(p_notes, ''))
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

  return v_purchase_id;
end;
$$;
