import { createAdminClient } from "@/lib/supabase/admin";
import { argDateString, argMidnightUTC } from "@/lib/timezone";
import { invoiceQuota } from "@/lib/invoice-packs";
import type { SubscriptionInfo } from "@/lib/subscription";

// Facturas del mes (calendario, huso Argentina) que cuentan contra el cupo del plan: las autorizadas por ARCA, facturas
// y notas de crédito por igual. Las de modo de prueba no cuentan. Sólo servidor.

export interface InvoiceUsage {
  /** Plan por el que se calcula el cupo (la prueba Pro cuenta como Pro). */
  planId: "basico" | "pro" | "max" | "gratis";
  used: number;
  quota: number;
  /** Cuántas quedan este mes (0 si ya se usaron). */
  left: number;
  /** 80% o más del cupo. */
  nearLimit: boolean;
  /** Se usó todo el cupo. */
  reached: boolean;
}

export async function getInvoiceUsage(orgId: string, subscription: SubscriptionInfo): Promise<InvoiceUsage> {
  const [year, month] = argDateString().split("-");
  const monthStart = argMidnightUTC(`${year}-${month}-01`);
  const { count } = await createAdminClient()
    .from("arca_vouchers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("environment", "production")
    .eq("status", "authorized")
    .gte("created_at", monthStart.toISOString());
  const used = count ?? 0;
  const planId = subscription.plan === "gratis" && subscription.hasProAccess ? "pro" : subscription.plan;
  const quota = invoiceQuota(planId, subscription.invoicePack);
  return { planId, used, quota, left: Math.max(0, quota - used), nearLimit: quota > 0 && used >= quota * 0.8, reached: used >= quota };
}
