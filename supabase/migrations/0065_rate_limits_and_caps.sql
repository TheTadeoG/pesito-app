-- Protección contra abusos: límite de ritmo por negocio y topes técnicos.
--
-- 1) rate_limit_hit: contador por negocio y tipo de pedido, en ventanas fijas.
--    Es una tabla UNLOGGED (no escribe en el log de la base: casi no cuesta) y
--    sólo se usa en lo pesado (Reportes, catálogo del POS, En vivo, cargas
--    masivas), nunca en cada venta. Pasado el límite responde con el código
--    P0429 y "demasiados pedidos".
-- 2) Las funciones que llama el navegador directo (report_overview, pos_catalog,
--    live_pulse, live_overview) pasan a envolverse: la función original queda
--    como *_raw (sin acceso para los usuarios) y la de siempre cuenta antes de
--    llamarla. Mismos nombres y parámetros: el código de la app no cambia.
-- 3) Topes técnicos por negocio (clientes, proveedores, marcas, categorías):
--    un usuario con su sesión puede insertar filas directo en la API sin pasar
--    por la app; esto corta el exceso (muy por arriba de lo que usa un negocio
--    real).

create unlogged table if not exists public.rate_limits (
  org_id uuid not null references public.organizations (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (org_id, bucket)
);
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_org_id uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  -- Sin esto, cualquiera podría gastarle el cupo a otro negocio.
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;

  insert into rate_limits as r (org_id, bucket, window_start, hits)
  values (p_org_id, p_bucket, now(), 1)
  on conflict (org_id, bucket) do update
    set window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start end,
        hits = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.hits + 1 end
  returning r.hits into v_hits;

  -- Si se pasa, la excepción deshace también este conteo: el contador queda en
  -- el máximo y los pedidos siguientes siguen cortados hasta que termina la ventana.
  if v_hits > p_max then
    raise exception 'demasiados pedidos: esperá unos segundos y probá de nuevo'
      using errcode = 'P0429';
  end if;
end;
$$;

grant execute on function public.rate_limit_hit(uuid, text, integer, integer) to authenticated;

-- Envolver las funciones pesadas (sólo si todavía no están envueltas).
do $$
begin
  if to_regprocedure('public.report_overview_raw(uuid, timestamptz, timestamptz, uuid, uuid, text)') is null then
    alter function public.report_overview(uuid, timestamptz, timestamptz, uuid, uuid, text) rename to report_overview_raw;
  end if;
  if to_regprocedure('public.pos_catalog_raw(uuid, uuid, timestamptz)') is null then
    alter function public.pos_catalog(uuid, uuid, timestamptz) rename to pos_catalog_raw;
  end if;
  if to_regprocedure('public.live_pulse_raw(uuid)') is null then
    alter function public.live_pulse(uuid) rename to live_pulse_raw;
  end if;
  if to_regprocedure('public.live_overview_raw(uuid)') is null then
    alter function public.live_overview(uuid) rename to live_overview_raw;
  end if;
end $$;

create or replace function public.report_overview(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_seller uuid default null,
  p_branch uuid default null,
  p_group text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rate_limit_hit(p_org_id, 'reportes', 20, 60);
  return public.report_overview_raw(p_org_id, p_start, p_end, p_seller, p_branch, p_group);
end;
$$;

create or replace function public.pos_catalog(
  p_org_id uuid,
  p_branch_id uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rate_limit_hit(p_org_id, 'catalogo_pos', 30, 60);
  return public.pos_catalog_raw(p_org_id, p_branch_id, p_since);
end;
$$;

create or replace function public.live_pulse(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rate_limit_hit(p_org_id, 'en_vivo_aviso', 30, 60);
  return public.live_pulse_raw(p_org_id);
end;
$$;

create or replace function public.live_overview(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rate_limit_hit(p_org_id, 'en_vivo', 12, 60);
  return public.live_overview_raw(p_org_id);
end;
$$;

-- Las originales ya no se llaman directo: sin esto se saltearían el límite.
revoke all on function public.report_overview_raw(uuid, timestamptz, timestamptz, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.pos_catalog_raw(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.live_pulse_raw(uuid) from public, anon, authenticated;
revoke all on function public.live_overview_raw(uuid) from public, anon, authenticated;

grant execute on function public.report_overview(uuid, timestamptz, timestamptz, uuid, uuid, text) to authenticated;
grant execute on function public.pos_catalog(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.live_pulse(uuid) to authenticated;
grant execute on function public.live_overview(uuid) to authenticated;

-- Topes técnicos por negocio.
create or replace function public.guard_org_row_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer := tg_argv[0]::integer;
  v_label text := tg_argv[1];
  r record;
  v_count bigint;
begin
  for r in select org_id from new_rows group by org_id loop
    execute format('select count(*) from public.%I where org_id = $1', tg_table_name)
      into v_count using r.org_id;
    if v_count > v_cap then
      raise exception 'Llegaste al máximo de % por negocio (%). Escribinos a soporte si necesitás más.',
        v_label, v_cap
        using errcode = 'P0430';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists customers_row_cap on public.customers;
create trigger customers_row_cap after insert on public.customers
  referencing new table as new_rows
  for each statement execute function public.guard_org_row_cap('50000', 'clientes');

drop trigger if exists suppliers_row_cap on public.suppliers;
create trigger suppliers_row_cap after insert on public.suppliers
  referencing new table as new_rows
  for each statement execute function public.guard_org_row_cap('5000', 'proveedores');

drop trigger if exists brands_row_cap on public.brands;
create trigger brands_row_cap after insert on public.brands
  referencing new table as new_rows
  for each statement execute function public.guard_org_row_cap('5000', 'marcas');

drop trigger if exists categories_row_cap on public.categories;
create trigger categories_row_cap after insert on public.categories
  referencing new table as new_rows
  for each statement execute function public.guard_org_row_cap('2000', 'categorías');
