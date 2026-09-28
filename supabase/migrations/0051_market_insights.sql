-- Pesito 0051: análisis de mercado (Plan IA).
--
-- Notas que carga Pesito desde /admin (información que recolectamos
-- nosotros, con IA o a mano: precios de referencia, tendencias por rubro,
-- fechas fuertes). Los negocios no se conectan a ninguna IA: sólo leen.
--
-- La tabla no tiene policies (sólo la service role la toca); la lectura
-- pasa por market_insights_for, que exige plan IA y filtra por el rubro del
-- negocio (business_type null = para todos los rubros).
-- Objetos nuevos: compatible con la app anterior.

create table if not exists market_insights (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 10 and 4000),
  business_type text,
  source text,
  published_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists market_insights_published_idx on market_insights (published_at desc);

alter table market_insights enable row level security;

create or replace function public.market_insights_for(p_org_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  business_type text,
  source text,
  published_at date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'no tenés permiso para ver esta información';
  end if;
  perform public.require_plan(p_org_id, 'ia', 'ver el análisis de mercado');

  select o.business_type into v_type from organizations o where o.id = p_org_id;

  return query
  select m.id, m.title, m.body, m.business_type, m.source, m.published_at
  from market_insights m
  where m.business_type is null or m.business_type = v_type
  order by m.published_at desc, m.created_at desc
  limit 50;
end;
$$;

revoke all on function public.market_insights_for(uuid) from public, anon;
grant execute on function public.market_insights_for(uuid) to authenticated;
