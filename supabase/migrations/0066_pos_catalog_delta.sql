-- Catálogo del POS: traer sólo el stock que cambió.
--
-- pos_catalog (0064/0065) devuelve el stock de TODOS los productos activos en
-- cada consulta (~53 bytes por producto: ~1 MB con 20.000). Esta función nueva,
-- pos_catalog_delta, devuelve el stock sólo de los productos que cambiaron
-- desde p_since. pos_catalog queda igual y es el respaldo: el navegador cae
-- ahí ante cualquier duda (y baja todo una vez por día).
--
-- Qué productos "cambiaron" (dos fuentes independientes, para no perder ninguno):
--   * los que tuvieron un movimiento de stock (venta, anulación, compra,
--     ajuste, pase entre sucursales) desde p_since;
--   * los que tuvieron cualquier modificación (products.updated_at: también
--     sube con cada cambio de stock, de precio, de datos o al activarse).
-- Devuelve además active_count (cuántos productos activos hay): si no coincide
-- con lo que tiene el navegador después de mezclar, éste descarga todo.

create or replace function public.pos_catalog_delta_raw(
  p_org_id uuid,
  p_branch_id uuid,
  p_since timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  if p_since is null then
    raise exception 'falta la fecha de la última actualización';
  end if;
  if p_branch_id is not null
     and not exists (select 1 from branches where id = p_branch_id and org_id = p_org_id) then
    raise exception 'sucursal inválida';
  end if;

  return jsonb_build_object(
    'mode', 'delta',
    'now', now(),
    'active_count', (select count(*) from products where org_id = p_org_id and active),
    'changed', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'barcode', barcode, 'sku', sku, 'price', price,
        'min_stock', min_stock, 'unit', unit, 'image_url', image_url, 'active', active)), '[]'::jsonb)
      from products
      where org_id = p_org_id and updated_at > p_since
    ),
    'stock', (
      select coalesce(jsonb_agg(jsonb_build_array(x.id, x.stock)), '[]'::jsonb)
      from (
        select p.id,
          case when p_branch_id is null then p.stock else coalesce(bs.stock, 0) end as stock
        from products p
        left join branch_stock bs on bs.product_id = p.id and bs.branch_id = p_branch_id
        where p.org_id = p_org_id
          and p.active
          and p.id in (
            select m.product_id from stock_movements m
            where m.org_id = p_org_id and m.created_at > p_since
            union
            select q.id from products q
            where q.org_id = p_org_id and q.updated_at > p_since
          )
      ) x
    )
  );
end;
$$;

create or replace function public.pos_catalog_delta(
  p_org_id uuid,
  p_branch_id uuid,
  p_since timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mismo cupo que pos_catalog: entre las dos, 30 por minuto por negocio.
  perform public.rate_limit_hit(p_org_id, 'catalogo_pos', 30, 60);
  return public.pos_catalog_delta_raw(p_org_id, p_branch_id, p_since);
end;
$$;

revoke all on function public.pos_catalog_delta_raw(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pos_catalog_delta(uuid, uuid, timestamptz) to authenticated;
