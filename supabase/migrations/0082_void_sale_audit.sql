-- Las ventas nunca se borran: se anulan, y queda quién, cuándo y por qué. Con facturación electrónica
-- (ARCA) esto es obligatorio: una venta con factura autorizada no se puede anular a secas, hace falta una
-- nota de crédito (la vincula arca_vouchers, 0080).
--
-- void_sale (la que repone el stock, ajusta caja y cuenta del cliente) queda igual; esta función la envuelve:
--   * sólo dueño o administrador,
--   * pide un motivo,
--   * se niega si la venta tiene una factura autorizada sin nota de crédito autorizada,
--   * deja voided_at / voided_by / void_reason en la venta.
-- Los miembros siguen sin poder borrar ni editar ventas directo (no hay policy de UPDATE ni DELETE).

alter table public.sales
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id) on delete set null,
  add column if not exists void_reason text check (char_length(void_reason) <= 300);

create or replace function public.void_sale_audited(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  select org_id into v_org from public.sales where id = p_sale_id;
  if v_org is null then
    raise exception 'venta no encontrada';
  end if;
  if not public.is_org_admin(v_org) then
    raise exception 'Sólo el dueño o un administrador puede anular ventas';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Escribí el motivo de la anulación';
  end if;

  if exists (
        select 1 from public.arca_vouchers v
        where v.sale_id = p_sale_id and v.kind = 'invoice' and v.status = 'authorized'
      )
     and not exists (
        select 1 from public.arca_vouchers n
        where n.sale_id = p_sale_id and n.kind = 'credit_note' and n.status = 'authorized'
      ) then
    raise exception 'Esta venta tiene una factura electrónica: no se puede anular a secas, hace falta una nota de crédito.';
  end if;

  perform public.rate_limit_hit(v_org, 'void_sale', 60, 3600);
  perform public.void_sale(p_sale_id);

  update public.sales
  set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  where id = p_sale_id;
end;
$$;

revoke all on function public.void_sale_audited(uuid, text) from public, anon;
grant execute on function public.void_sale_audited(uuid, text) to authenticated;
