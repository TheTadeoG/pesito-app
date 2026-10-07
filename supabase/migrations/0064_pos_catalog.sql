-- Catálogo del POS con caché local.
--
-- El POS bajaba el catálogo entero (nombre, código, precio, imagen, etc. de
-- cada producto, ~250 bytes cada uno) en cada carga. Ahora el navegador guarda
-- una copia y esta función le devuelve:
--   * changed: sólo los productos modificados desde p_since (o todos los
--     activos si no hay copia), con todos sus datos;
--   * stock: [id, stock] de TODOS los productos activos, siempre al día (en la
--     sucursal de p_branch_id, o el total si no hay). Es la lista oficial de
--     qué productos existen: lo que el navegador tenga y no esté acá se borra.
-- La llama el navegador directo (no pasa por Vercel). security definer con
-- control de membresía; la sucursal tiene que ser del negocio.

create or replace function public.pos_catalog(
  p_org_id uuid,
  p_branch_id uuid default null,
  p_since timestamptz default null
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
  if p_branch_id is not null
     and not exists (select 1 from branches where id = p_branch_id and org_id = p_org_id) then
    raise exception 'sucursal inválida';
  end if;

  return jsonb_build_object(
    'now', now(),
    'changed', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'barcode', barcode, 'sku', sku, 'price', price,
        'min_stock', min_stock, 'unit', unit, 'image_url', image_url, 'active', active)), '[]'::jsonb)
      from products
      where org_id = p_org_id
        and ((p_since is null and active) or (p_since is not null and updated_at > p_since))
    ),
    'stock', (
      select coalesce(jsonb_agg(jsonb_build_array(x.id, x.stock)), '[]'::jsonb)
      from (
        select p.id,
          case when p_branch_id is null then p.stock else coalesce(bs.stock, 0) end as stock
        from products p
        left join branch_stock bs on bs.product_id = p.id and bs.branch_id = p_branch_id
        where p.org_id = p_org_id and p.active
      ) x
    )
  );
end;
$$;

grant execute on function public.pos_catalog(uuid, uuid, timestamptz) to authenticated;
