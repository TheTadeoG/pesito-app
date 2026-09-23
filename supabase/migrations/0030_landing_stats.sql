-- Pesito: contador de uso real para la landing ("+X kioscos usan Pesito",
-- "+Y ventas registradas"). Fila única (singleton) con un offset por
-- métrica: se suma al conteo real que ya sabe calcular el sistema
-- (organizations/sales), para poder incluir números reales que todavía no
-- están cargados en el sistema (ej: kioscos de antes de tener altas
-- formales). Se administra desde /admin, con la service role — no hay
-- policies de insert/update/delete para anon/authenticated a propósito.
-- Corre sobre una base que ya tiene 0001..0029 aplicadas.

create table if not exists landing_stats (
  id text primary key default 'main',
  kioscos_offset integer not null default 0,
  ventas_offset integer not null default 0,
  monto_offset numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint landing_stats_singleton check (id = 'main')
);

insert into landing_stats (id) values ('main')
  on conflict (id) do nothing;

alter table landing_stats enable row level security;

-- La landing es pública: cualquiera puede leer el contador.
create policy "anyone can view landing stats"
  on landing_stats for select
  using (true);

drop trigger if exists landing_stats_set_updated_at on landing_stats;
create trigger landing_stats_set_updated_at
  before update on landing_stats
  for each row execute function public.handle_updated_at();
