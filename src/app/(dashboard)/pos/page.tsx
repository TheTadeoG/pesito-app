import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { PosCatalog } from "@/app/(dashboard)/pos/pos-catalog";
import { fetchCatalogForPos } from "@/lib/pos-catalog-server";
import { fetchBundleItems } from "@/lib/bundles";
import { POS_CACHE_COOKIE, posCacheCookieValue } from "@/lib/pos-cache-cookie";
import { OpenCajaPrompt } from "@/app/(dashboard)/pos/open-caja-prompt";
import { getRecentSaleRows } from "@/app/(dashboard)/pos/recent-sales";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getInvoicingConfig } from "@/lib/actions/invoicing";

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
  const [customers, recentSales, { data: customPaymentMethods }, initialProducts, invoicing, variantRows, colorRows, bundleInfo] = await Promise.all([
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
    // Si la facturación está lista y con qué medios factura sola (dos consultas chicas; sin secretos).
    getInvoicingConfig(organization.id).catch(() => ({ enabled: false, autoMethods: [] as string[] })),
    // Talle y color de las variantes, para agruparlas en la búsqueda (si falta la migración 0097, queda vacío).
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, variant_group_id, variant_size, variant_color")
        .eq("org_id", organization.id)
        .eq("active", true)
        .not("variant_group_id", "is", null)
        .order("id")
        .range(from, to)
    ).catch(() => []),
    // Color de referencia elegido a mano (migración 0099): aparte, para que si falta no se pierda el agrupado.
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("id, variant_color_hex")
        .eq("org_id", organization.id)
        .eq("active", true)
        .not("variant_color_hex", "is", null)
        .order("id")
        .range(from, to)
    ).catch(() => []),
    // Combos y kits: qué productos lleva cada uno (si falta la migración 0100, queda vacío).
    fetchBundleItems(supabase, organization.id),
  ]);
  const hexById = new Map(colorRows.map((r) => [r.id, r.variant_color_hex as string | null]));
  const variantInfo: Record<string, { g: string; s: string | null; c: string | null; h?: string | null }> = {};
  for (const r of variantRows) {
    if (r.variant_group_id) variantInfo[r.id] = { g: r.variant_group_id, s: r.variant_size ?? null, c: r.variant_color ?? null, h: hexById.get(r.id) ?? null };
  }

  return (
    <PosCatalog
      orgId={organization.id}
      branchId={openRegister.branch_id ?? null}
      initialProducts={initialProducts}
      // El nombre y el número del comprobante X se pueden ocultar (Ajustes → Tu negocio).
      orgName={organization.ticket_show_org_name === false ? "" : organization.name}
      ticketShowNumber={organization.ticket_show_number !== false}
      cashRegisterId={openRegister.id}
      customers={customers.map((c) => ({ ...c, balance: Number(c.balance) }))}
      // «Facturación automática según medio de pago» (el interruptor viejo) se quitó: la factura real
      // se elige en Ajustes → Facturación.
      autoInvoiceByPayment={false}
      invoicing={invoicing}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
      variantInfo={variantInfo}
      bundleInfo={bundleInfo}
      recentSales={recentSales}
    />
  );
}
