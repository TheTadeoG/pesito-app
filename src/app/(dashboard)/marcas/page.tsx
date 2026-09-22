import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { MarcasClient } from "@/app/(dashboard)/marcas/marcas-client";

export default async function MarcasPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .eq("org_id", organization.id)
    .order("name");

  return <MarcasClient brands={brands ?? []} />;
}
