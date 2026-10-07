import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { PosCatalog } from "@/app/(dashboard)/pos/pos-catalog";
import { fetchCatalogForPos } from "@/lib/pos-catalog-server";
import { POS_CACHE_COOKIE, posCacheCookieValue } from "@/lib/pos-cache-cookie";
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
  // La primera vez que este navegador abre el POS (no tiene la cookie de la
  // copia), los productos van adentro de la página y no hay nada que esperar.
  const cookieStore = await cookies();
  const hasLocalCopy =
    cookieStore.get(POS_CACHE_COOKIE)?.value === posCacheCookieValue(organization.id, openRegister.branch_id ?? null);
  const [customers, recentSales, { data: customPaymentMethods }, initialProducts] = await Promise.all([
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
    hasLocalCopy
      ? Promise.resolve(null)
      : fetchCatalogForPos(supabase, organization.id, openRegister.branch_id ?? null).catch(() => null),
  ]);

  return (
    <PosCatalog
      orgId={organization.id}
      branchId={openRegister.branch_id ?? null}
      initialProducts={initialProducts}
      orgName={organization.name}
      cashRegisterId={openRegister.id}
      customers={customers.map((c) => ({ ...c, balance: Number(c.balance) }))}
      autoInvoiceByPayment={organization.auto_invoice_by_payment}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      recentSales={recentSales}
    />
  );
}
