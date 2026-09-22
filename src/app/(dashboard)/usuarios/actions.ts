"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";

export interface ActionState {
  error?: string;
}

export interface InviteResult extends ActionState {
  code?: string;
}

export async function createInvitation(role: "admin" | "vendedor"): Promise<InviteResult> {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return { error: "No tenés permiso para invitar usuarios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_org_id: organization.id,
    p_role: role,
  });

  if (error || !data) return { error: "No pudimos crear la invitación." };

  revalidatePath("/usuarios");
  return { code: data.code };
}

export async function revokeInvitation(invitationId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { error: "No pudimos cancelar la invitación." };

  revalidatePath("/usuarios");
  return {};
}

export async function updateMemberRole(
  membershipId: string,
  role: "admin" | "vendedor"
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_membership_id: membershipId,
    p_role: role,
  });
  if (error) return { error: "No pudimos cambiar el rol." };

  revalidatePath("/usuarios");
  return {};
}

export async function removeMember(membershipId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_membership_id: membershipId });
  if (error) return { error: "No pudimos quitar al usuario." };

  revalidatePath("/usuarios");
  return {};
}
