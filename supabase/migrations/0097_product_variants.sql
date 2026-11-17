-- Talles y colores (Plan Esencial): un producto con variantes. Cada variante es una fila de `products` con su propio SKU,
-- código, stock, costo y precio (así el stock por sucursal, los ajustes, los inventarios, las ventas y las compras
-- funcionan por variante sin cambios), agrupadas bajo un mismo "grupo". El nombre de cada variante ya lleva el talle y el
-- color ("Remera básica · M · Azul"), así se distinguen en el POS, los tickets y las planillas.
--
-- Para el límite de productos del plan, un grupo cuenta como UN producto, sin importar cuántas variantes tenga.

create table if not exists public.product_variant_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists product_variant_groups_org_idx on public.product_variant_groups (org_id);

alter table public.products add column if not exists variant_group_id uuid references public.product_variant_groups (id) on delete set null;
alter table public.products add column if not exists variant_size text check (variant_size is null or char_length(variant_size) <= 40);
alter table public.products add column if not exists variant_color text check (variant_color is null or char_length(variant_color) <= 40);
create index if not exists products_variant_group_idx on public.products (variant_group_id) where variant_group_id is not null;

alter table public.product_variant_groups enable row level security;
drop policy if exists "members can read variant groups" on public.product_variant_groups;
create policy "members can read variant groups" on public.product_variant_groups
  for select using (public.is_org_member(org_id));
-- Crear un grupo exige un plan que incluya variantes (Esencial o más; la prueba Pro cuenta).
drop policy if exists "members can create variant groups" on public.product_variant_groups;
create policy "members can create variant groups" on public.product_variant_groups
  for insert with check (public.is_org_member(org_id) and public.plan_rank(public.org_effective_plan(org_id)) >= 1);
drop policy if exists "members can update variant groups" on public.product_variant_groups;
create policy "members can update variant groups" on public.product_variant_groups
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "members can delete variant groups" on public.product_variant_groups;
create policy "members can delete variant groups" on public.product_variant_groups
  for delete using (public.is_org_member(org_id));

-- Productos activos que cuentan para el plan: los sueltos más un lugar por cada grupo de variantes.
create or replace function public.org_product_usage(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from products where org_id = p_org_id and active and variant_group_id is null)::integer
       + (select count(distinct variant_group_id) from products where org_id = p_org_id and active and variant_group_id is not null)::integer
$$;
revoke all on function public.org_product_usage(uuid) from public, anon;
grant execute on function public.org_product_usage(uuid) to authenticated;

-- Misma función y firma que en 0049: ahora una variante de un grupo que ya cuenta no ocupa otro lugar.
create or replace function public.guard_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  -- Sólo usuarios del sistema (no la service role de soporte/migraciones).
  if auth.uid() is null or not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active then
    return new;
  end if;
  if new.variant_group_id is not null and exists (
    select 1 from products where org_id = new.org_id and variant_group_id = new.variant_group_id and active and id <> new.id
  ) then
    return new;
  end if;
  v_limit := public.plan_limit(new.org_id, 'products');
  v_used := public.org_product_usage(new.org_id);
  if v_used >= v_limit then
    raise exception 'Tu plan incluye hasta % productos activos', replace(to_char(v_limit, 'FM999,999'), ',', '.');
  end if;
  return new;
end;
$$;
