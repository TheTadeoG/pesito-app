-- Pesito: anular una compra (revierte el stock sumado).
-- Corre sobre una base que ya tiene 0001..0007 aplicadas.

alter table purchases add column if not exists status text not null default 'completada';

alter table purchases drop constraint if exists purchases_status_check;
alter table purchases add constraint purchases_status_check
  check (status in ('completada', 'anulada'));

create or replace function public.void_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_item record;
  v_product products%rowtype;
begin
  select * into v_purchase from purchases where id = p_purchase_id;

  if v_purchase.id is null then
    raise exception 'compra no encontrada';
  end if;

  if not public.is_org_member(v_purchase.org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if v_purchase.status = 'anulada' then
    raise exception 'la compra ya está anulada';
  end if;

  for v_item in select * from purchase_items where purchase_id = p_purchase_id loop
    select * into v_product from products where id = v_item.product_id for update;

    if v_product.id is not null then
      if v_product.stock < v_item.quantity then
        raise exception 'no se puede anular: % ya no tiene stock suficiente para revertir', v_product.name;
      end if;

      update products set stock = stock - v_item.quantity where id = v_product.id;

      insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
      values (
        v_purchase.org_id,
        v_product.id,
        'ajuste',
        -1 * v_item.quantity,
        'Anulación de compra ' || p_purchase_id::text,
        auth.uid()
      );
    end if;
  end loop;

  update purchases set status = 'anulada' where id = p_purchase_id;
end;
$$;
