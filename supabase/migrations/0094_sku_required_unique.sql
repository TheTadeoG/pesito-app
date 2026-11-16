-- El SKU pasa a ser lo que identifica a cada producto: obligatorio y único dentro de cada negocio (sin importar
-- mayúsculas ni espacios al borde). Con eso la carga y la descarga de planillas reconocen siempre el mismo producto.
--
-- Antes de exigirlo, se ordenan los datos que ya existen:
--   1. Los productos sin SKU reciben uno: "P-00001", "P-00002"... (por negocio, en orden de creación).
--   2. Si dos productos tenían el mismo SKU, el más viejo se queda con el suyo y los demás pasan a "SKU-2", "SKU-3"...
-- Después se agrega el índice único y la restricción de que no esté vacío.

-- 1. Productos sin SKU (o con SKU en blanco).
with numbered as (
  select
    p.id,
    row_number() over (partition by p.org_id order by p.created_at, p.id) as n,
    -- Cuántos "P-xxxxx" ya existen en el negocio, para no pisarlos.
    coalesce(
      (select max(substring(x.sku from '^P-(\d+)$')::int) from public.products x
        where x.org_id = p.org_id and x.sku ~ '^P-\d{1,9}$'),
      0
    ) as base
  from public.products p
  where p.sku is null or btrim(p.sku) = ''
)
update public.products p
set sku = 'P-' || lpad((numbered.base + numbered.n)::text, 5, '0')
from numbered
where p.id = numbered.id;

-- 2. Espacios sobrantes.
update public.products set sku = btrim(sku) where sku <> btrim(sku);

-- 3. SKU repetidos dentro del mismo negocio: el más viejo se queda con el suyo.
with ranked as (
  select
    id,
    sku,
    row_number() over (partition by org_id, lower(sku) order by created_at, id) as rn
  from public.products
)
update public.products p
set sku = ranked.sku || '-' || ranked.rn
from ranked
where p.id = ranked.id and ranked.rn > 1;

-- (Si el sufijo chocara con otro SKU existente, la creación del índice de abajo falla y no se aplica nada.)

alter table public.products alter column sku set not null;
alter table public.products drop constraint if exists products_sku_not_blank;
alter table public.products add constraint products_sku_not_blank check (btrim(sku) <> '');
create unique index if not exists products_org_sku_unique on public.products (org_id, lower(btrim(sku)));
