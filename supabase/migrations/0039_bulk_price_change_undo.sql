-- Pesito: deshacer un aumento masivo de precios o costos.
--
-- Cada llamada a bulk_increase_field queda registrada en bulk_price_changes
-- y los renglones de product_price_history / product_cost_history que
-- genera llevan su id (bulk_change_id). Con eso, revert_bulk_price_change
-- devuelve cada producto a su valor anterior de una sola vez.
--
-- Al deshacer sólo se tocan los productos que siguen con el valor que dejó
-- el aumento: si alguien lo cambió después (a mano u otro aumento), se deja
-- como está para no pisar un cambio más nuevo. Se puede deshacer hasta 30
-- días después del aumento.
--
-- Los aumentos hechos antes de esta migración no quedan registrados y no se
-- pueden deshacer.
-- Corre sobre una base que ya tiene 0001..0038 aplicadas.

create table if not exists bulk_price_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  field text not null check (field in ('price', 'cost')),
  supplier_id uuid references suppliers (id) on delete set null,
  brand text,
  percent numeric(12, 2),
  fixed_amount numeric(12, 2),
  product_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users (id) on delete set null
);

create index if not exists bulk_price_changes_org_idx
  on bulk_price_changes (org_id, created_at desc);

alter table bulk_price_changes enable row level security;

-- Sólo lectura desde la app: se escribe únicamente desde las funciones
-- security definer de abajo.
drop policy if exists "members can view bulk price changes" on bulk_price_changes;
create policy "members can view bulk price changes"
  on bulk_price_changes for select
  using (public.is_org_member(org_id));

alter table product_price_history
  add column if not exists bulk_change_id uuid references bulk_price_changes (id) on delete set null;
alter table product_cost_history
  add column if not exists bulk_change_id uuid references bulk_price_changes (id) on delete set null;

-- Parciales: la mayoría de los cambios son individuales (sin bulk_change_id).
create index if not exists product_price_history_bulk_idx
  on product_price_history (bulk_change_id) where bulk_change_id is not null;
create index if not exists product_cost_history_bulk_idx
  on product_cost_history (bulk_change_id) where bulk_change_id is not null;

-- Los triggers de 0031 y 0034, ahora guardando a qué aumento masivo
-- pertenece el cambio. bulk_increase_field lo avisa con una variable local
-- a la transacción (pesito.bulk_change_id); fuera de un aumento masivo
-- está vacía y el renglón queda sin bulk_change_id, como hasta ahora.
create or replace function public.log_product_price_change()
returns trigger
language plpgsql
as $$
begin
  if new.price is distinct from old.price then
    insert into product_price_history (org_id, product_id, old_price, new_price, changed_by, bulk_change_id)
    values (
      new.org_id, new.id, old.price, new.price, auth.uid(),
      nullif(current_setting('pesito.bulk_change_id', true), '')::uuid
    );
  end if;
  return new;
end;
$$;

create or replace function public.log_product_cost_change()
returns trigger
language plpgsql
as $$
begin
  if new.cost is distinct from old.cost and old.cost is not null and new.cost is not null then
    insert into product_cost_history (org_id, product_id, old_cost, new_cost, changed_by, bulk_change_id)
    values (
      new.org_id, new.id, old.cost, new.cost, auth.uid(),
      nullif(current_setting('pesito.bulk_change_id', true), '')::uuid
    );
  end if;
  return new;
end;
$$;

-- Misma firma que en 0034 (ver CLAUDE.md: otra firma crearía un overload).
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
  v_change_id uuid;
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

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (
    p_org_id, p_field, p_supplier_id, nullif(trim(coalesce(p_brand, '')), ''),
    p_percent, p_fixed_amount, auth.uid()
  )
  returning id into v_change_id;

  perform set_config('pesito.bulk_change_id', v_change_id::text, true);

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

  perform set_config('pesito.bulk_change_id', '', true);

  -- Un aumento que no tocó nada no tiene nada que deshacer.
  if v_count = 0 then
    delete from bulk_price_changes where id = v_change_id;
  else
    update bulk_price_changes set product_count = v_count where id = v_change_id;
  end if;

  return v_count;
end;
$$;

-- Deshace un aumento masivo. Devuelve cuántos productos volvieron a su
-- valor anterior (reverted) y cuántos se dejaron como estaban porque
-- cambiaron después del aumento (skipped).
create or replace function public.revert_bulk_price_change(p_bulk_change_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change bulk_price_changes;
  v_total integer;
  v_reverted integer;
begin
  select * into v_change from bulk_price_changes where id = p_bulk_change_id for update;

  if not found or not public.is_org_member(v_change.org_id) then
    raise exception 'no encontramos ese aumento';
  end if;

  if v_change.reverted_at is not null then
    raise exception 'ese aumento ya se deshizo';
  end if;

  if v_change.created_at < now() - interval '30 days' then
    raise exception 'sólo se pueden deshacer aumentos de los últimos 30 días';
  end if;

  if v_change.field = 'price' then
    select count(*) into v_total from product_price_history where bulk_change_id = p_bulk_change_id;
    update products p
      set price = h.old_price
      from product_price_history h
      where h.bulk_change_id = p_bulk_change_id
        and p.id = h.product_id
        and p.org_id = v_change.org_id
        and p.price = h.new_price;
  else
    select count(*) into v_total from product_cost_history where bulk_change_id = p_bulk_change_id;
    update products p
      set cost = h.old_cost
      from product_cost_history h
      where h.bulk_change_id = p_bulk_change_id
        and p.id = h.product_id
        and p.org_id = v_change.org_id
        and p.cost = h.new_cost;
  end if;

  get diagnostics v_reverted = row_count;

  update bulk_price_changes
    set reverted_at = now(), reverted_by = auth.uid()
    where id = p_bulk_change_id;

  return jsonb_build_object('reverted', v_reverted, 'skipped', greatest(v_total - v_reverted, 0));
end;
$$;

grant execute on function public.revert_bulk_price_change(uuid) to authenticated;
