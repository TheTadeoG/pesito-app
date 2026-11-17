-- Color de referencia de cada variante (opcional): un punto de color junto al nombre del color.
-- Si no se elige, la app usa uno por defecto según el nombre (Negro, Blanco, Azul…).
alter table public.products
  add column if not exists variant_color_hex text
  check (variant_color_hex is null or variant_color_hex ~ '^#[0-9a-fA-F]{6}$');
