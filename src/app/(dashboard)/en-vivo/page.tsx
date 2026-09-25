import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { parseLiveOverview } from "@/lib/live-overview";
import { LiveClient } from "@/app/(dashboard)/en-vivo/live-client";

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
  const { data, error } = await supabase.rpc("live_overview", { p_org_id: organization.id });
  if (error || !data) throw new Error("No pudimos cargar la vista en vivo.");

  return (
    <LiveClient orgId={organization.id} currentUserId={userId} initial={parseLiveOverview(data)} />
  );
}
