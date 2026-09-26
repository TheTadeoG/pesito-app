import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMembershipPaused } from "@/lib/member-pause";
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
 * request se repetía la misma validación de sesión + join a memberships dos
 * veces en cada navegación. cache() lo deja en una sola consulta real
 * por request — nunca se comparte entre requests distintos, así que no
 * hay riesgo de servir un usuario/organización vieja.
 */
export const requireOrgContext = cache(async (): Promise<CurrentOrgContext> => {
  const supabase = await createClient();

  // getClaims valida el token localmente (ver lib/supabase/middleware.ts)
  // en vez de preguntarle al servidor de Auth en cada render. Que la
  // persona siga en el negocio lo decide la consulta a memberships de
  // abajo, que sí va a la base en cada pedido.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("*, organizations(*)")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Membership & { organizations: Organization }>();

  if (!membership || !membership.organizations) {
    redirect("/onboarding");
  }

  const { organizations, ...membershipRow } = membership;

  const firstName =
    typeof claims.user_metadata?.first_name === "string" ? claims.user_metadata.first_name : null;

  // Usuario de más para el plan del negocio (bajó de plan y terminó la
  // gracia): no entra hasta que el dueño haga lugar. El dueño nunca.
  if (membershipRow.role !== "owner" && (await isMembershipPaused(supabase, organizations.id, membershipRow.id))) {
    redirect("/cuenta-pausada");
  }

  return {
    userId: claims.sub,
    email: claims.email ?? null,
    firstName,
    organization: organizations,
    membership: membershipRow,
  };
});
