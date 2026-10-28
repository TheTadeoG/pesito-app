-- Facturación electrónica con ARCA (ex AFIP) usando el SDK `facturas` (src/lib/arca/*).
-- Cada negocio factura con SU CUIT y SU certificado: acá se guardan, por negocio y por entorno
-- (homologación = test, producción), el CUIT, el punto de venta, la clave privada CIFRADA (la clave de
-- cifrado ARCA_ENCRYPTION_KEY vive sólo en el servidor), la solicitud (CSR) y el certificado.
-- Nadie lee ni escribe estas tablas directo: las usa el servidor con la clave de servicio, después de
-- comprobar que quien pide es dueño o administrador y que el plan lo incluye. La única lectura
-- para la pantalla es arca_status(), que devuelve el estado sin ningún secreto.

create table if not exists public.arca_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  issuer_condition text check (issuer_condition in ('monotributo', 'responsable_inscripto', 'exento')),
  legal_name text check (char_length(legal_name) <= 120),
  address text check (char_length(address) <= 200),
  gross_income text check (char_length(gross_income) <= 30),
  activity_start date,
  active_environment text not null default 'test' check (active_environment in ('test', 'production')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.arca_credentials (
  org_id uuid not null references public.organizations (id) on delete cascade,
  environment text not null check (environment in ('test', 'production')),
  tax_id text check (tax_id ~ '^[0-9]{11}$'),
  sales_point integer check (sales_point between 1 and 99999),
  key_enc text,
  csr_pem text,
  certificate_pem text,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (org_id, environment)
);

-- Almacén del SDK (reservas de números, tickets de WSAA cifrados, resultados) y sus bloqueos.
create table if not exists public.arca_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.arca_locks (
  key text primary key,
  owner text not null,
  expires_at timestamptz not null
);

-- Comprobantes emitidos (o intentados). Se escriben sólo desde el servidor.
create table if not exists public.arca_vouchers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid references public.sales (id) on delete set null,
  environment text not null check (environment in ('test', 'production')),
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note', 'debit_note')),
  status text not null check (status in ('authorized', 'rejected', 'indeterminate', 'conflict', 'error')),
  idempotency_key text not null,
  sales_point integer,
  voucher_type integer,
  voucher_class text,
  number integer,
  cae text,
  cae_expiry date,
  qr text,
  total_cents bigint,
  receiver jsonb,
  items jsonb,
  detail jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create index if not exists arca_vouchers_org_created_idx on public.arca_vouchers (org_id, created_at desc);
create index if not exists arca_vouchers_sale_idx on public.arca_vouchers (sale_id) where sale_id is not null;

alter table public.arca_settings enable row level security;
alter table public.arca_credentials enable row level security;
alter table public.arca_store enable row level security;
alter table public.arca_locks enable row level security;
alter table public.arca_vouchers enable row level security;
revoke all on public.arca_settings, public.arca_credentials, public.arca_store, public.arca_locks from anon, authenticated;
revoke all on public.arca_vouchers from anon, authenticated;
-- Los comprobantes sí los puede leer cualquier miembro del negocio (para ver el CAE de una venta).
grant select on public.arca_vouchers to authenticated;
drop policy if exists "members can view vouchers" on public.arca_vouchers;
create policy "members can view vouchers"
  on public.arca_vouchers for select to authenticated
  using (public.is_org_member(org_id));

-- Estado para la pantalla (dueño o administrador), sin secretos.
create or replace function public.arca_status(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Sólo el dueño o un administrador puede ver esto';
  end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'updated_by' from public.arca_settings s where s.org_id = p_org_id),
    'credentials', coalesce(
      (select jsonb_object_agg(
         c.environment,
         jsonb_build_object(
           'tax_id', c.tax_id,
           'sales_point', c.sales_point,
           'has_key', c.key_enc is not null,
           'csr_pem', c.csr_pem,
           'has_certificate', c.certificate_pem is not null,
           'verified_at', c.verified_at
         ))
       from public.arca_credentials c where c.org_id = p_org_id),
      '{}'::jsonb)
  );
end;
$$;

revoke all on function public.arca_status(uuid) from public, anon;
grant execute on function public.arca_status(uuid) to authenticated;

-- Piezas del almacén del SDK: sólo la clave de servicio.
create or replace function public.arca_store_add(p_key text, p_value text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  insert into public.arca_store (key, value) values (p_key, p_value)
  on conflict (key) do nothing
  returning 1 into v;
  return v is not null;
end;
$$;

create or replace function public.arca_lock_acquire(p_key text, p_owner text, p_ttl_ms integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  insert into public.arca_locks (key, owner, expires_at)
  values (p_key, p_owner, now() + make_interval(secs => greatest(p_ttl_ms, 1000) / 1000.0))
  on conflict (key) do update
    set owner = excluded.owner, expires_at = excluded.expires_at
    where public.arca_locks.expires_at < now()
  returning 1 into v;
  return v is not null;
end;
$$;

create or replace function public.arca_lock_release(p_key text, p_owner text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.arca_locks where key = p_key and owner = p_owner;
$$;

revoke all on function public.arca_store_add(text, text), public.arca_lock_acquire(text, text, integer), public.arca_lock_release(text, text)
  from public, anon, authenticated;
grant execute on function public.arca_store_add(text, text), public.arca_lock_acquire(text, text, integer), public.arca_lock_release(text, text)
  to service_role;
