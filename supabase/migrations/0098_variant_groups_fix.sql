-- Arregla la creación de productos con variantes.
-- La política de 0097 llamaba a org_effective_plan(), que no es ejecutable por los usuarios (0045),
-- así que el insert del grupo fallaba con "permission denied". El control de plan pasa a un trigger
-- security definer (mismo patrón que el resto: require_plan).

drop policy if exists "members can create variant groups" on public.product_variant_groups;
create policy "members can create variant groups" on public.product_variant_groups
  for insert with check (public.is_org_member(org_id));

create or replace function public.guard_variant_group_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_plan(new.org_id, 'esencial', 'cargar productos con talles y colores');
  return new;
end;
$$;

drop trigger if exists guard_variant_group_insert on public.product_variant_groups;
create trigger guard_variant_group_insert
  before insert on public.product_variant_groups
  for each row execute function public.guard_variant_group_insert();
