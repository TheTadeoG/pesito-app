-- Pesito 0053: pedidos en camino (recomendación de compra, etapa 2).
--
-- Al tocar "Ya lo pedí" en Recomendaciones se guarda el pedido hecho a un
-- proveedor (qué productos y cuánto). Mientras está pendiente, la
-- recomendación descuenta lo que viene en camino y no lo vuelve a sugerir.
-- Se cierra solo cuando se registra una compra a ese proveedor (la app va
-- descontando lo recibido de cada producto), o a mano (recibido / cancelado).
--
-- No toca dinero ni stock: es sólo el seguimiento del pedido. El stock entra
-- como siempre, con la compra (register_purchase).
-- Sin 0053 aplicada, la recomendación anda como antes y "Ya lo pedí" da error.
-- Corre sobre una base que ya tiene 0001..0052 aplicadas.

create table if not exists public.restock_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'recibido', 'cancelado')),
  -- Cuándo se espera que llegue (fecha del pedido + plazo del proveedor).
  expected_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists restock_orders_org_status_idx
  on public.restock_orders (org_id, status, created_at desc);

create table if not exists public.restock_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.restock_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  product_name text not null,
  -- En la unidad del producto (ya redondeada al bulto).
  quantity numeric(12, 3) not null check (quantity > 0),
  received_quantity numeric(12, 3) not null default 0 check (received_quantity >= 0)
);

create index if not exists restock_order_items_order_idx
  on public.restock_order_items (order_id);
create index if not exists restock_order_items_product_idx
  on public.restock_order_items (product_id);

alter table public.restock_orders enable row level security;
alter table public.restock_order_items enable row level security;

drop policy if exists "members manage restock orders" on public.restock_orders;
create policy "members manage restock orders"
  on public.restock_orders for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "members manage restock order items" on public.restock_order_items;
create policy "members manage restock order items"
  on public.restock_order_items for all
  using (
    exists (
      select 1 from public.restock_orders o
      where o.id = restock_order_items.order_id and public.is_org_member(o.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.restock_orders o
      where o.id = restock_order_items.order_id and public.is_org_member(o.org_id)
    )
  );
