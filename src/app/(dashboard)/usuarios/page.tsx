import { Lock } from "lucide-react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { isOrgAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { UsuariosClient } from "@/app/(dashboard)/usuarios/usuarios-client";
import { siteUrl } from "@/lib/utils";
import { getBranchContext } from "@/lib/branches";
import { getSubscription, planLabels } from "@/lib/subscription";
import { effectivePlan, limitsFor } from "@/lib/plan-access";

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

  return (
    <UsuariosClient
      members={members ?? []}
      invitations={invitations ?? []}
      currentUserId={userId}
      siteUrl={siteUrl}
      branches={branchContext.branches}
      usersLimit={limitsFor(subscription).users}
      planName={`Plan ${planLabels[effectivePlan(subscription)]}${subscription.trialActive ? " (prueba)" : ""}`}
    />
  );
}
