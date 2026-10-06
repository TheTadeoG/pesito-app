-- Pesito: qué compras a cuenta ya se pagaron (y cuánto).
--
-- Antes, qué parte de la deuda era de cada compra se calculaba al mostrarla,
-- y cambiaba cada vez que se asignaba un vencimiento (el pago "se movía" a
-- otra compra y quedaban compras sin fecha que parecían sin pagar).
-- Ahora cada pago queda aplicado a las compras:
--
-- 1) purchases.paid_amount: lo ya pagado de lo que quedó a cuenta.
-- 2) Se completa con los pagos que ya existen: se consideran pagadas las
--    compras más viejas primero. Sólo para los proveedores que todavía no
--    tienen nada aplicado, así correrla de nuevo no pisa nada.
-- 3) register_supplier_payment (misma firma) aplica cada pago nuevo primero a
--    la compra que vence antes y, sin fecha, a la más vieja.
--
-- Corre sobre una base con 0001..0057 aplicadas; se puede correr más de una vez.

alter table public.purchases
  add column if not exists paid_amount numeric(12, 2) not null default 0
    check (paid_amount >= 0);

comment on column public.purchases.paid_amount is
  'Parte de account_amount que ya se le pagó al proveedor.';

do $$
declare
  s record;
  p record;
  v_to_apply numeric;
  v_apply numeric;
begin
  for s in
    select su.id, su.balance,
      coalesce((
        select sum(pu.account_amount)
        from purchases pu
        where pu.supplier_id = su.id and pu.status = 'completada' and pu.account_amount > 0
      ), 0) as accounted
    from suppliers su
    where not exists (
      select 1 from purchases pa where pa.supplier_id = su.id and pa.paid_amount > 0
    )
  loop
    v_to_apply := greatest(0, s.accounted - s.balance);
    for p in
      select id, account_amount
      from purchases
      where supplier_id = s.id and status = 'completada' and account_amount > 0
      order by created_at, id
    loop
      exit when v_to_apply <= 0;
      v_apply := least(p.account_amount, v_to_apply);
      update purchases set paid_amount = v_apply where id = p.id;
      v_to_apply := v_to_apply - v_apply;
    end loop;
  end loop;
end;
$$;

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
  values (v_org_id, p_supplier_id, p_cash_register_id, p_method, p_amount, auth.uid());

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
    v_left := v_left - v_apply;
  end loop;
end;
$$;
