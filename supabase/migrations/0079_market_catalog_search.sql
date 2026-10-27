-- Buscador de productos en los supermercados (tipo ratoneando.ar). Mismo almacén que 0078
-- (market_prices): además de los EAN de los negocios, el cron recorre el catálogo de cada súper por
-- categorías y guarda cada producto con código de barras y precio, así se puede buscar por nombre.
-- market_crawl guarda hasta dónde llegó el recorrido de cada categoría en el mes (para retomarlo).
-- Se lee con market_search (plan Pro, con límite de ritmo); la tabla de avance sólo la toca el cron.

create extension if not exists pg_trgm with schema extensions;

-- Para buscar sin importar mayúsculas ni tildes.
create or replace function public.norm_text(t text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(lower(coalesce(t, '')), 'áéíóúüñ', 'aeiouun')
$$;

create index if not exists market_prices_name_trgm_idx
  on public.market_prices using gin (public.norm_text(name) extensions.gin_trgm_ops)
  where found;

create table if not exists public.market_crawl (
  store text not null check (char_length(store) <= 30),
  month date not null,
  category text not null check (char_length(category) <= 100),
  name text,
  next_from integer not null default 0,
  done boolean not null default false,
  items integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store, month, category)
);

alter table public.market_crawl enable row level security;
revoke all on public.market_crawl from anon, authenticated;

create or replace function public.market_search(p_org_id uuid, p_query text, p_limit int, p_offset int)
returns table (
  ean text,
  name text,
  brand text,
  image_url text,
  min_price numeric,
  stores jsonb,
  total bigint
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_words text[];
  v_p1 text := '%';
  v_p2 text := '%';
  v_p3 text := '%';
  v_p4 text := '%';
  v_since date := (date_trunc('month', now()) - interval '2 months')::date;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  perform public.require_plan(p_org_id, 'pro', 'buscar productos en los supermercados');
  perform public.rate_limit_hit(p_org_id, 'market_search', 150, 3600);

  -- Hasta 4 palabras de 2 letras o más, sin comodines del usuario.
  v_words := array(
    select w from unnest(regexp_split_to_array(regexp_replace(public.norm_text(trim(coalesce(p_query, ''))), '[%_\\]', '', 'g'), '\s+')) w
    where char_length(w) >= 2
    limit 4
  );
  if coalesce(array_length(v_words, 1), 0) = 0 then
    return;
  end if;
  v_p1 := '%' || v_words[1] || '%';
  if array_length(v_words, 1) >= 2 then v_p2 := '%' || v_words[2] || '%'; end if;
  if array_length(v_words, 1) >= 3 then v_p3 := '%' || v_words[3] || '%'; end if;
  if array_length(v_words, 1) >= 4 then v_p4 := '%' || v_words[4] || '%'; end if;

  return query
  with latest as (
    select distinct on (m.ean, m.store)
      m.ean, m.store, m.price, m.name, m.brand, m.image_url, m.url, m.available
    from public.market_prices m
    where m.found
      and m.month >= v_since
      and public.norm_text(m.name) like v_p1
      and public.norm_text(m.name) like v_p2
      and public.norm_text(m.name) like v_p3
      and public.norm_text(m.name) like v_p4
    order by m.ean, m.store, m.month desc
  ),
  grouped as (
    select
      l.ean,
      (array_agg(l.name order by char_length(l.name)))[1] as name,
      max(l.brand) as brand,
      max(l.image_url) as image_url,
      min(l.price) as min_price,
      jsonb_agg(jsonb_build_object('store', l.store, 'price', l.price, 'url', l.url, 'available', l.available) order by l.price) as stores
    from latest l
    group by l.ean
  )
  select g.ean, g.name, g.brand, g.image_url, g.min_price, g.stores, count(*) over () as total
  from grouped g
  order by g.min_price, g.name
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.market_search(uuid, text, int, int) from public, anon;
grant execute on function public.market_search(uuid, text, int, int) to authenticated;
