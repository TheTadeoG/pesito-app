-- Inventario físico (Plan Pro): se cuenta el stock real de una sucursal, de a poco y guardando lo contado, y recién al
-- "aplicar" se ajustan las diferencias de una vez (un movimiento de stock tipo 'ajuste' por producto).
--
-- Cada producto contado guarda cuánto decía el sistema en ese momento (expected). La diferencia (counted - expected) es lo
-- que se aplica, sumada al stock de ese momento: así las ventas que entran mientras se cuenta no se pisan.
-- Los productos que no se contaron no se tocan. Nada se escribe directo: todo pasa por las funciones de abajo.

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Qué se cuenta: todo, una marca o un proveedor.
  scope_brand text,
  scope_supplier_id uuid references public.suppliers (id) on delete set null,
  status text not null default 'abierto' check (status in ('abierto', 'aplicado', 'cancelado')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  adjusted_count integer,
  units_plus numeric,
  units_minus numeric
);
create index if not exists inventory_counts_org_idx on public.inventory_counts (org_id, created_at desc);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.inventory_counts (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  counted numeric not null check (counted >= 0),
  expected numeric not null,
  counted_by uuid references auth.users (id) on delete set null,
  counted_at timestamptz not null default now(),
  unique (count_id, product_id)
);
create index if not exists inventory_count_items_count_idx on public.inventory_count_items (count_id);

alter table public.inventory_counts enable row level security;
alter table public.inventory_count_items enable row level security;
revoke all on public.inventory_counts from anon, authenticated;
revoke all on public.inventory_count_items from anon, authenticated;
grant select on public.inventory_counts to authenticated;
grant select on public.inventory_count_items to authenticated;

drop policy if exists inventory_counts_select on public.inventory_counts;
create policy inventory_counts_select on public.inventory_counts
  for select to authenticated using (public.is_org_admin(org_id));
drop policy if exists inventory_count_items_select on public.inventory_count_items;
create policy inventory_count_items_select on public.inventory_count_items
  for select to authenticated using (public.is_org_admin(org_id));

