import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ProveedoresClient } from "@/app/(dashboard)/proveedores/proveedores-client";

export default async function ProveedoresPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: suppliers }, { data: customPaymentMethods }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("org_id", organization.id).order("name"),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  const normalized = (suppliers ?? []).map((s) => ({ ...s, balance: Number(s.balance) }));

  return (
    <ProveedoresClient
      suppliers={normalized}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
    />
  );
}
