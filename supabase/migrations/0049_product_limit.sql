-- Pesito 0049: límite de productos activos por plan.
--
-- Gratis 1.000, Esencial 4.000, Pro 12.000, IA 20.000 (los desactivados no
-- cuentan). Se controla al crear un producto activo y al reactivar uno. Si
-- el negocio bajó de plan y tiene más, los que ya están siguen andando; no
-- puede sumar ni reactivar hasta estar debajo del límite.
--
-- plan_limit mantiene la misma firma que en 0045 (suma 'products').
-- Compatible con la app anterior y la nueva.

create or replace function public.plan_limit(p_org_id uuid, p_kind text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case p_kind
    when 'users' then case public.org_effective_plan(p_org_id) when 'gratis' then 1 when 'esencial' then 2 else 6 end
    when 'open_registers' then case public.org_effective_plan(p_org_id) when 'gratis' then 1 when 'esencial' then 2 else 6 end
    when 'branches' then case public.org_effective_plan(p_org_id) when 'ia' then 2 else 1 end
    when 'products' then case public.org_effective_plan(p_org_id)
      when 'gratis' then 1000 when 'esencial' then 4000 when 'pro' then 12000 else 20000 end
  end
$$;

create index if not exists products_org_active_idx on public.products (org_id) where active;

create or replace function public.guard_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  -- Sólo usuarios del sistema (no la service role de soporte/migraciones).
  if auth.uid() is null or not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active then
    return new;
  end if;
  v_limit := public.plan_limit(new.org_id, 'products');
  select count(*) into v_used from products where org_id = new.org_id and active;
  if v_used >= v_limit then
    raise exception 'Tu plan incluye hasta % productos activos', replace(to_char(v_limit, 'FM999,999'), ',', '.');
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_limit on public.products;
create trigger products_guard_limit
  before insert or update of active on public.products
  for each row execute function public.guard_product_limit();
