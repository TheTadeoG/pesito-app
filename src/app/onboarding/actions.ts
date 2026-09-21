"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export interface OnboardingState {
  error?: string;
}

export async function createKiosco(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Ponele un nombre a tu kiosco." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const baseSlug = slugify(name) || "kiosco";
  const slug = `${baseSlug}-${user.id.slice(0, 6)}`;

  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    return { error: "No pudimos crear tu kiosco. Intentá de nuevo." };
  }

  redirect("/pos");
}
