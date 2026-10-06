-- Pesito: pagarle a un proveedor facturas puntuales (no siempre la más vieja).
--
-- register_supplier_purchase_payments recibe qué facturas (compras a cuenta)
-- se pagan y cuánto de cada una, y las descuenta de esas compras. Es una
-- función nueva: register_supplier_payment (un monto, que se reparte solo)
-- sigue igual.
--
-- Corre sobre una base con 0001..0058 aplicadas; se puede correr más de una vez.

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

  -- Primero se validan todas (y se bloquean), después se aplican.
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

  insert into supplier_payments (org_id, supplier_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, v_total, auth.uid());

  update suppliers set balance = balance - v_total where id = p_supplier_id;

  for v_item in select * from jsonb_array_elements(p_allocations) loop
    update purchases
      set paid_amount = least(account_amount, paid_amount + (v_item ->> 'amount')::numeric)
      where id = (v_item ->> 'purchase_id')::uuid;
  end loop;
end;
$$;

revoke all on function public.register_supplier_purchase_payments(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.register_supplier_purchase_payments(uuid, uuid, text, jsonb) to authenticated;
