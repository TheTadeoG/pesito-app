import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { isOrgAdmin } from "@/lib/roles";
import {
  getSubscription,
  getMonthlySalesCount,
  getPlanHistory,
  hasMonthlySalesLimit,
} from "@/lib/subscription";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { syncReturnedPayment } from "@/lib/billing";
import { SubscriptionSection } from "@/app/(dashboard)/configuracion/subscription-section";

// Planes: el plan actual, la comparación y cómo se paga. Antes era una
// pestaña de Configuración (/configuracion?tab=plan, que ahora redirige acá).
export default async function PlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ preapproval_id?: string }>;
}) {
  const { preapproval_id: preapprovalId } = await searchParams;
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  // Vuelta de Mercado Pago (con o sin ?preapproval_id): se aplica lo que se
  // haya pagado sin esperar el aviso.
  if (isOrgAdmin(membership.role)) await syncReturnedPayment(organization.id, { preapprovalId });
  const subscription = await getSubscription(supabase, organization.id);
  // Sólo importa contar esto cuando el límite de ventas realmente aplica
  // (plan gratis, sin prueba Pro activa) — evita una query de más al resto.
  const [monthlySalesCount, planHistory] = await Promise.all([
    hasMonthlySalesLimit(subscription) ? getMonthlySalesCount(supabase, organization.id) : Promise.resolve(null),
    getPlanHistory(supabase, organization.id),
  ]);

  return (
    <SubscriptionSection
      subscription={subscription}
      monthlySalesCount={monthlySalesCount}
      planHistory={planHistory}
      canManage={isOrgAdmin(membership.role)}
      paymentsEnabled={mercadoPagoConfigured()}
    />
  );
}
