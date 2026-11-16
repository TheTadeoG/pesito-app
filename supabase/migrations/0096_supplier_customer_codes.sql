-- Código interno automático de proveedores y clientes (PRV-0001, CLI-0001...), por negocio. Lo asigna el sistema al crear
-- el registro, no se puede cambiar ni repetir, y sirve para ubicarlos sin ambigüedad (cuentas corrientes, planillas).
--
-- Los que ya existen reciben su número por orden de creación.

create table if not exists public.org_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  last_value integer not null default 0,
  primary key (org_id, kind)
);
alter table public.org_counters enable row level security;
revoke all on public.org_counters from anon, authenticated;

-- Siguiente número de un negocio (seguro con varias altas a la vez: el upsert bloquea la fila del contador).
create or replace function public.next_org_code(p_org_id uuid, p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  insert into public.org_counters (org_id, kind, last_value) values (p_org_id, p_kind, 1)
  on conflict (org_id, kind) do update set last_value = public.org_counters.last_value + 1
  returning last_value into v;
  return v;
end;
$$;
revoke all on function public.next_org_code(uuid, text) from public, anon, authenticated;

alter table public.suppliers add column if not exists code integer;
alter table public.customers add column if not exists code integer;

-- Los que ya existen: número por orden de creación dentro de cada negocio.
with n as (select id, row_number() over (partition by org_id order by created_at, id) as rn from public.suppliers where code is null)
update public.suppliers s set code = n.rn from n where s.id = n.id;
with n as (select id, row_number() over (partition by org_id order by created_at, id) as rn from public.customers where code is null)
update public.customers c set code = n.rn from n where c.id = n.id;

-- Contadores: siguen desde el número más alto.
insert into public.org_counters (org_id, kind, last_value)
select org_id, 'supplier', max(code) from public.suppliers group by org_id
on conflict (org_id, kind) do update set last_value = greatest(public.org_counters.last_value, excluded.last_value);
insert into public.org_counters (org_id, kind, last_value)
select org_id, 'customer', max(code) from public.customers group by org_id
on conflict (org_id, kind) do update set last_value = greatest(public.org_counters.last_value, excluded.last_value);

-- Al crear: siempre lo asigna el sistema (aunque la app mande otro valor). Al editar: no cambia.
create or replace function public.set_supplier_code() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.next_org_code(new.org_id, 'supplier');
  else
    new.code := old.code;
  end if;
  return new;
end;
$$;
create or replace function public.set_customer_code() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.next_org_code(new.org_id, 'customer');
  else
    new.code := old.code;
  end if;
  return new;
end;
$$;
drop trigger if exists suppliers_set_code on public.suppliers;
create trigger suppliers_set_code before insert or update on public.suppliers for each row execute function public.set_supplier_code();
drop trigger if exists customers_set_code on public.customers;
create trigger customers_set_code before insert or update on public.customers for each row execute function public.set_customer_code();

alter table public.suppliers alter column code set not null;
alter table public.customers alter column code set not null;
create unique index if not exists suppliers_org_code_unique on public.suppliers (org_id, code);
create unique index if not exists customers_org_code_unique on public.customers (org_id, code);
