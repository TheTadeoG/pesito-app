-- Pesito 0054: pedido mínimo de cada proveedor (recomendación de compra, etapa 3).
--
-- Monto (en pesos) que hay que llegar a pedirle para que despache. La
-- recomendación avisa cuánto falta cuando el pedido sugerido no lo alcanza.
-- Opcional: null = sin mínimo.
-- Sin 0054 aplicada, la recomendación anda igual y guardar un mínimo da error.
-- Corre sobre una base que ya tiene 0001..0053 aplicadas.

alter table public.suppliers
  add column if not exists min_order_amount numeric(12, 2)
    check (min_order_amount is null or min_order_amount >= 0);

comment on column public.suppliers.min_order_amount is
  'Monto mínimo de pedido del proveedor, en pesos. null = sin mínimo.';
