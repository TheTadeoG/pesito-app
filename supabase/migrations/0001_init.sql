-- Pesito: schema inicial (organizaciones/kioscos, catálogo, ventas, caja)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  business_type text not null default 'kiosco',
  currency text not null default 'ARS',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'vendedor')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  name text not null,
  barcode text,
  sku text,
  price numeric(12, 2) not null default 0,
  cost numeric(12, 2),
  stock numeric(12, 2) not null default 0,
  min_stock numeric(12, 2) not null default 0,
  unit text not null default 'u',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_org_id_idx on products (org_id);
create index if not exists products_org_barcode_idx on products (org_id, barcode);
create index if not exists products_org_name_idx on products (org_id, name);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  notes text,
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists customers_org_id_idx on customers (org_id);

create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  opening_amount numeric(12, 2) not null default 0,
  closing_amount numeric(12, 2),
  expected_amount numeric(12, 2),
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);

create index if not exists cash_registers_org_id_idx on cash_registers (org_id);
create unique index if not exists cash_registers_one_open_per_user
  on cash_registers (org_id, user_id)
  where status = 'abierta';

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  cash_register_id uuid not null references cash_registers (id) on delete cascade,
  type text not null check (type in ('ingreso', 'retiro')),
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_register_id_idx on cash_movements (cash_register_id);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  cash_register_id uuid references cash_registers (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  user_id uuid not null references auth.users (id),
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  payment_method text not null default 'efectivo'
    check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'mixto', 'fiado')),
  status text not null default 'completada' check (status in ('completada', 'anulada')),
  created_at timestamptz not null default now()
);

create index if not exists sales_org_id_idx on sales (org_id, created_at desc);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  product_name text not null,
  quantity numeric(12, 2) not null,
  unit_price numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create index if not exists sale_items_sale_id_idx on sale_items (sale_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  type text not null check (type in ('venta', 'compra', 'ajuste', 'apertura')),
  quantity numeric(12, 2) not null,
  reference text,
  user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_org_id_idx on stock_movements (org_id, created_at desc);
create index if not exists stock_movements_product_id_idx on stock_movements (product_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_business_type text default 'kiosco'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into organizations (name, slug, business_type)
  values (p_name, p_slug, coalesce(nullif(p_business_type, ''), 'kiosco'))
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role) values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;

create or replace function public.checkout_sale(
  p_org_id uuid,
  p_cash_register_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_discount numeric,
  p_items jsonb
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

  insert into sales (org_id, cash_register_id, customer_id, user_id, subtotal, discount, total, payment_method)
  values (
    p_org_id,
    p_cash_register_id,
    p_customer_id,
    auth.uid(),
    v_subtotal,
    coalesce(p_discount, 0),
    v_subtotal - coalesce(p_discount, 0),
    p_payment_method
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;

    -- Una línea sin product_id es un "monto libre" (cargo manual sin stock asociado).
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

  return v_sale_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table cash_registers enable row level security;
alter table cash_movements enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_movements enable row level security;

create policy "members can view their organization"
  on organizations for select
  using (public.is_org_member(id));

create policy "members can view memberships in their org"
  on memberships for select
  using (public.is_org_member(org_id));

create policy "members can manage categories"
  on categories for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can manage products"
  on products for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can manage customers"
  on customers for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can manage cash registers"
  on cash_registers for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can manage cash movements"
  on cash_movements for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members can view sales"
  on sales for select
  using (public.is_org_member(org_id));

create policy "members can insert sales"
  on sales for insert
  with check (public.is_org_member(org_id));

create policy "members can view sale items"
  on sale_items for select
  using (public.is_org_member((select org_id from sales where sales.id = sale_id)));

create policy "members can view stock movements"
  on stock_movements for select
  using (public.is_org_member(org_id));

create policy "members can insert stock movements"
  on stock_movements for insert
  with check (public.is_org_member(org_id));
