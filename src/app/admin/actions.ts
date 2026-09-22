"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/subscription";

export interface ActionState {
  error?: string;
  success?: boolean;
}

/**
 * Cambia el plan de un negocio a mano desde /admin. Usa la service role
 * (createAdminClient), que es la única forma de escribir en
 * organization_subscriptions: la tabla no tiene policies de INSERT/UPDATE
 * para el rol authenticated (ver migración 0026), justamente para que
 * ningún miembro de un negocio pueda subirse su propio plan.
 */
export async function updateOrgPlan(orgId: string, plan: Plan): Promise<ActionState> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  // Al asignar un plan pago a mano, la prueba de 14 días ya no tiene
  // sentido: se limpia para que no quede una fecha vieja dando vueltas.
  const proTrialEndsAt = plan === "gratis" ? undefined : null;

  const { error } = await admin
    .from("organization_subscriptions")
    .upsert(
      { org_id: orgId, plan, ...(proTrialEndsAt !== undefined ? { pro_trial_ends_at: proTrialEndsAt } : {}) },
      { onConflict: "org_id" }
    );

  if (error) return { error: "No pudimos guardar el cambio de plan." };

  revalidatePath("/admin");
  return { success: true };
}
