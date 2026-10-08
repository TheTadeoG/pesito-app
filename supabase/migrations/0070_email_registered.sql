-- ¿Ya hay una cuenta con este email? Lo usa el registro (con "Confirm email"
-- activado, Supabase deja de avisar cuando el email existe).
-- Sólo el servidor (clave secreta) la puede llamar; el registro la llama
-- después de los límites por IP y del CAPTCHA, así que no sirve para barrer emails.

create or replace function public.email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_registered(text) from public, anon, authenticated;
grant execute on function public.email_registered(text) to service_role;