-- Empezar un conteo. Sólo dueño o administrador, con Plan Pro.
create or replace function public.inventory_start(
  p_org_id uuid,
  p_branch_id uuid,
  p_name text,
  p_brand text default null,
  p_supplier_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := left(btrim(coalesce(p_name, '')), 80);
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Sólo el dueño o un administrador puede hacer un inventario.';
  end if;
  perform public.require_plan(p_org_id, 'pro', 'hacer inventarios físicos');
  if not exists (select 1 from branches where id = p_branch_id and org_id = p_org_id) then
    raise exception 'Sucursal no encontrada.';
  end if;
  if v_name = '' then
    raise exception 'Poné un nombre al inventario.';
  end if;
  if exists (select 1 from inventory_counts where org_id = p_org_id and branch_id = p_branch_id and status = 'abierto') then
    raise exception 'Ya hay un inventario abierto en esta sucursal. Aplicalo o cancelalo primero.';
  end if;

  insert into inventory_counts (org_id, branch_id, name, scope_brand, scope_supplier_id, created_by)
  values (p_org_id, p_branch_id, v_name, nullif(btrim(coalesce(p_brand, '')), ''), p_supplier_id, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Anotar lo contado de un producto (o quitarlo con p_counted = null). Guarda cuánto decía el sistema en ese momento.
create or replace function public.inventory_set_count(p_count_id uuid, p_product_id uuid, p_counted numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count inventory_counts%rowtype;
  v_expected numeric;
begin
  select * into v_count from inventory_counts where id = p_count_id;
  if not found or not public.is_org_admin(v_count.org_id) then
    raise exception 'Inventario no encontrado.';
  end if;
  perform public.require_plan(v_count.org_id, 'pro', 'hacer inventarios físicos');
  if v_count.status <> 'abierto' then
    raise exception 'Este inventario ya está cerrado.';
  end if;
  if not exists (select 1 from products where id = p_product_id and org_id = v_count.org_id) then
    raise exception 'Producto no encontrado.';
  end if;

  if p_counted is null then
    delete from inventory_count_items where count_id = p_count_id and product_id = p_product_id;
    return null;
  end if;
  if p_counted < 0 then
    raise exception 'La cantidad no puede ser negativa.';
  end if;

  select coalesce((select stock from branch_stock where branch_id = v_count.branch_id and product_id = p_product_id), 0)
    into v_expected;

  insert into inventory_count_items (count_id, org_id, product_id, counted, expected, counted_by)
  values (p_count_id, v_count.org_id, p_product_id, p_counted, v_expected, auth.uid())
  on conflict (count_id, product_id)
  do update set counted = excluded.counted, expected = excluded.expected, counted_by = excluded.counted_by, counted_at = now();
  return v_expected;
end;
$$;

-- Aplicar: ajusta el stock de la sucursal con las diferencias de lo contado. Devuelve cuántos productos cambiaron.
create or replace function public.inventory_apply(p_count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count inventory_counts%rowtype;
  v_item record;
  v_stock numeric;
  v_delta numeric;
  v_adjusted integer := 0;
  v_plus numeric := 0;
  v_minus numeric := 0;
begin
  select * into v_count from inventory_counts where id = p_count_id for update;
  if not found or not public.is_org_admin(v_count.org_id) then
    raise exception 'Inventario no encontrado.';
  end if;
  perform public.require_plan(v_count.org_id, 'pro', 'hacer inventarios físicos');
  if v_count.status <> 'abierto' then
    raise exception 'Este inventario ya está cerrado.';
  end if;

  for v_item in
    select * from inventory_count_items where count_id = p_count_id and counted <> expected order by product_id
  loop
    v_delta := v_item.counted - v_item.expected;
    select stock into v_stock from branch_stock where branch_id = v_count.branch_id and product_id = v_item.product_id for update;
    v_stock := coalesce(v_stock, 0);
    -- Si desde que se contó se vendió más de lo que sobraba, el stock queda en 0 (no negativo).
    if v_stock + v_delta < 0 then
      v_delta := -v_stock;
    end if;
    if v_delta = 0 then
      continue;
    end if;

    perform public.set_stock_branch(v_count.branch_id);
    update products set stock = stock + v_delta where id = v_item.product_id;
    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
    values (v_count.org_id, v_item.product_id, 'ajuste', v_delta, left('Inventario: ' || v_count.name, 200), auth.uid(), v_count.branch_id);
    perform public.set_stock_branch(null);

    v_adjusted := v_adjusted + 1;
    if v_delta > 0 then v_plus := v_plus + v_delta; else v_minus := v_minus + (-v_delta); end if;
  end loop;

  update inventory_counts
    set status = 'aplicado', applied_by = auth.uid(), applied_at = now(),
        adjusted_count = v_adjusted, units_plus = v_plus, units_minus = v_minus
    where id = p_count_id;

  return jsonb_build_object('adjusted', v_adjusted, 'units_plus', v_plus, 'units_minus', v_minus);
end;
$$;

-- Cancelar: se descarta lo contado, sin tocar el stock.
create or replace function public.inventory_cancel(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count inventory_counts%rowtype;
begin
  select * into v_count from inventory_counts where id = p_count_id for update;
  if not found or not public.is_org_admin(v_count.org_id) then
    raise exception 'Inventario no encontrado.';
  end if;
  if v_count.status <> 'abierto' then
    raise exception 'Este inventario ya está cerrado.';
  end if;
  update inventory_counts set status = 'cancelado' where id = p_count_id;
  delete from inventory_count_items where count_id = p_count_id;
end;
$$;

revoke all on function public.inventory_start(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.inventory_set_count(uuid, uuid, numeric) from public, anon;
revoke all on function public.inventory_apply(uuid) from public, anon;
revoke all on function public.inventory_cancel(uuid) from public, anon;
grant execute on function public.inventory_start(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.inventory_set_count(uuid, uuid, numeric) to authenticated;
grant execute on function public.inventory_apply(uuid) to authenticated;
grant execute on function public.inventory_cancel(uuid) to authenticated;
