-- Pesito: presentación/empaque del producto (ej. "Pack de 6", "Fardo de 12"),
-- para aclarar en qué formato viene sin forzar una estructura rígida de packs.
-- Corre sobre una base que ya tiene 0001..0024 aplicadas.

alter table products
  add column if not exists package_label text;
