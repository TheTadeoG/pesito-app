-- Pesito 0045: seguridad.
--
-- 1. Caja, fiado y stock sólo cambian a través de las funciones del sistema:
--    un usuario logueado ya no puede, llamando directo a la base, editar
--    una caja cerrada o ajena, inventar el efectivo esperado al cerrar,
--    borrar movimientos de caja, cambiar saldos de clientes/proveedores ni
--    tocar el stock (con sucursales). Tampoco insertar ventas/compras sueltas.
-- 2. Imágenes de productos: cada negocio en su carpeta, sólo imágenes, 5 MB.
-- 3. Bloqueo de ingreso por contraseñas fallidas: sólo lo maneja el servidor.
-- 4. Plan y límites también en la base (lib/plan-access.ts es la misma regla
--    del lado de la app): aumentos masivos, En vivo, sucursales, pases de
--    mercadería, cuenta corriente con proveedores, usuarios, cajas abiertas.
--
-- Compatible con la app anterior y la nueva: aplicar después de desplegar
-- el código que sube las imágenes a la carpeta del negocio y usa la
-- service role para el bloqueo de ingreso.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- true cuando la escritura viene directo de un usuario (API de Supabase) y
-- no desde una función security definer del sistema (que corre como su
-- dueño) ni desde el servidor con la service role.
create or replace function public.is_direct_write()
returns boolean
language sql
stable
as $$
  select current_user in ('authenticated', 'anon')
$$;

create or replace function public.org_effective_plan(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when s.plan = 'gratis' and s.pro_trial_ends_at > now() then 'pro'
      else s.plan
    end
    from organization_subscriptions s
    where s.org_id = p_org_id
  ), 'gratis')
$$;

