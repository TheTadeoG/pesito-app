import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, fetchAllIn } from "@/lib/supabase/fetch-all";
import { getFiadoAmountsBySale } from "@/lib/sale-payments";
import { ClientesClient, type ClienteRow } from "@/app/(dashboard)/clientes/clientes-client";

export default async function ClientesPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const [customers, { data: customPaymentMethods }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("*")
        .eq("org_id", organization.id)
        .order("name")
        .order("id")
        .range(from, to)
    ),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  // Para quienes deben: desde cuándo (la compra a fiado más vieja que sigue
  // sin pagarse, suponiendo que los pagos cancelan primero lo más viejo), su
  // último pago y su última compra.
  const debtorIds = customers.filter((c) => Number(c.balance) > 0).map((c) => c.id);

  const [salesRaw, paymentsRaw] = await Promise.all([
    fetchAllIn(debtorIds, (ids, from, to) =>
      supabase
        .from("sales")
        .select("id, customer_id, created_at")
        .eq("org_id", organization.id)
        .eq("status", "completada")
        .in("customer_id", ids)
        .order("id")
        .range(from, to)
    ),
    fetchAllIn(debtorIds, (ids, from, to) =>
      supabase
        .from("customer_payments")
        .select("customer_id, created_at")
        .in("customer_id", ids)
        .order("id")
        .range(from, to)
    ),
  ]);
  const fiadoBySale = await getFiadoAmountsBySale(
    supabase,
    salesRaw.map((s) => s.id)
  );

  const lastPayment = new Map<string, string>();
  for (const p of paymentsRaw) {
    const cur = lastPayment.get(p.customer_id);
    if (!cur || p.created_at > cur) lastPayment.set(p.customer_id, p.created_at);
  }
  const lastSale = new Map<string, string>();
  const fiadoSales = new Map<string, { at: string; amount: number }[]>();
  for (const s of salesRaw) {
    if (!s.customer_id) continue;
    const cur = lastSale.get(s.customer_id);
    if (!cur || s.created_at > cur) lastSale.set(s.customer_id, s.created_at);
    const amount = fiadoBySale.get(s.id) ?? 0;
    if (amount > 0) {
      const list = fiadoSales.get(s.customer_id) ?? [];
      list.push({ at: s.created_at, amount });
      fiadoSales.set(s.customer_id, list);
    }
  }

  const rows: ClienteRow[] = customers.map((c) => {
    const balance = Number(c.balance);
    let debtSince: string | null = null;
    if (balance > 0) {
      let remaining = balance;
      for (const sale of (fiadoSales.get(c.id) ?? []).sort((a, b) => b.at.localeCompare(a.at))) {
        debtSince = sale.at;
        remaining -= sale.amount;
        if (remaining <= 0.004) break;
      }
    }
    return {
      ...c,
      balance,
      debtSince,
      lastPaymentAt: lastPayment.get(c.id) ?? null,
      lastSaleAt: lastSale.get(c.id) ?? null,
    };
  });

  return (
    <ClientesClient
      customers={rows}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
    />
  );
}
