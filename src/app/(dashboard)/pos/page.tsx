import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { PosCatalog } from "@/app/(dashboard)/pos/pos-catalog";
import { OpenCajaPrompt } from "@/app/(dashboard)/pos/open-caja-prompt";
import { getRecentSaleRows } from "@/app/(dashboard)/pos/recent-sales";
import { fetchAll } from "@/lib/supabase/fetch-all";

export default async function PosPage() {
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: openRegister } = await supabase
    .from("cash_registers")
    // "*" y no "id, branch_id": si la migración 0043 todavía no está
    // aplicada, pedir branch_id por nombre haría fallar la consulta.
    .select("*")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!openRegister) {
    return <OpenCajaPrompt />;
  }

  // Los clientes vienen completos (el cobro y la búsqueda filtran en el
  // navegador). Los productos no: los baja el navegador desde su copia local
  // (PosCatalog, migración 0064), con sólo lo que cambió y el stock al día.
  const [customers, recentSales, { data: customPaymentMethods }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name, invoice_type, balance")
        .eq("org_id", organization.id)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    getRecentSaleRows(supabase, openRegister.id),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  return (
    <PosCatalog
      orgId={organization.id}
      branchId={openRegister.branch_id ?? null}
      orgName={organization.name}
      cashRegisterId={openRegister.id}
      customers={customers.map((c) => ({ ...c, balance: Number(c.balance) }))}
      autoInvoiceByPayment={organization.auto_invoice_by_payment}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      recentSales={recentSales}
    />
  );
}
