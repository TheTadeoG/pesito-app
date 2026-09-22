import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for /admin: el panel interno del dueño de Pesito (estadísticas de
 * toda la plataforma), separado de los roles owner/admin/vendedor de cada
 * negocio. No revela que la ruta existe a quien no es platform admin —
 * devuelve 404 en vez de redirigir con un mensaje de "no tenés acceso".
 */
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) {
    notFound();
  }

  return { userId: user.id };
}
