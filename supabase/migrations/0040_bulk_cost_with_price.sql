-- Pesito: aumento masivo de costo que, opcionalmente, sube el precio de
-- venta en la misma proporción.
--
-- Sólo toca los productos cuyo costo sube (activos, con costo cargado y
-- mayor a 0, del proveedor o la marca elegidos). El precio de cada uno se
-- multiplica por costo nuevo / costo anterior: con porcentaje es el mismo
-- porcentaje; con monto fijo, cada producto sube en la proporción que subió
-- su costo.
--
-- Deja dos registros en bulk_price_changes (0039), uno de costo y otro de
-- precio, así cada uno aparece en su lista y se puede deshacer por
-- separado. El de precio con monto fijo se guarda sin porcentaje ni monto
-- (la app lo muestra como "proporcional al costo").
-- Corre sobre una base que ya tiene 0001..0039 aplicadas.

create or replace function public.bulk_increase_cost_with_price(
  p_org_id uuid,
  p_supplier_id uuid default null,
  p_brand text default null,
  p_percent numeric default null,
  p_fixed_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand text := nullif(trim(coalesce(p_brand, '')), '');
  v_cost_change_id uuid;
  v_price_change_id uuid;
  v_cost_count integer;
  v_price_count integer;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_supplier_id is null and v_brand is null then
    raise exception 'elegí un proveedor o una marca';
  end if;

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el valor a 0 o menos';
  end if;

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (p_org_id, 'cost', p_supplier_id, v_brand, p_percent, p_fixed_amount, auth.uid())
  returning id into v_cost_change_id;

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (
    p_org_id, 'price', p_supplier_id, v_brand,
    p_percent, null, auth.uid()
  )
  returning id into v_price_change_id;

  -- Primero el precio, que necesita el costo anterior para la proporción.
  perform set_config('pesito.bulk_change_id', v_price_change_id::text, true);

  update products
    set price = greatest(
      0,
      round(
        price * greatest(
          0,
          case
            when p_percent is not null then cost * (1 + p_percent / 100)
            else cost + p_fixed_amount
          end
        ) / cost,
        2
      )
    )
    where org_id = p_org_id
      and active = true
      and cost is not null
      and cost > 0
      and (p_supplier_id is null or default_supplier_id = p_supplier_id)
      and (v_brand is null or brand = v_brand);

  get diagnostics v_price_count = row_count;

  perform set_config('pesito.bulk_change_id', v_cost_change_id::text, true);

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
      and cost > 0
      and (p_supplier_id is null or default_supplier_id = p_supplier_id)
      and (v_brand is null or brand = v_brand);

  get diagnostics v_cost_count = row_count;

  perform set_config('pesito.bulk_change_id', '', true);

  if v_cost_count = 0 then
    delete from bulk_price_changes where id in (v_cost_change_id, v_price_change_id);
  else
    update bulk_price_changes set product_count = v_cost_count where id = v_cost_change_id;
    update bulk_price_changes set product_count = v_price_count where id = v_price_change_id;
  end if;

  if v_cost_count > 0 and v_price_count = 0 then
    delete from bulk_price_changes where id = v_price_change_id;
  end if;

  return jsonb_build_object('cost_count', v_cost_count, 'price_count', v_price_count);
end;
$$;

grant execute on function public.bulk_increase_cost_with_price(uuid, uuid, text, numeric, numeric) to authenticated;
