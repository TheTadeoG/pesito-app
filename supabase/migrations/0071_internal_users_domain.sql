-- Las cuentas de "usuario interno" (empleados con usuario y contraseña) tenían un
-- email inventado en vendedores.pesito.app, un dominio que no es nuestro: quien lo
-- controle podría recibir los mails de recuperación de esas cuentas. Pasan a
-- vendedores.pesito.com.ar (dominio nuestro). La app genera ahora ese email.
--
-- IMPORTANTE: aplicar esta migración y desplegar el código enseguida: entre una y
-- otra, el login de los empleados con usuario falla (la app arma el email nuevo).

begin;

update auth.users
set email = replace(email, '@vendedores.pesito.app', '@vendedores.pesito.com.ar'),
    raw_user_meta_data = case
      when raw_user_meta_data->>'email' like '%@vendedores.pesito.app'
      then jsonb_set(
             raw_user_meta_data, '{email}',
             to_jsonb(replace(raw_user_meta_data->>'email', '@vendedores.pesito.app', '@vendedores.pesito.com.ar')))
      else raw_user_meta_data
    end,
    updated_at = now()
where email like '%@vendedores.pesito.app';

update auth.identities
set identity_data = jsonb_set(
      identity_data, '{email}',
      to_jsonb(replace(identity_data->>'email', '@vendedores.pesito.app', '@vendedores.pesito.com.ar'))),
    updated_at = now()
where identity_data->>'email' like '%@vendedores.pesito.app';

update public.memberships
set email = replace(email, '@vendedores.pesito.app', '@vendedores.pesito.com.ar')
where email like '%@vendedores.pesito.app';

commit;
