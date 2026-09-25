import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { parseLiveOverview } from "@/lib/live-overview";
import { LiveClient } from "@/app/(dashboard)/en-vivo/live-client";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";

export default async function EnVivoPage() {
  const { organization, membership, userId } = await requireOrgContext();

  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sólo el dueño o un administrador pueden ver cómo viene el negocio en vivo.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "liveView")) {
    return (
      <ProLockedCard
        title="En vivo"
        plan={featureMinPlan.liveView}
        description="Mirá desde el celular cuánto se vende en este momento, en cada sucursal y con cada vendedor y su caja."
      />
    );
  }

  const { data, error } = await supabase.rpc("live_overview", { p_org_id: organization.id });
  if (error || !data) throw new Error("No pudimos cargar la vista en vivo.");

  return (
    <LiveClient
      orgId={organization.id}
      orgName={organization.name}
      currentUserId={userId}
      initial={parseLiveOverview(data)}
    />
  );
}
