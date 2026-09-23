"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionState {
  error?: string;
}

export interface TestimonialInput {
  name: string;
  location: string;
  businessType: string;
  rating: number;
  quote: string;
}

function revalidateAll() {
  revalidatePath("/admin/resenas");
  // La landing muestra sólo las publicadas: cualquier cambio acá se
  // refleja ahí apenas se guarda.
  revalidatePath("/");
}

export async function createTestimonial(input: TestimonialInput): Promise<ActionState> {
  await requirePlatformAdmin();

  if (!input.name.trim()) return { error: "Falta el nombre." };
  if (!input.quote.trim()) return { error: "Falta el texto de la reseña." };

  const admin = createAdminClient();
  const { error } = await admin.from("testimonials").insert({
    name: input.name.trim(),
    location: input.location.trim() || null,
    business_type: input.businessType.trim() || null,
    rating: input.rating,
    quote: input.quote.trim(),
  });

  if (error) return { error: "No pudimos crear la reseña." };

  revalidateAll();
  return {};
}

export async function updateTestimonial(
  id: string,
  input: TestimonialInput
): Promise<ActionState> {
  await requirePlatformAdmin();

  if (!input.name.trim()) return { error: "Falta el nombre." };
  if (!input.quote.trim()) return { error: "Falta el texto de la reseña." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("testimonials")
    .update({
      name: input.name.trim(),
      location: input.location.trim() || null,
      business_type: input.businessType.trim() || null,
      rating: input.rating,
      quote: input.quote.trim(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidateAll();
  return {};
}

export async function toggleTestimonialPublished(
  id: string,
  published: boolean
): Promise<ActionState> {
  await requirePlatformAdmin();

  const admin = createAdminClient();
  const { error } = await admin.from("testimonials").update({ published }).eq("id", id);

  if (error) return { error: "No pudimos actualizar la reseña." };

  revalidateAll();
  return {};
}

export async function deleteTestimonial(id: string): Promise<ActionState> {
  await requirePlatformAdmin();

  const admin = createAdminClient();
  const { error } = await admin.from("testimonials").delete().eq("id", id);

  if (error) return { error: "No pudimos borrar la reseña." };

  revalidateAll();
  return {};
}
