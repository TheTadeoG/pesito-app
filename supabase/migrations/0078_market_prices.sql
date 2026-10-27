-- Precios de supermercados por EAN (código de barras), una foto por mes.
-- Los junta /api/cron/market-prices (service role) consultando, en cada súper, sólo los EAN que ya
-- existen en algún producto de Pesito. `found = false` anota que ese súper no lo tiene, para no
-- volver a preguntar en el mismo mes. Nadie escribe ni lee la tabla directo: se lee con
-- market_prices_for (plan Pro) y la escribe el cron.

create table if not exists public.market_prices (
  ean text not null check (ean ~ '^[0-9]{8,14}$'),
  store text not null check (char_length(store) <= 30),
  month date not null,
  found boolean not null default true,
  price numeric(14, 2),
  list_price numeric(14, 2),
  name text,
  brand text,
  url text,
  image_url text,
  available boolean not null default true,
  scraped_at timestamptz not null default now(),
  primary key (ean, store, month),
  check (not found or price is not null)
);

create index if not exists market_prices_ean_month_idx on public.market_prices (ean, month desc);

alter table public.market_prices enable row level security;
revoke all on public.market_prices from anon, authenticated;

-- EAN de productos activos de cualquier negocio que todavía no tienen todos los súper del mes.
-- Sólo la service role (el cron).
create or replace function public.market_pending_eans(p_month date, p_stores int, p_limit int)
returns table (ean text)
language sql
stable
security definer
set search_path = public
as $$
  select b.barcode
  from (
    select distinct barcode from public.products
    where barcode ~ '^[0-9]{8,14}$' and coalesce(active, true)
  ) b
  left join (
    select mp.ean, count(*) as n from public.market_prices mp where mp.month = p_month group by mp.ean
  ) d on d.ean = b.barcode
  where coalesce(d.n, 0) < p_stores
  order by coalesce(d.n, 0), b.barcode
  limit greatest(1, least(p_limit, 200));
$$;

revoke all on function public.market_pending_eans(date, int, int) from public, anon, authenticated;
grant execute on function public.market_pending_eans(date, int, int) to service_role;

-- Último precio encontrado de cada EAN en cada súper (los últimos 2 meses), para el negocio que
-- pide. Plan Pro.
create or replace function public.market_prices_for(p_org_id uuid, p_eans text[])
returns table (
  ean text,
  store text,
  month date,
  price numeric,
  list_price numeric,
  name text,
  brand text,
  url text,
  available boolean,
  scraped_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  perform public.require_plan(p_org_id, 'pro', 'ver los precios de los supermercados');
  perform public.rate_limit_hit(p_org_id, 'market_prices', 240, 3600);
  if p_eans is null or array_length(p_eans, 1) is null then
    return;
  end if;
  if array_length(p_eans, 1) > 300 then
    raise exception 'demasiados códigos';
  end if;

  return query
  select distinct on (m.ean, m.store)
    m.ean, m.store, m.month, m.price, m.list_price, m.name, m.brand, m.url, m.available, m.scraped_at
  from public.market_prices m
  where m.ean = any (p_eans)
    and m.found
    and m.month >= (date_trunc('month', now())::date - interval '2 months')
  order by m.ean, m.store, m.month desc;
end;
$$;

revoke all on function public.market_prices_for(uuid, text[]) from public, anon;
grant execute on function public.market_prices_for(uuid, text[]) to authenticated;
