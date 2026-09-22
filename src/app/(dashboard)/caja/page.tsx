import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { computeCashOnHand } from "@/lib/caja";
import { OpenCajaDialog } from "@/app/(dashboard)/caja/open-caja-dialog";
import { ManageCaja } from "@/app/(dashboard)/caja/manage-caja";
import { CajaHistorial, type CajaHistorialRow } from "@/app/(dashboard)/caja/historial";

export default async function CajaPage() {
  const { userId, email, organization } = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: register }, { data: closedRegisters }] = await Promise.all([
    supabase
      .from("cash_registers")
      .select("id, opening_amount, opened_at")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
    supabase
      .from("cash_registers")
      .select("id, user_id, opened_at, closed_at, opening_amount, expected_amount, closing_amount")
      .eq("org_id", organization.id)
      .eq("status", "cerrada")
      .order("closed_at", { ascending: false })
      .limit(20),
  ]);

  const historialRows: CajaHistorialRow[] = (closedRegisters ?? [])
    .filter((r) => r.closed_at)
    .map((r) => ({
      id: r.id,
      userLabel: r.user_id === userId ? "Vos" : `Usuario ${r.user_id.slice(0, 8)}`,
      openedAt: r.opened_at,
      closedAt: r.closed_at as string,
      openingAmount: Number(r.opening_amount),
      expectedAmount: Number(r.expected_amount ?? 0),
      closingAmount: Number(r.closing_amount ?? 0),
    }));

  if (!register) {
    return (
      <div className="space-y-6">
        <OpenCajaDialog />
        <CajaHistorial rows={historialRows} />
      </div>
    );
  }

  const openingAmount = Number(register.opening_amount);
  const cashOnHand = await computeCashOnHand(supabase, register.id, openingAmount);

  return (
    <div className="space-y-6">
      <ManageCaja
        cashRegisterId={register.id}
        openingAmount={openingAmount}
        cashOnHand={cashOnHand}
        openedAt={register.opened_at}
        openedByLabel={email ?? "Vos"}
      />
      <CajaHistorial rows={historialRows} />
    </div>
  );
}
