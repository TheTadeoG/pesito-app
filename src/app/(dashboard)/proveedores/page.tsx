import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ProveedoresClient } from "@/app/(dashboard)/proveedores/proveedores-client";

export default async function ProveedoresPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", organization.id)
    .order("name");

  return <ProveedoresClient suppliers={suppliers ?? []} />;
}
