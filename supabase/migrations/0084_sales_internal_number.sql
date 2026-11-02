-- Comprobante interno tipo X con numeración propia: cada venta recibe un número correlativo por negocio
-- («X 0001-00000012»). Lo asigna la base al crear la venta (trigger), así no depende de la app ni se repite
-- aunque cobren dos cajas a la vez. Las ventas anuladas conservan su número (nunca se reutiliza).
-- Las ventas que ya existen se numeran por fecha.

create table if not exists public.sale_counters (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  last_number integer not null default 0
);
alter table public.sale_counters enable row level security;
revoke all on public.sale_counters from anon, authenticated;

alter table public.sales add column if not exists internal_number integer;

create or replace function public.assign_sale_internal_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  if new.internal_number is null then
    insert into public.sale_counters (org_id, last_number) values (new.org_id, 1)
    on conflict (org_id) do update set last_number = public.sale_counters.last_number + 1
    returning last_number into v_number;
    new.internal_number := v_number;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_sale_internal_number() from public, anon, authenticated;

drop trigger if exists sales_internal_number on public.sales;
create trigger sales_internal_number
  before insert on public.sales
  for each row execute function public.assign_sale_internal_number();

-- Ventas anteriores: numeradas por fecha, dentro de cada negocio.
with numbered as (
  select id, row_number() over (partition by org_id order by created_at, id) as rn
  from public.sales
  where internal_number is null
)
update public.sales s set internal_number = numbered.rn from numbered where s.id = numbered.id;

-- El contador sigue desde la última numerada.
insert into public.sale_counters (org_id, last_number)
select org_id, max(internal_number) from public.sales where internal_number is not null group by org_id
on conflict (org_id) do update set last_number = greatest(public.sale_counters.last_number, excluded.last_number);

create unique index if not exists sales_org_internal_number_key on public.sales (org_id, internal_number);
