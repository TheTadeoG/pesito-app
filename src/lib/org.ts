import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization } from "@/lib/types";

export interface CurrentOrgContext {
  userId: string;
  email: string | null;
  organization: Organization;
  membership: Membership;
}

/**
 * Resolves the signed-in user and their active organization for dashboard
 * pages. Redirects to /login or /onboarding when either is missing, so
 * callers can assume both exist.
 */
export async function requireOrgContext(): Promise<CurrentOrgContext> {
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

  return {
    userId: user.id,
    email: user.email ?? null,
    organization: organizations,
    membership: membershipRow,
  };
}
