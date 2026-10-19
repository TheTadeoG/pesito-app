-- Errores de la aplicación (servidor y navegador), agrupados: un renglón por error distinto
-- (huella) con cuántas veces pasó y cuándo. Reemplaza, para esta etapa, a una herramienta
-- externa tipo Sentry. Se lee y se resuelve desde /admin/errores.
--
-- Nadie la lee ni la escribe con su sesión: sólo la service role (la app registra con
-- log_app_error; /admin lee y resuelve). La función es atómica: si el error ya existía suma
-- una ocurrencia y, si estaba resuelto, lo reabre (vuelve a avisar).

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  source text not null check (source in ('server', 'client')),
  message text not null,
  stack text,
  path text,
  context text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'resolved'))
);

create index if not exists app_errors_status_seen_idx on public.app_errors (status, last_seen_at desc);

alter table public.app_errors enable row level security;
revoke all on public.app_errors from public, anon, authenticated;

create or replace function public.log_app_error(
  p_fingerprint text,
  p_source text,
  p_message text,
  p_stack text,
  p_path text,
  p_context text
)
returns table (is_new boolean, reopened boolean, occurrences integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_count integer;
begin
  select e.status into v_prev from public.app_errors e where e.fingerprint = p_fingerprint;

  insert into public.app_errors as e (fingerprint, source, message, stack, path, context)
  values (
    p_fingerprint,
    p_source,
    left(p_message, 500),
    left(p_stack, 2500),
    left(p_path, 200),
    left(p_context, 200)
  )
  on conflict (fingerprint) do update
    set occurrences = e.occurrences + 1,
        last_seen_at = now(),
        status = 'new',
        path = coalesce(excluded.path, e.path),
        stack = coalesce(e.stack, excluded.stack)
  returning e.occurrences into v_count;

  return query select (v_prev is null), (v_prev = 'resolved'), v_count;
end;
$$;

revoke all on function public.log_app_error(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_app_error(text, text, text, text, text, text) to service_role;
