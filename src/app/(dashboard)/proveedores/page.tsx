import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { loadSupplierOverview } from "@/lib/supplier-overview";
import { ProveedoresClient } from "@/app/(dashboard)/proveedores/proveedores-client";

export default async function ProveedoresPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [overview, { data: customPaymentMethods }, subscription] = await Promise.all([
    loadSupplierOverview(supabase, organization.id),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
    getSubscription(supabase, organization.id),
  ]);

  return (
    <ProveedoresClient
      overview={overview}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      accountsEnabled={canUse(subscription, "supplierAccounts")}
    />
  );
}
