import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization } from "@/lib/types";

export interface CurrentOrgContext {
  userId: string;
  email: string | null;
  firstName: string | null;
  organization: Organization;
  membership: Membership;
}

/**
 * Resolves the signed-in user and their active organization for dashboard
 * pages. Redirects to /login o /onboarding cuando falta alguno.
 *
 * Envuelta en cache() de React: el layout del dashboard y la página que
 * renderiza adentro llaman esto por separado, así que sin memoizar por
 * request se repetía el mismo auth.getUser() + join a memberships dos
 * veces en cada navegación. cache() lo deja en una sola consulta real
 * por request — nunca se comparte entre requests distintos, así que no
 * hay riesgo de servir un usuario/organización vieja.
 */
export const requireOrgContext = cache(async (): Promise<CurrentOrgContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("*, organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership & { organizations: Organization }>();

  if (!membership || !membership.organizations) {
    redirect("/onboarding");
  }

  const { organizations, ...membershipRow } = membership;

  const firstName =
    typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;

  return {
    userId: user.id,
    email: user.email ?? null,
    firstName,
    organization: organizations,
    membership: membershipRow,
  };
});
