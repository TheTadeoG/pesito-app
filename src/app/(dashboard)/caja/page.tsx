import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { computeCashOnHand } from "@/lib/caja";
import { OpenCajaDialog } from "@/app/(dashboard)/caja/open-caja-dialog";
import { ManageCaja } from "@/app/(dashboard)/caja/manage-caja";

export default async function CajaPage() {
  const { userId, email, organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("id, opening_amount, opened_at")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!register) {
    return <OpenCajaDialog />;
  }

  const openingAmount = Number(register.opening_amount);
  const cashOnHand = await computeCashOnHand(supabase, register.id, openingAmount);

  return (
    <ManageCaja
      cashRegisterId={register.id}
      openingAmount={openingAmount}
      cashOnHand={cashOnHand}
      openedAt={register.opened_at}
      openedByLabel={email ?? "Vos"}
    />
  );
}
