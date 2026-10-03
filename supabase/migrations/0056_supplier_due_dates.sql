-- Pesito: vencimientos de las compras a cuenta y días de entrega de cada proveedor.
--
-- 1) purchases.due_date: cuándo vence lo que quedó a cuenta corriente (opcional).
--    Las compras ya cargadas quedan sin fecha ("Sin fecha de vencimiento").
-- 2) suppliers.delivery_days: días de la semana en que entrega (0 = lunes ... 6 = domingo).
-- 3) set_purchase_due_date: único camino para cargar o cambiar el vencimiento
--    (purchases no tiene política de update para el usuario).
--
-- Corre sobre una base con 0001..0055 aplicadas; se puede correr más de una vez.

alter table public.purchases add column if not exists due_date date;
comment on column public.purchases.due_date is
  'Vencimiento de lo que quedó a cuenta corriente con el proveedor. null = sin fecha.';

alter table public.suppliers
  add column if not exists delivery_days smallint[] not null default '{}';
comment on column public.suppliers.delivery_days is
  'Días de la semana en que entrega (0 = lunes ... 6 = domingo).';

create index if not exists purchases_org_due_date_idx
  on public.purchases (org_id, due_date)
  where due_date is not null;

create or replace function public.set_purchase_due_date(p_purchase_id uuid, p_due_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_account numeric;
begin
  select org_id, account_amount into v_org, v_account
    from purchases where id = p_purchase_id;
  if v_org is null then
    raise exception 'la compra no existe';
  end if;
  if not public.is_org_member(v_org) then
    raise exception 'no pertenece a esta organización';
  end if;
  perform public.require_plan(v_org, 'esencial', 'cargar vencimientos de proveedores');
  if coalesce(v_account, 0) <= 0 then
    raise exception 'la compra no quedó a cuenta corriente';
  end if;

  update purchases set due_date = p_due_date where id = p_purchase_id;
end;
$$;

revoke all on function public.set_purchase_due_date(uuid, date) from public, anon;
grant execute on function public.set_purchase_due_date(uuid, date) to authenticated;
