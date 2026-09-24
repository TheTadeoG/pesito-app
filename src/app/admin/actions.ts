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
  const { userId } = await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("organization_subscriptions")
    .select("plan")
    .eq("org_id", orgId)
    .maybeSingle();
  const previousPlan = current?.plan ?? "gratis";

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

  // Historial real (no de pagos, que no existen sin pasarela): queda
  // para mostrarle al negocio cuándo cambió de plan.
  if (previousPlan !== plan) {
    await admin
      .from("plan_history")
      .insert({ org_id: orgId, from_plan: previousPlan, to_plan: plan, changed_by: userId });
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Offsets del contador de uso real de la landing (Stats): se suman a lo
 * que el sistema ya cuenta (organizaciones, ventas) para poder incluir
 * números reales que todavía no están cargados ahí. Misma razón que
 * updateOrgPlan para usar la service role: landing_stats no tiene
 * policies de insert/update para anon/authenticated.
 */
export async function updateLandingStatsOffsets(input: {
  kioscosOffset: number;
  ventasOffset: number;
  montoOffset: number;
}): Promise<ActionState> {
  await requirePlatformAdmin();

  if (
    !Number.isFinite(input.kioscosOffset) ||
    !Number.isFinite(input.ventasOffset) ||
    !Number.isFinite(input.montoOffset) ||
    input.kioscosOffset < 0 ||
    input.ventasOffset < 0 ||
    input.montoOffset < 0
  ) {
    return { error: "Los valores tienen que ser números positivos." };
  }

  const admin = createAdminClient();

  const { error } = await admin.from("landing_stats").upsert({
    id: "main",
    kioscos_offset: Math.round(input.kioscosOffset),
    ventas_offset: Math.round(input.ventasOffset),
    monto_offset: input.montoOffset,
  });

  if (error) return { error: "No pudimos guardar los valores." };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}
