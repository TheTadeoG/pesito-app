-- Pesito: proveedor habitual de un producto (opcional), para poder mostrarlo
-- como columna en Productos.
-- Corre sobre una base que ya tiene 0001..0014 aplicadas.

alter table products
  add column if not exists default_supplier_id uuid references suppliers (id) on delete set null;

create index if not exists products_default_supplier_id_idx on products (default_supplier_id);
