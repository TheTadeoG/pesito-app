import { Lock } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { isOrgAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { UsuariosClient } from "@/app/(dashboard)/usuarios/usuarios-client";
import { siteUrl } from "@/lib/utils";
import { getBranchContext } from "@/lib/branches";
import { getSubscription, planLabels } from "@/lib/subscription";
import { effectivePlan, limitsFor, planLimits } from "@/lib/plan-access";
import { pausedMembershipIds } from "@/lib/member-pause";
import { formatDate } from "@/lib/utils";

export default async function UsuariosPage() {
  const { organization, membership, userId } = await requireOrgContext();

  if (!isOrgAdmin(membership.role)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">No tenés acceso a esta sección</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sólo el dueño y los administradores del negocio pueden gestionar usuarios.
          </p>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const [{ data: members }, { data: invitations }, branchContext, subscription] = await Promise.all([
    supabase
      .from("memberships")
      // "*": con la migración 0043 trae también branch_id; sin ella, pedirlo
      // por nombre haría fallar la consulta.
      .select("*")
      .eq("org_id", organization.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, code, role, created_at, expires_at, used_at")
      .eq("org_id", organization.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    getBranchContext(),
    getSubscription(supabase, organization.id),
  ]);

  // Usuarios de más para el plan: pausados ahora, o que se van a pausar al
  // terminar la gracia por haber bajado de plan.
  const memberRows = members ?? [];
  const usersLimit = limitsFor(subscription).users;
  const pausedNow = pausedMembershipIds(memberRows, usersLimit);
  const grace = subscription.grace;
  const pausedLater = grace
    ? [...pausedMembershipIds(memberRows, planLimits[grace.nextPlan].users)].filter((id) => !pausedNow.has(id))
    : [];

  return (
    <UsuariosClient
      members={members ?? []}
      invitations={invitations ?? []}
      currentUserId={userId}
      siteUrl={siteUrl}
      branches={branchContext.branches}
      usersLimit={usersLimit}
      pausedIds={[...pausedNow]}
      pausingSoon={
        grace && pausedLater.length > 0
          ? {
              ids: pausedLater,
              date: formatDate(grace.until),
              nextPlan: `Plan ${planLabels[grace.nextPlan]}`,
              nextLimit: planLimits[grace.nextPlan].users,
            }
          : null
      }
      planName={`Plan ${planLabels[effectivePlan(subscription)]}${subscription.trialActive ? " (prueba)" : ""}`}
    />
  );
}
