-- Pesito: faltaba la política de UPDATE para organizations, por eso ni el
-- nombre del negocio ni la facturación automática se podían guardar (RLS
-- bloqueaba el update en silencio).
-- Corre sobre una base que ya tiene 0001..0009 aplicadas.

create policy "members can update their organization"
  on organizations for update
  using (public.is_org_member(id))
  with check (public.is_org_member(id));
