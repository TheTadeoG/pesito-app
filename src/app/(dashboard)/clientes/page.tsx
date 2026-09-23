import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "@/app/(dashboard)/clientes/clientes-client";

export default async function ClientesPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: customers }, { data: customPaymentMethods }] = await Promise.all([
    supabase.from("customers").select("*").eq("org_id", organization.id).order("name"),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  const normalized = (customers ?? []).map((c) => ({ ...c, balance: Number(c.balance) }));

  return (
    <ClientesClient
      customers={normalized}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
    />
  );
}
