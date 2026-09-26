import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEVICE_COOKIE = "pesito-device";

/**
 * Registra un ingreso (migración 0046) y marca si es desde un dispositivo
 * nuevo para esa persona. El dispositivo se reconoce por una cookie propia
 * de larga duración. El primer ingreso de alguien no cuenta como "nuevo"
 * (si no, cada alta de usuario dispararía el aviso). Nunca rompe el login:
 * si la tabla todavía no existe o algo falla, sigue de largo.
 */
export async function recordLogin(userId: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();

    let deviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? "";
    if (!/^[0-9a-f-]{36}$/.test(deviceId)) {
      deviceId = crypto.randomUUID();
      cookieStore.set(DEVICE_COOKIE, deviceId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365 * 2,
      });
    }

    const admin = createAdminClient();
    const [{ data: previous }, { data: memberships }] = await Promise.all([
      admin.from("login_events").select("device_id").eq("user_id", userId).limit(200),
      admin.from("memberships").select("org_id").eq("user_id", userId),
    ]);
    const known = previous ?? [];
    const newDevice = known.length > 0 && !known.some((e) => e.device_id === deviceId);

    const userAgent = headerStore.get("user-agent")?.slice(0, 300) ?? null;
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const orgIds = (memberships ?? []).map((m) => m.org_id);

    await admin.from("login_events").insert(
      (orgIds.length > 0 ? orgIds : [null]).map((orgId) => ({
        org_id: orgId,
        user_id: userId,
        device_id: deviceId,
        user_agent: userAgent,
        ip,
        new_device: newDevice,
      }))
    );
  } catch (e) {
    console.error("No pudimos registrar el ingreso", e);
  }
}

/** "Chrome en Android", "Safari en iPhone"… para mostrar un ingreso. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "otro sistema";
  return `${browser} en ${os}`;
}
