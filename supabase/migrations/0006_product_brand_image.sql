-- Pesito: marca de producto + bucket de Storage para imágenes de producto.
-- Corre sobre una base que ya tiene 0001..0005 aplicadas.

alter table products add column if not exists brand text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images: authenticated can upload" on storage.objects;
create policy "product images: authenticated can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product images: authenticated can update" on storage.objects;
create policy "product images: authenticated can update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product images: authenticated can delete" on storage.objects;
create policy "product images: authenticated can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product images: public read" on storage.objects;
create policy "product images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');
