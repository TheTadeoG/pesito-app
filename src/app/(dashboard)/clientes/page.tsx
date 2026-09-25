import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { ClientesClient } from "@/app/(dashboard)/clientes/clientes-client";

export default async function ClientesPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [customers, { data: customPaymentMethods }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("*")
        .eq("org_id", organization.id)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  const normalized = customers.map((c) => ({ ...c, balance: Number(c.balance) }));

  return (
    <ClientesClient
      customers={normalized}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
    />
  );
}
