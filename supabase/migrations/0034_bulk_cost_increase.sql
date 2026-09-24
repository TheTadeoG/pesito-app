-- Pesito: aumento masivo de costo (igual que el de precio en 0031), y se
-- suma la opción de agrupar por marca además de por proveedor para los
-- dos. La marca vive como texto en products.brand (no hay products.brand_id
-- — brands es sólo un catálogo de nombres para el autocompletar), así que
-- se agrupa por nombre. Los productos sin costo cargado (null) no se
-- tocan: no hay "0 + aumento" que tenga sentido ahí.
-- Corre sobre una base que ya tiene 0001..0033 aplicadas.

create table if not exists product_cost_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  old_cost numeric(12, 2) not null,
  new_cost numeric(12, 2) not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_cost_history_product_idx
  on product_cost_history (product_id, created_at desc);

alter table product_cost_history enable row level security;

create policy "members can view cost history"
  on product_cost_history for select
  using (public.is_org_member(org_id));

create policy "members can log their own org cost history"
  on product_cost_history for insert
  with check (public.is_org_member(org_id));

create or replace function public.log_product_cost_change()
returns trigger
language plpgsql
as $$
begin
  if new.cost is distinct from old.cost and old.cost is not null and new.cost is not null then
    insert into product_cost_history (org_id, product_id, old_cost, new_cost, changed_by)
    values (new.org_id, new.id, old.cost, new.cost, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists products_log_cost_change on products;
create trigger products_log_cost_change
  after update on products
  for each row execute function public.log_product_cost_change();

-- Aumento masivo de precio o costo, agrupando por proveedor por defecto
-- o por marca (uno de los dos, no ambos). Sucesora de
-- bulk_increase_price_by_supplier (0031): esa queda sin uso en el código
-- de la app pero no se borra por si algo externo la llegó a invocar.
create or replace function public.bulk_increase_field(
  p_org_id uuid,
  p_field text,
  p_supplier_id uuid default null,
  p_brand text default null,
  p_percent numeric default null,
  p_fixed_amount numeric default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_field not in ('price', 'cost') then
    raise exception 'campo inválido';
  end if;

  if p_supplier_id is null and (p_brand is null or trim(p_brand) = '') then
    raise exception 'elegí un proveedor o una marca';
  end if;

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el valor a 0 o menos';
  end if;

  if p_field = 'price' then
    update products
      set price = greatest(
        0,
        round(
          case
            when p_percent is not null then price * (1 + p_percent / 100)
            else price + p_fixed_amount
          end,
          2
        )
      )
      where org_id = p_org_id
        and active = true
        and (p_supplier_id is null or default_supplier_id = p_supplier_id)
        and (p_brand is null or trim(p_brand) = '' or brand = p_brand);
  else
    update products
      set cost = greatest(
        0,
        round(
          case
            when p_percent is not null then cost * (1 + p_percent / 100)
            else cost + p_fixed_amount
          end,
          2
        )
      )
      where org_id = p_org_id
        and active = true
        and cost is not null
        and (p_supplier_id is null or default_supplier_id = p_supplier_id)
        and (p_brand is null or trim(p_brand) = '' or brand = p_brand);
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
