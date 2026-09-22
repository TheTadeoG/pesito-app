-- Pesito: los cobros de deuda de fiado (desde Clientes) ahora impactan la
-- caja del usuario que los registra: se elige el medio de pago, y si es
-- efectivo se suma al efectivo disponible de esa caja.
-- Corre sobre una base que ya tiene 0001..0011 aplicadas.

create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  cash_register_id uuid references cash_registers (id) on delete set null,
  method text not null check (method in ('efectivo', 'tarjeta', 'transferencia', 'qr')),
  amount numeric(12, 2) not null check (amount > 0),
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists customer_payments_customer_id_idx on customer_payments (customer_id);
create index if not exists customer_payments_cash_register_method_idx
  on customer_payments (cash_register_id, method);

alter table customer_payments enable row level security;

create policy "members can view customer payments in their org"
  on customer_payments for select
  using (public.is_org_member(org_id));

create or replace function public.register_customer_payment(
  p_customer_id uuid,
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
begin
  select org_id into v_org_id from customers where id = p_customer_id;

  if v_org_id is null then
    raise exception 'cliente no encontrado';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'monto inválido';
  end if;

  insert into customer_payments (org_id, customer_id, cash_register_id, method, amount, user_id)
  values (v_org_id, p_customer_id, p_cash_register_id, p_method, p_amount, auth.uid());

  update customers set balance = balance - p_amount where id = p_customer_id;
end;
$$;
