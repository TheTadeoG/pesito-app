-- Pesito: historial de precios de productos, para poder ver cuándo cambió
-- un precio y volver para atrás. En vez de loguearlo a mano en cada lugar
-- que actualiza products.price (la edición individual de hoy, y el
-- aumento masivo por proveedor que se agrega en esta misma migración),
-- un trigger en products lo registra automáticamente sin importar de
-- dónde vino el cambio.
-- Corre sobre una base que ya tiene 0001..0030 aplicadas.

create table if not exists product_price_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  old_price numeric(12, 2) not null,
  new_price numeric(12, 2) not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_price_history_product_idx
  on product_price_history (product_id, created_at desc);

alter table product_price_history enable row level security;

create policy "members can view price history"
  on product_price_history for select
  using (public.is_org_member(org_id));

-- Sin policy de insert "abierta": sólo el trigger de abajo escribe acá,
-- pero como el trigger no es security definer (corre con el mismo rol que
-- hizo el update de products), igual necesita esta policy para poder
-- insertar dentro de la propia organización.
create policy "members can log their own org price history"
  on product_price_history for insert
  with check (public.is_org_member(org_id));

create or replace function public.log_product_price_change()
returns trigger
language plpgsql
as $$
begin
  if new.price is distinct from old.price then
    insert into product_price_history (org_id, product_id, old_price, new_price, changed_by)
    values (new.org_id, new.id, old.price, new.price, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists products_log_price_change on products;
create trigger products_log_price_change
  after update on products
  for each row execute function public.log_product_price_change();

-- Aumento masivo de precios por proveedor por defecto del producto
-- (products.default_supplier_id, ver 0015). Un solo UPDATE por fila hace
-- que el trigger de arriba registre cada producto afectado en el
-- historial, con su propio precio anterior.
create or replace function public.bulk_increase_price_by_supplier(
  p_org_id uuid,
  p_supplier_id uuid,
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

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el precio a 0 o menos';
  end if;

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
      and default_supplier_id = p_supplier_id
      and active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