create or replace function public.plan_rank(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan when 'esencial' then 1 when 'pro' then 2 when 'ia' then 3 else 0 end
$$;

create or replace function public.require_plan(p_org_id uuid, p_min_plan text, p_what text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.plan_rank(public.org_effective_plan(p_org_id)) < public.plan_rank(p_min_plan) then
    raise exception 'Necesitás el Plan % para %',
      case p_min_plan when 'esencial' then 'Esencial' when 'pro' then 'Pro' else 'IA' end, p_what;
  end if;
end;
$$;

-- Mismos números que planLimits en lib/plan-access.ts.
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
  end
$$;

create or replace function public.require_user_slot(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := public.plan_limit(p_org_id, 'users');
  v_used integer;
begin
  select
    (select count(*) from memberships where org_id = p_org_id)
    + (select count(*) from invitations where org_id = p_org_id and used_at is null and expires_at > now())
  into v_used;
  if v_used >= v_limit then
    raise exception 'Tu plan incluye hasta % %', v_limit, case when v_limit = 1 then 'usuario' else 'usuarios' end;
  end if;
end;
$$;

revoke all on function public.org_effective_plan(uuid) from public, anon, authenticated;
revoke all on function public.require_plan(uuid, text, text) from public, anon, authenticated;
revoke all on function public.plan_limit(uuid, text) from public, anon, authenticated;
-- La usa el control de cajas abiertas, que corre con los permisos de quien abre.
grant execute on function public.plan_limit(uuid, text) to authenticated;
revoke all on function public.require_user_slot(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Caja
-- ---------------------------------------------------------------------------

-- Abrir: siempre a nombre de quien la abre y respetando las cajas abiertas
-- a la vez del plan.
create or replace function public.guard_cash_register_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_limit integer;
  v_open integer;
begin
  if not public.is_direct_write() then
    return new;
  end if;
  new.user_id := auth.uid();
  new.status := 'abierta';
  new.closing_amount := null;
  new.expected_amount := null;
  new.closed_at := null;

  v_limit := public.plan_limit(new.org_id, 'open_registers');
  select count(*) into v_open from cash_registers where org_id = new.org_id and status = 'abierta';
  if v_open >= v_limit then
    raise exception 'Tu plan incluye hasta % %', v_limit,
      case when v_limit = 1 then 'caja abierta a la vez' else 'cajas abiertas a la vez' end;
  end if;
  return new;
end;
$$;

drop trigger if exists cash_registers_guard_insert on cash_registers;
create trigger cash_registers_guard_insert
  before insert on cash_registers
  for each row execute function public.guard_cash_register_insert();

-- Cerrar: sólo quien la abrió o un administrador, una sola vez, y el
-- efectivo esperado lo calcula la base (no se puede mandar inventado).
create or replace function public.guard_cash_register_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v record;
begin
  if not public.is_direct_write() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'no se puede borrar una caja';
  end if;
  if old.status = 'cerrada' then
    raise exception 'la caja ya está cerrada';
  end if;
  if old.user_id is distinct from auth.uid() and not public.is_org_admin(old.org_id) then
    raise exception 'sólo quien abrió la caja o un administrador puede cerrarla';
  end if;
  if new.org_id is distinct from old.org_id
     or new.user_id is distinct from old.user_id
     or new.opening_amount is distinct from old.opening_amount
     or new.opened_at is distinct from old.opened_at then
    raise exception 'no se pueden cambiar los datos de apertura de la caja';
  end if;

  if new.status = 'cerrada' then
    select * into v from public.cash_register_summaries(array[old.id]);
    new.expected_amount := old.opening_amount
      + coalesce(v.sales_cash, 0) + coalesce(v.debt_payments, 0) + coalesce(v.ingresos, 0)
      - coalesce(v.retiros, 0) - coalesce(v.supplier_payments, 0) - coalesce(v.cash_purchases, 0);
    new.closed_at := now();
  else
    new.expected_amount := old.expected_amount;
    new.closing_amount := old.closing_amount;
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists cash_registers_guard_change on cash_registers;
create trigger cash_registers_guard_change
  before update or delete on cash_registers
  for each row execute function public.guard_cash_register_change();

-- Retiros e ingresos: sólo en una caja abierta, propia (o siendo
-- administrador), y no se editan ni se borran.
create or replace function public.guard_cash_movement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reg record;
begin
  if not public.is_direct_write() then
    return coalesce(new, old);
  end if;
  if tg_op <> 'INSERT' then
    raise exception 'los movimientos de caja no se pueden modificar ni borrar';
  end if;
  select org_id, user_id, status into v_reg from cash_registers where id = new.cash_register_id;
  if v_reg.org_id is null or v_reg.org_id <> new.org_id or v_reg.status <> 'abierta' then
    raise exception 'la caja no está abierta';
  end if;
  if v_reg.user_id is distinct from auth.uid() and not public.is_org_admin(v_reg.org_id) then
    raise exception 'sólo podés mover plata de tu propia caja';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists cash_movements_guard on cash_movements;
create trigger cash_movements_guard
  before insert or update or delete on cash_movements
  for each row execute function public.guard_cash_movement();

-- ---------------------------------------------------------------------------
-- Saldos de clientes (fiado) y proveedores: sólo cambian con ventas,
-- compras y pagos (funciones del sistema).
-- ---------------------------------------------------------------------------

create or replace function public.guard_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_direct_write() then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    new.balance := 0;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.balance is distinct from old.balance then
      raise exception 'el saldo sólo cambia con ventas, compras y pagos';
    end if;
    return new;
  end if;
  if coalesce(old.balance, 0) <> 0 and not public.is_org_admin(old.org_id) then
    raise exception 'sólo un administrador puede borrar a alguien con saldo pendiente';
  end if;
  return old;
end;
$$;

drop trigger if exists customers_guard_balance on customers;
create trigger customers_guard_balance
  before insert or update or delete on customers
  for each row execute function public.guard_balance();

drop trigger if exists suppliers_guard_balance on suppliers;
create trigger suppliers_guard_balance
  before insert or update or delete on suppliers
  for each row execute function public.guard_balance();

-- ---------------------------------------------------------------------------
-- Stock: con sucursales, sólo cambia con ventas, compras, ajustes y pases.
-- ---------------------------------------------------------------------------

create or replace function public.guard_product_stock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_direct_write()
     and new.stock is distinct from old.stock
     and exists (select 1 from branches where org_id = old.org_id) then
    raise exception 'el stock sólo cambia con ventas, compras y ajustes';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_stock on products;
create trigger products_guard_stock
  before update on products
  for each row execute function public.guard_product_stock();

-- Ventas y compras sólo se registran con checkout_sale / register_purchase.
drop policy if exists "members can insert sales" on sales;
drop policy if exists "members can insert purchases" on purchases;

-- ---------------------------------------------------------------------------
-- 2. Imágenes de productos
-- ---------------------------------------------------------------------------

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'product-images';

drop policy if exists "product images: authenticated can upload" on storage.objects;
drop policy if exists "product images: authenticated can update" on storage.objects;
drop policy if exists "product images: authenticated can delete" on storage.objects;
drop policy if exists "product images: org members can upload" on storage.objects;
drop policy if exists "product images: org members can update" on storage.objects;
drop policy if exists "product images: org members can delete" on storage.objects;

-- La primera carpeta del archivo es el id del negocio ("<org_id>/<archivo>").
create policy "product images: org members can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]
    )
  );

create policy "product images: org members can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]
    )
  );

