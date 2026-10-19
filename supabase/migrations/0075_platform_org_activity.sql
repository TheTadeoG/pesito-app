-- Panel interno (/admin): qué hizo cada negocio, en una sola consulta. Sirve para el embudo de
-- activación (negocio → primer producto → primera venta → paga) y para ver qué funciones usan.
--
-- Es una vista que corre con los permisos de su dueño (ve todos los negocios), así que NADIE
-- salvo la service role puede leerla: se le quita todo a anon y authenticated. La lee sólo
-- /admin con createAdminClient().

create or replace view public.platform_org_activity as
select
  o.id as org_id,
  o.created_at,
  (select min(p.created_at) from public.products p where p.org_id = o.id) as first_product_at,
  (select count(*) from public.products p where p.org_id = o.id) as product_count,
  (select min(s.created_at) from public.sales s where s.org_id = o.id and s.status = 'completada') as first_sale_at,
  (select count(*) from public.sales s where s.org_id = o.id and s.status = 'completada') as sale_count,
  exists (select 1 from public.purchases x where x.org_id = o.id) as has_purchase,
  exists (select 1 from public.cash_registers x where x.org_id = o.id) as has_cash,
  exists (select 1 from public.cash_registers x where x.org_id = o.id and x.status = 'cerrada') as has_cash_closed,
  exists (select 1 from public.customers x where x.org_id = o.id) as has_customer,
  exists (select 1 from public.suppliers x where x.org_id = o.id) as has_supplier,
  (select count(*) from public.memberships m where m.org_id = o.id) as member_count
from public.organizations o;

revoke all on public.platform_org_activity from public, anon, authenticated;
grant select on public.platform_org_activity to service_role;
