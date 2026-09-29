-- Pesito 0052: recomendación de compra más precisa (etapa 1).
--
-- * Plazo de entrega de cada proveedor (días): la recomendación avisa cuándo
--   pedir para no quedarse sin stock mientras llega el pedido.
-- * Unidades por bulto de cada producto (caja, pack, fardo): el pedido sale
--   en bultos enteros.
-- * Ajustes del negocio: días de cobertura que se quiere tener, ventana de
--   ventas que se mira y colchón de seguridad.
--
-- Todo es opcional: sin datos, la recomendación calcula igual que antes
-- (14 días de cobertura, últimos 30 días, sin colchón ni plazo).
-- Sin 0052 aplicada, la recomendación anda como antes y guardar un plazo, un
-- bulto o los ajustes da error; el resto funciona.
-- Corre sobre una base que ya tiene 0001..0051 aplicadas.

alter table public.suppliers
  add column if not exists lead_time_days integer
    check (lead_time_days is null or (lead_time_days >= 0 and lead_time_days <= 90));

comment on column public.suppliers.lead_time_days is
  'Días que tarda en llegar un pedido a este proveedor. null = no se sabe.';

alter table public.products
  add column if not exists pack_size numeric(12, 3)
    check (pack_size is null or pack_size > 0);

comment on column public.products.pack_size is
  'Cantidad (en la unidad del producto) que trae cada bulto del proveedor: caja, pack, fardo. null = se compra suelto.';

alter table public.organizations
  add column if not exists restock_target_days integer not null default 14
    check (restock_target_days between 1 and 90),
  add column if not exists restock_window_days integer not null default 30
    check (restock_window_days between 7 and 180),
  add column if not exists restock_safety_days integer not null default 0
    check (restock_safety_days between 0 and 30);

comment on column public.organizations.restock_target_days is
  'Días de venta que se quiere tener cubiertos después de que llega un pedido.';
comment on column public.organizations.restock_window_days is
  'Cuántos días de ventas hacia atrás se miran para calcular el ritmo de venta.';
comment on column public.organizations.restock_safety_days is
  'Días extra de colchón por si el proveedor tarda o la venta sube.';
