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

  const baseSlug = slugify(trimmedName) || "negocio";
  const slug = `${baseSlug}-${user.id.slice(0, 6)}`;

  const { error } = await supabase.rpc("create_organization", {
    p_name: trimmedName,
    p_slug: slug,
    p_business_type: businessType || "otro",
  });

  if (error) {
    return { error: "No pudimos crear tu cuenta. Intentá de nuevo." };
  }

  redirect("/pos");
}