create policy "product images: org members can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Bloqueo por contraseñas fallidas: sólo desde el servidor (service role)
-- ---------------------------------------------------------------------------

revoke all on function public.check_login_lockout(text) from public, anon, authenticated;
revoke all on function public.register_login_failure(text) from public, anon, authenticated;
revoke all on function public.register_login_success(text) from public, anon, authenticated;
grant execute on function public.check_login_lockout(text) to service_role;
grant execute on function public.register_login_failure(text) to service_role;
grant execute on function public.register_login_success(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Plan y límites en las funciones (misma firma que las vigentes)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bulk_increase_field(p_org_id uuid, p_field text, p_supplier_id uuid DEFAULT NULL::uuid, p_brand text DEFAULT NULL::text, p_percent numeric DEFAULT NULL::numeric, p_fixed_amount numeric DEFAULT NULL::numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
  v_change_id uuid;
begin
  perform public.require_plan(p_org_id, 'pro', 'usar los aumentos masivos');
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_field not in ('price', 'cost') then
    raise exception 'campo inválido';
  end if;

  if p_supplier_id is null and (p_brand is null or trim(p_brand) = '') then
    raise exception 'elegí un proveedor o una marca';
  end if;

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el valor a 0 o menos';
  end if;

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (
    p_org_id, p_field, p_supplier_id, nullif(trim(coalesce(p_brand, '')), ''),
    p_percent, p_fixed_amount, auth.uid()
  )
  returning id into v_change_id;

  perform set_config('pesito.bulk_change_id', v_change_id::text, true);

  if p_field = 'price' then
    update products
      set price = greatest(
        0,
        round(
          case
            when p_percent is not null then price * (1 + p_percent / 100)
            else price + p_fixed_amount
          end,
          2
        )
      )
      where org_id = p_org_id
        and active = true
        and (p_supplier_id is null or default_supplier_id = p_supplier_id)
        and (p_brand is null or trim(p_brand) = '' or brand = p_brand);
  else
    update products
      set cost = greatest(
        0,
        round(
          case
            when p_percent is not null then cost * (1 + p_percent / 100)
            else cost + p_fixed_amount
          end,
          2
        )
      )
      where org_id = p_org_id
        and active = true
        and cost is not null
        and (p_supplier_id is null or default_supplier_id = p_supplier_id)
        and (p_brand is null or trim(p_brand) = '' or brand = p_brand);
  end if;

  get diagnostics v_count = row_count;

  perform set_config('pesito.bulk_change_id', '', true);

  -- Un aumento que no tocó nada no tiene nada que deshacer.
  if v_count = 0 then
    delete from bulk_price_changes where id = v_change_id;
  else
    update bulk_price_changes set product_count = v_count where id = v_change_id;
  end if;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_increase_cost_with_price(p_org_id uuid, p_supplier_id uuid DEFAULT NULL::uuid, p_brand text DEFAULT NULL::text, p_percent numeric DEFAULT NULL::numeric, p_fixed_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_brand text := nullif(trim(coalesce(p_brand, '')), '');
  v_cost_change_id uuid;
  v_price_change_id uuid;
  v_cost_count integer;
  v_price_count integer;
begin
  perform public.require_plan(p_org_id, 'pro', 'usar los aumentos masivos');
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_supplier_id is null and v_brand is null then
    raise exception 'elegí un proveedor o una marca';
  end if;

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el valor a 0 o menos';
  end if;

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (p_org_id, 'cost', p_supplier_id, v_brand, p_percent, p_fixed_amount, auth.uid())
  returning id into v_cost_change_id;

  insert into bulk_price_changes (org_id, field, supplier_id, brand, percent, fixed_amount, created_by)
  values (
    p_org_id, 'price', p_supplier_id, v_brand,
    p_percent, null, auth.uid()
  )
  returning id into v_price_change_id;

  -- Primero el precio, que necesita el costo anterior para la proporción.
  perform set_config('pesito.bulk_change_id', v_price_change_id::text, true);

  update products
    set price = greatest(
      0,
      round(
        price * greatest(
          0,
          case
            when p_percent is not null then cost * (1 + p_percent / 100)
            else cost + p_fixed_amount
          end
        ) / cost,
        2
      )
    )
    where org_id = p_org_id
      and active = true
      and cost is not null
      and cost > 0
      and (p_supplier_id is null or default_supplier_id = p_supplier_id)
      and (v_brand is null or brand = v_brand);

  get diagnostics v_price_count = row_count;

  perform set_config('pesito.bulk_change_id', v_cost_change_id::text, true);

  update products
    set cost = greatest(
      0,
      round(
        case
          when p_percent is not null then cost * (1 + p_percent / 100)
          else cost + p_fixed_amount
        end,
        2
      )
    )
    where org_id = p_org_id
      and active = true
      and cost is not null
      and cost > 0
      and (p_supplier_id is null or default_supplier_id = p_supplier_id)
      and (v_brand is null or brand = v_brand);

  get diagnostics v_cost_count = row_count;

  perform set_config('pesito.bulk_change_id', '', true);

  if v_cost_count = 0 then
    delete from bulk_price_changes where id in (v_cost_change_id, v_price_change_id);
  else
    update bulk_price_changes set product_count = v_cost_count where id = v_cost_change_id;
    update bulk_price_changes set product_count = v_price_count where id = v_price_change_id;
  end if;

  if v_cost_count > 0 and v_price_count = 0 then
    delete from bulk_price_changes where id = v_price_change_id;
  end if;

  return jsonb_build_object('cost_count', v_cost_count, 'price_count', v_price_count);
end;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_increase_price_by_supplier(p_org_id uuid, p_supplier_id uuid, p_percent numeric DEFAULT NULL::numeric, p_fixed_amount numeric DEFAULT NULL::numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  perform public.require_plan(p_org_id, 'pro', 'usar los aumentos masivos');
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if p_percent is null and p_fixed_amount is null then
    raise exception 'elegí un porcentaje o un monto fijo';
  end if;

  if p_percent is not null and p_percent <= -100 then
    raise exception 'el porcentaje no puede bajar el precio a 0 o menos';
  end if;

  update products
    set price = greatest(
      0,
      round(
        case
          when p_percent is not null then price * (1 + p_percent / 100)
          else price + p_fixed_amount
        end,
        2
      )
    )
    where org_id = p_org_id
      and default_supplier_id = p_supplier_id
      and active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.live_overview(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_today timestamptz;
  v_yesterday timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
  v_main uuid;
begin
  perform public.require_plan(p_org_id, 'pro', 'ver En vivo');
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;

  v_main := public.main_branch_id(p_org_id);
  v_today := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;
  v_yesterday := v_today - interval '1 day';

  with today_sales as (
    select s.id, s.user_id, s.total, s.payment_method, s.created_at, s.cash_register_id, s.branch_id
    from sales s
    where s.org_id = p_org_id
      and s.status = 'completada'
      and s.created_at >= v_today
  ),
  registers as (
    -- Cajas abiertas (aunque se hayan abierto otro día) y las cerradas hoy.
    select r.id, r.user_id, r.branch_id, r.status, r.opened_at, r.closed_at,
      r.opening_amount, r.closing_amount, r.expected_amount
    from cash_registers r
    where r.org_id = p_org_id
      and (r.status = 'abierta' or r.closed_at >= v_today)
  ),
  register_sales as (
    -- Lo vendido en cada caja (una abierta desde ayer suma todo lo suyo).
    select s.cash_register_id, count(*) as sales_count, sum(s.total) as sales_total
    from sales s
    where s.cash_register_id in (select id from registers)
      and s.status = 'completada'
    group by s.cash_register_id
  ),
  open_cash as (
    select cs.cash_register_id,
      r.opening_amount + cs.sales_cash + cs.debt_payments + cs.ingresos
        - cs.retiros - cs.supplier_payments - cs.cash_purchases as cash
    from public.cash_register_summaries(
      array(select id from registers where status = 'abierta')
    ) cs
    join registers r on r.id = cs.cash_register_id
  ),
  per_user as (
    select m.user_id,
      coalesce(
        (select r.branch_id from registers r
          where r.user_id = m.user_id and r.status = 'abierta'
          order by r.opened_at desc limit 1),
        m.branch_id,
        v_main
      ) as branch_id,
      coalesce(m.username, m.email) as label,
      m.role,
      coalesce(st.sales_count, 0) as sales_count,
      coalesce(st.sales_total, 0) as sales_total,
      st.last_sale_at,
      (
        select jsonb_build_object(
          'id', r.id,
          'branch_id', r.branch_id,
          'opened_at', r.opened_at,
          'opening_amount', r.opening_amount,
          'cash', oc.cash,
          'sales_count', coalesce(rs.sales_count, 0),
          'sales_total', coalesce(rs.sales_total, 0)
        )
        from registers r
        left join open_cash oc on oc.cash_register_id = r.id
        left join register_sales rs on rs.cash_register_id = r.id
        where r.user_id = m.user_id and r.status = 'abierta'
        order by r.opened_at desc
        limit 1
      ) as open_register,
      (
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'branch_id', r.branch_id,
          'opened_at', r.opened_at,
          'closed_at', r.closed_at,
          'closing_amount', r.closing_amount,
          'difference', coalesce(r.closing_amount, 0) - coalesce(r.expected_amount, 0),
          'sales_count', coalesce(rs.sales_count, 0),
          'sales_total', coalesce(rs.sales_total, 0)
        ) order by r.closed_at)
        from registers r
        left join register_sales rs on rs.cash_register_id = r.id
        where r.user_id = m.user_id and r.status = 'cerrada'
      ) as closed_today,
      (
        select jsonb_object_agg(x.branch_id, jsonb_build_object(
          'count', x.sales_count, 'total', x.sales_total, 'last_sale_at', x.last_sale_at))
        from (
          select ts.branch_id, count(*) as sales_count, sum(ts.total) as sales_total,
            max(ts.created_at) as last_sale_at
          from today_sales ts
          where ts.user_id = m.user_id and ts.branch_id is not null
          group by ts.branch_id
        ) x
      ) as by_branch
    from memberships m
    left join (
      select ts.user_id,
        count(*) as sales_count,
        sum(ts.total) as sales_total,
        max(ts.created_at) as last_sale_at
      from today_sales ts
      group by ts.user_id
    ) st on st.user_id = m.user_id
    where m.org_id = p_org_id
  ),
  recent as (
    select ts.id, ts.user_id, ts.branch_id, ts.total, ts.payment_method, ts.created_at,
      (
        select string_agg(
          case when si.quantity = 1 then si.product_name
               else si.product_name || ' x' || trim(to_char(si.quantity, 'FM999990.###')) end,
          ', ' order by si.id)
        from sale_items si
        where si.sale_id = ts.id
      ) as items
    from today_sales ts
    order by ts.created_at desc
    limit 10
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'today', jsonb_build_object(
      'count', (select count(*) from today_sales),
      'total', coalesce((select sum(total) from today_sales), 0)
    ),
    'yesterday_same_time', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(s.total), 0))
      from sales s
      where s.org_id = p_org_id
        and s.status = 'completada'
        and s.created_at >= v_yesterday
        and s.created_at < v_now - interval '1 day'
    ),
    'by_hour', (
      select jsonb_agg(coalesce(h.total, 0) order by g.hour)
      from generate_series(0, 23) as g(hour)
      left join (
        select extract(hour from ts.created_at at time zone v_tz)::int as hour, sum(ts.total) as total
        from today_sales ts
        group by 1
      ) h on h.hour = g.hour
    ),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'is_main', b.is_main,
        'count', (select count(*) from today_sales ts where ts.branch_id = b.id),
        'total', coalesce((select sum(ts.total) from today_sales ts where ts.branch_id = b.id), 0),
        'yesterday_total', coalesce((
          select sum(s.total) from sales s
          where s.org_id = p_org_id and s.branch_id = b.id and s.status = 'completada'
            and s.created_at >= v_yesterday and s.created_at < v_now - interval '1 day'
        ), 0),
        'open_registers', (select count(*) from registers r where r.branch_id = b.id and r.status = 'abierta'),
        'by_hour', (
          select jsonb_agg(coalesce(h.total, 0) order by g.hour)
          from generate_series(0, 23) as g(hour)
          left join (
            select extract(hour from ts.created_at at time zone v_tz)::int as hour, sum(ts.total) as total
            from today_sales ts
            where ts.branch_id = b.id
            group by 1
          ) h on h.hour = g.hour
        )
      ) order by b.is_main desc, b.name)
      from branches b
      where b.org_id = p_org_id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pu.user_id,
        'branch_id', pu.branch_id,
        'label', pu.label,
        'role', pu.role,
        'sales_count', pu.sales_count,
        'sales_total', pu.sales_total,
        'last_sale_at', pu.last_sale_at,
        'open_register', pu.open_register,
        'closed_today', coalesce(pu.closed_today, '[]'::jsonb),
        'by_branch', coalesce(pu.by_branch, '{}'::jsonb)
      ) order by (pu.open_register is null), pu.sales_total desc)
      from per_user pu
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'branch_id', r.branch_id,
        'total', r.total,
        'payment_method', r.payment_method,
        'created_at', r.created_at,
        'items', r.items
      ) order by r.created_at desc)
      from recent r
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_purchase(p_org_id uuid, p_supplier_id uuid, p_items jsonb, p_notes text DEFAULT NULL::text, p_cash_register_id uuid DEFAULT NULL::uuid, p_payments jsonb DEFAULT NULL::jsonb, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_purchase_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_unit_cost numeric;
  v_pay jsonb;
  v_pay_sum numeric := 0;
  v_account_amount numeric := 0;
  v_method text;
  v_amount numeric;
  v_methods text[] := '{}';
  v_payment_method text;
  v_branch_id uuid;
begin
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) e
    where e->>'method' = 'cuenta_corriente' and coalesce((e->>'amount')::numeric, 0) > 0
  ) then
    perform public.require_plan(p_org_id, 'esencial', 'usar la cuenta corriente con proveedores');
  end if;
  if not public.is_org_member(p_org_id) then
    raise exception 'no pertenece a esta organización';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'la compra no tiene productos';
  end if;

  -- Sucursales (0043): la mercadería entra en la sucursal de la caja con la
  -- que se paga, o en la que se eligió, o en la principal.
  if p_cash_register_id is not null then
    select branch_id into v_branch_id
      from cash_registers where id = p_cash_register_id and org_id = p_org_id;
  end if;
  if v_branch_id is null and p_branch_id is not null then
    select id into v_branch_id from branches where id = p_branch_id and org_id = p_org_id;
  end if;
  v_branch_id := coalesce(v_branch_id, public.main_branch_id(p_org_id));
  perform public.set_stock_branch(v_branch_id);

  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'elegí cómo se paga la compra';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item ->> 'quantity')::numeric <= 0 then
      raise exception 'la cantidad tiene que ser mayor a cero';
    end if;
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_cost')::numeric;
  end loop;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_method := v_pay ->> 'method';
    v_amount := (v_pay ->> 'amount')::numeric;

    if v_method not in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'cuenta_corriente')
       and not exists (
         select 1 from payment_methods where org_id = p_org_id and name = v_method
       ) then
      raise exception 'medio de pago inválido';
    end if;

    v_pay_sum := v_pay_sum + v_amount;

    if v_amount > 0 then
      if v_method = 'cuenta_corriente' then
        v_account_amount := v_account_amount + v_amount;
      elsif not (v_method = any(v_methods)) then
        v_methods := array_append(v_methods, v_method);
      end if;
    end if;
  end loop;

  if abs(v_pay_sum - v_subtotal) > 0.01 then
    raise exception 'la suma de los medios de pago no coincide con el total de la compra';
  end if;

  if v_account_amount > 0 and p_supplier_id is null then
    raise exception 'para dejar saldo a cuenta corriente primero elegí un proveedor';
  end if;

  if 'efectivo' = any(v_methods) and p_cash_register_id is null then
    raise exception 'abrí tu caja para poder pagar en efectivo';
  end if;

  v_payment_method := case
    when array_length(v_methods, 1) is null then null
    when array_length(v_methods, 1) = 1 then v_methods[1]
    else 'mixto'
  end;

  insert into purchases (
    org_id, supplier_id, user_id, subtotal, total, notes, account_amount,
    cash_register_id, payment_method
  )
  values (
    p_org_id, p_supplier_id, auth.uid(), v_subtotal, v_subtotal, nullif(p_notes, ''), v_account_amount,
    p_cash_register_id, v_payment_method
  )
  returning id into v_purchase_id;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    if (v_pay ->> 'amount')::numeric > 0 then
      insert into purchase_payments (org_id, purchase_id, cash_register_id, method, amount)
      values (p_org_id, v_purchase_id, p_cash_register_id, v_pay ->> 'method', (v_pay ->> 'amount')::numeric);
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_cost := (v_item ->> 'unit_cost')::numeric;

    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and org_id = p_org_id
      for update;

    if v_product.id is null then
      raise exception 'producto no encontrado';
    end if;

    insert into purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, subtotal)
    values (
      v_purchase_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_unit_cost,
      v_quantity * v_unit_cost
    );

    update products
      set stock = stock + v_quantity, cost = v_unit_cost
      where id = v_product.id;

    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id)
    values (p_org_id, v_product.id, 'compra', v_quantity, v_purchase_id::text, auth.uid());
  end loop;

  if v_account_amount > 0 then
    update suppliers set balance = balance + v_account_amount where id = p_supplier_id;
  end if;

  return v_purchase_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_stock(p_from_branch_id uuid, p_to_branch_id uuid, p_items jsonb, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org_id uuid;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity numeric;
  v_stock numeric;
  v_from_name text;
  v_to_name text;
begin
  select org_id, name into v_org_id, v_from_name from branches where id = p_from_branch_id;
  if v_org_id is not null then
    perform public.require_plan(v_org_id, 'ia', 'pasar mercadería entre sucursales');
  end if;
  select name into v_to_name from branches where id = p_to_branch_id and org_id = v_org_id;

  if v_org_id is null or v_to_name is null then
    raise exception 'sucursal no encontrada';
  end if;

  if not public.is_org_admin(v_org_id) then
    raise exception 'no tenés permiso para transferir stock';
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'elegí dos sucursales distintas';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'la transferencia no tiene productos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'la cantidad tiene que ser mayor a cero';
    end if;

    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and org_id = v_org_id
      for update;
    if v_product.id is null then
      raise exception 'producto no encontrado';
    end if;

    select stock into v_stock from branch_stock
      where branch_id = p_from_branch_id and product_id = v_product.id
      for update;
    if coalesce(v_stock, 0) < v_quantity then
      raise exception 'no hay stock suficiente de % en %', v_product.name, v_from_name;
    end if;

    perform public.set_stock_branch(p_from_branch_id);
    update products set stock = stock - v_quantity where id = v_product.id;
    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
    values (v_org_id, v_product.id, 'transferencia', -v_quantity,
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'A ' || v_to_name), auth.uid(), p_from_branch_id);

    perform public.set_stock_branch(p_to_branch_id);
    update products set stock = stock + v_quantity where id = v_product.id;
    insert into stock_movements (org_id, product_id, type, quantity, reference, user_id, branch_id)
    values (v_org_id, v_product.id, 'transferencia', v_quantity,
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Desde ' || v_from_name), auth.uid(), p_to_branch_id);
  end loop;

  perform public.set_stock_branch(null);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_branch(p_org_id uuid, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para crear sucursales';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'ponele un nombre a la sucursal';
  end if;

  perform public.main_branch_id(p_org_id);

  perform public.require_plan(p_org_id, 'ia', 'sumar sucursales');
  if (select count(*) from branches where org_id = p_org_id) >= public.plan_limit(p_org_id, 'branches') then
    raise exception 'Tu plan incluye hasta % sucursales', public.plan_limit(p_org_id, 'branches');
  end if;

  if exists (select 1 from branches where org_id = p_org_id and lower(name) = lower(trim(p_name))) then
    raise exception 'ya hay una sucursal con ese nombre';
  end if;

  insert into branches (org_id, name) values (p_org_id, trim(p_name)) returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_invitation(p_org_id uuid, p_role text)
 RETURNS invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invitation invitations%rowtype;
  v_code text;
begin
  perform public.require_user_slot(p_org_id);
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para invitar usuarios en esta organización';
  end if;

  if p_role not in ('admin', 'vendedor') then
    raise exception 'rol inválido';
  end if;

  v_code := left(replace(gen_random_uuid()::text, '-', ''), 10);

  insert into invitations (org_id, code, role, created_by)
  values (p_org_id, v_code, p_role, auth.uid())
  returning * into v_invitation;

  return v_invitation;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_member_direct(p_org_id uuid, p_user_id uuid, p_role text, p_username text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.require_user_slot(p_org_id);
  if not public.is_org_admin(p_org_id) then
    raise exception 'no tenés permiso para agregar usuarios en esta organización';
  end if;

  if p_role not in ('admin', 'vendedor') then
    raise exception 'rol inválido';
  end if;

  if exists (select 1 from memberships where org_id = p_org_id and user_id = p_user_id) then
    raise exception 'ese usuario ya pertenece a esta organización';
  end if;

  insert into memberships (org_id, user_id, role, username)
  values (p_org_id, p_user_id, p_role, p_username);
end;
$function$;
