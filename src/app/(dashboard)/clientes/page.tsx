import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "@/app/(dashboard)/clientes/clientes-client";

export default async function ClientesPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", organization.id)
    .order("name");

  const normalized = (customers ?? []).map((c) => ({ ...c, balance: Number(c.balance) }));

  return <ClientesClient customers={normalized} />;
}
