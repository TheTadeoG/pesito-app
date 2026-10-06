-- Pesito: anular un pago a un proveedor (si te equivocaste de monto o de factura).
--
-- 1) supplier_payments.allocations: a qué compras se aplicó cada pago
--    ([{purchase_id, amount}]), para poder devolverlo exacto. Los pagos
--    anteriores no lo tienen: se devuelve de las compras que se pagaron último.
-- 2) register_supplier_payment y register_supplier_purchase_payments (misma
--    firma que las vigentes, 0058 y 0059) guardan ese reparto.
-- 3) void_supplier_payment: devuelve el saldo y lo pagado de cada compra y
--    borra el pago, así la caja vuelve a tener ese dinero. Sólo si la caja
--    donde se registró sigue abierta (si no, ya se cerró con ese dato).
--
-- Corre sobre una base con 0001..0059 aplicadas; se puede correr más de una vez.

alter table public.supplier_payments
  add column if not exists allocations jsonb;

create or replace function public.register_supplier_payment(
  p_supplier_id uuid,
  p_cash_register_id uuid,
  p_method text,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_left numeric;
  v_apply numeric;
  v_purchase record;
  v_payment_id uuid;
  v_alloc jsonb := '[]'::jsonb;
begin
  select org_id into v_org_id from suppliers where id = p_supplier_id;

  if v_org_id is null then
    raise exception 'proveedor no encontrado';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'monto inválido';
  end if;

  if p_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr')
     and not exists (
       select 1 from payment_methods where org_id = v_org_id and name = p_method
     ) then
    raise exception 'medio de pago inválido';
  end if;

  insert into supplier_payments (org_id, supplier_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, p_amount, auth.uid())
  returning id into v_payment_id;

  update suppliers set balance = balance - p_amount where id = p_supplier_id;

  -- El pago se aplica primero a la compra que vence antes; las que no tienen
  -- fecha van después, la más vieja primero.
  v_left := p_amount;
  for v_purchase in
    select id, account_amount - paid_amount as pending
    from purchases
    where supplier_id = p_supplier_id
      and status = 'completada'
      and account_amount - paid_amount > 0
    order by due_date asc nulls last, created_at asc, id
  loop
    exit when v_left <= 0;
    v_apply := least(v_purchase.pending, v_left);
    update purchases set paid_amount = paid_amount + v_apply where id = v_purchase.id;
    v_alloc := v_alloc || jsonb_build_object('purchase_id', v_purchase.id, 'amount', v_apply);
    v_left := v_left - v_apply;
  end loop;

  update supplier_payments set allocations = v_alloc where id = v_payment_id;
end;
$$;

create or replace function public.register_supplier_purchase_payments(
  p_supplier_id uuid,
  p_cash_register_id uuid,
  p_method text,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_amount numeric;
  v_pending numeric;
  v_purchase_id uuid;
  v_payment_id uuid;
begin
  select org_id into v_org_id from suppliers where id = p_supplier_id;

  if v_org_id is null then
    raise exception 'proveedor no encontrado';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  perform public.require_plan(v_org_id, 'esencial', 'pagarle facturas puntuales a un proveedor');

  if p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'elegí al menos una factura';
  end if;

  if (select count(distinct a ->> 'purchase_id') from jsonb_array_elements(p_allocations) a)
     <> jsonb_array_length(p_allocations) then
    raise exception 'hay una factura repetida';
  end if;

  if p_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr')
     and not exists (
       select 1 from payment_methods where org_id = v_org_id and name = p_method
     ) then
    raise exception 'medio de pago inválido';
  end if;

  for v_item in select * from jsonb_array_elements(p_allocations) loop
    v_amount := (v_item ->> 'amount')::numeric;
    v_purchase_id := (v_item ->> 'purchase_id')::uuid;

    if v_amount is null or v_amount <= 0 then
      raise exception 'monto inválido';
    end if;

    select account_amount - paid_amount into v_pending
      from purchases
      where id = v_purchase_id
        and supplier_id = p_supplier_id
        and status = 'completada'
      for update;

    if v_pending is null then
      raise exception 'la factura no es de este proveedor';
    end if;

    if v_amount > v_pending + 0.004 then
      raise exception 'el monto supera lo que falta pagar de la factura';
    end if;

    v_total := v_total + v_amount;
  end loop;

  insert into supplier_payments (org_id, supplier_id, cash_register_id, method, amount, user_id, allocations)
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, v_total, auth.uid(), p_allocations)
  returning id into v_payment_id;

  update suppliers set balance = balance - v_total where id = p_supplier_id;

  for v_item in select * from jsonb_array_elements(p_allocations) loop
    update purchases
      set paid_amount = least(account_amount, paid_amount + (v_item ->> 'amount')::numeric)
      where id = (v_item ->> 'purchase_id')::uuid;
  end loop;
end;
$$;

create or replace function public.void_supplier_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
  v_register_status text;
  v_item jsonb;
  v_left numeric;
  v_take numeric;
  v_purchase record;
begin
  select * into v_pay from supplier_payments where id = p_payment_id for update;

  if v_pay.id is null then
    raise exception 'pago no encontrado';
  end if;

  if not public.is_org_member(v_pay.org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  perform public.require_plan(v_pay.org_id, 'esencial', 'anular pagos a proveedores');

  if v_pay.cash_register_id is not null then
    select status into v_register_status from cash_registers where id = v_pay.cash_register_id;
    if v_register_status is distinct from 'abierta' then
      raise exception 'la caja de este pago ya está cerrada';
    end if;
  end if;

  -- Devuelve lo pagado a cada compra.
  if v_pay.allocations is not null and jsonb_typeof(v_pay.allocations) = 'array' then
    for v_item in select * from jsonb_array_elements(v_pay.allocations) loop
      update purchases
        set paid_amount = greatest(0, paid_amount - (v_item ->> 'amount')::numeric)
        where id = (v_item ->> 'purchase_id')::uuid;
    end loop;
  else
    -- Pago anterior a 0060: se devuelve de las que se pagaron último (al revés
    -- del orden en que se aplican los pagos).
    v_left := v_pay.amount;
    for v_purchase in
      select id, paid_amount
      from purchases
      where supplier_id = v_pay.supplier_id and status = 'completada' and paid_amount > 0
      order by due_date desc nulls first, created_at desc, id
    loop
      exit when v_left <= 0;
      v_take := least(v_purchase.paid_amount, v_left);
      update purchases set paid_amount = paid_amount - v_take where id = v_purchase.id;
      v_left := v_left - v_take;
    end loop;
  end if;

  update suppliers set balance = balance + v_pay.amount where id = v_pay.supplier_id;
  delete from supplier_payments where id = p_payment_id;
end;
$$;

revoke all on function public.void_supplier_payment(uuid) from public, anon;
grant execute on function public.void_supplier_payment(uuid) to authenticated;
