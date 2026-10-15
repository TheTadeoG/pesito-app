-- Avisos configurables: cuáles están prendidos y con qué umbral (margen bajo, días sin
-- cambiar el costo, días sin ventas), por negocio y por módulo. El detalle de cada aviso
-- vive en la app (lib/alert-config.ts, que también valida); acá sólo se guarda un jsonb
-- { "<id del aviso>": { "enabled": bool, "value": número } }.
--
-- Leen los miembros del negocio (la campana y las pantallas lo necesitan). Nadie escribe
-- directo: se guarda con save_alert_settings (security definer), que pide ser dueño o
-- administrador, el plan que trae la función (Esencial, alertSettings en
-- lib/plan-access.ts), limita el tamaño y el ritmo.

create table if not exists public.alert_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.alert_settings enable row level security;
revoke all on public.alert_settings from anon, authenticated;
grant select on public.alert_settings to authenticated;

drop policy if exists "members can view alert settings" on public.alert_settings;
create policy "members can view alert settings"
  on public.alert_settings for select to authenticated
  using (public.is_org_member(org_id));

create or replace function public.save_alert_settings(p_org_id uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;
  if not public.is_org_admin(p_org_id) then
    raise exception 'Sólo el dueño o un administrador puede cambiar los avisos';
  end if;
  perform public.require_plan(p_org_id, 'esencial', 'configurar los avisos');
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'configuración inválida';
  end if;
  if char_length(p_settings::text) > 4000 then
    raise exception 'configuración demasiado grande';
  end if;

  perform public.rate_limit_hit(p_org_id, 'alert_settings', 30, 3600);

  insert into public.alert_settings (org_id, settings, updated_at, updated_by)
  values (p_org_id, p_settings, now(), auth.uid())
  on conflict (org_id) do update
    set settings = excluded.settings, updated_at = now(), updated_by = auth.uid();
end;
$$;

revoke all on function public.save_alert_settings(uuid, jsonb) from public, anon;
grant execute on function public.save_alert_settings(uuid, jsonb) to authenticated;
