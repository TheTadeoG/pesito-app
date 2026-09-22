"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AcceptInvitationState {
  error?: string;
}

export async function acceptInvitation(code: string): Promise<AcceptInvitationState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_code: code });

  if (error) {
    if (error.message.toLowerCase().includes("expiró")) {
      return { error: "Esta invitación expiró. Pedí un link nuevo." };
    }
    if (error.message.toLowerCase().includes("usada")) {
      return { error: "Esta invitación ya fue usada." };
    }
    return { error: "No pudimos aceptar la invitación." };
  }

  redirect("/pos");
}
