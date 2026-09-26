"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export interface OnboardingState {
  error?: string;
}

export async function createKiosco(
  name: string,
  businessType: string
): Promise<OnboardingState> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { error: "Ponele un nombre a tu negocio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Cuenta interna (usuario#código, sin email real): se creó para sumarse
  // al equipo de otro negocio, no para arrancar uno propio. Si alguna vez
  // la sacan de ese equipo, esta cuenta queda sin membresías pero no puede
  // usarse para esto — evita que alguien arranque un negocio "por las
  // dudas" con credenciales que en realidad le dio su empleador.
  if (typeof user.user_metadata?.internal_username === "string") {
    return {
      error:
        "Esta cuenta se creó como parte de un equipo y no puede usarse para dar de alta un negocio propio. Si necesitás una cuenta propia, registrate con tu email en /registro.",
    };
  }

  const baseSlug = slugify(trimmedName) || "negocio";
  const slug = `${baseSlug}-${user.id.slice(0, 6)}`;
  const phone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null;

  const { error } = await supabase.rpc("create_organization", {
    p_name: trimmedName,
    p_slug: slug,
    p_business_type: businessType || "otro",
    p_phone: phone,
  });

  if (error) {
    return { error: "No pudimos crear tu cuenta. Intentá de nuevo." };
  }

  // Eligió un plan pago en precios: primero se cobra, después entra.
  const selectedPlan = user.user_metadata?.selected_plan;
  if (typeof selectedPlan === "string" && ["esencial", "pro", "ia"].includes(selectedPlan)) {
    const cycle = user.user_metadata?.selected_cycle === "anual" ? "anual" : "mensual";
    redirect(`/suscribirse?plan=${selectedPlan}&ciclo=${cycle}`);
  }

  redirect("/pos?bienvenida=1");
}
