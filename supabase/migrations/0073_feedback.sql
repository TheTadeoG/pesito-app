-- Sugerencias y reportes de problemas de los negocios.
--
-- La tabla no tiene policies: nadie la lee ni la escribe con su sesión. Se envía
-- con submit_feedback (security definer), que exige ser miembro del negocio, limita
-- el largo y el ritmo (10 por día por negocio) y guarda quién lo mandó. La bandeja de
-- /admin lee con la service role. Es para todos los planes (no hay feature en
-- featureMinPlan).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  contact_email text,
  kind text not null check (kind in ('suggestion', 'problem')),
  message text not null check (char_length(message) between 5 and 2000),
  page text check (page is null or char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_org_idx on public.feedback (org_id);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(
  p_org_id uuid,
  p_kind text,
  p_message text,
  p_page text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;
  if p_kind not in ('suggestion', 'problem') then
    raise exception 'tipo de mensaje inválido';
  end if;
  if char_length(v_message) < 5 then
    raise exception 'el mensaje es muy corto';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'el mensaje es muy largo (máximo 2000 caracteres)';
  end if;

  -- Exige ser miembro del negocio y corta el exceso (P0429).
  perform public.rate_limit_hit(p_org_id, 'feedback', 10, 86400);

  insert into public.feedback (org_id, user_id, contact_email, kind, message, page)
  values (
    p_org_id,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    p_kind,
    v_message,
    nullif(left(btrim(coalesce(p_page, '')), 200), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_feedback(uuid, text, text, text) from public, anon;
grant execute on function public.submit_feedback(uuid, text, text, text) to authenticated;
