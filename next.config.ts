import type { NextConfig } from "next";

// Cabeceras de seguridad para todo el sitio. Sin CSP completa a propósito
// (el script de tema inline y Speed Insights la complican); frame-ancestors
// alcanza para que nadie meta Pesito dentro de otra web (clickjacking).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // La cámara queda permitida para el sitio (lector de códigos desde el celu).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

// Todo lo que empieza con NEXT_PUBLIC_ se mete en el JavaScript que baja cada
// visitante: una clave secreta ahí queda a la vista de cualquiera. Si alguna
// variable pública tiene una clave secreta de Supabase (sb_secret_... o un JWT
// con rol service_role), el build falla con un mensaje claro. No muestra la clave.
function assertNoSecretInPublicEnv() {
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    let secret = value.trim().startsWith("sb_secret_");
    if (!secret) {
      const parts = value.trim().split(".");
      if (parts.length === 3 && parts[0].startsWith("eyJ")) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
          secret = payload.role === "service_role";
        } catch {
          // No es un JWT legible: no es una clave de Supabase.
        }
      }
    }
    if (secret) {
      throw new Error(
        `La variable ${name} tiene una clave SECRETA de Supabase. Las variables NEXT_PUBLIC_ se publican en el navegador de cada visitante. ` +
          "Usá la clave pública (Publishable key, sb_publishable_..., o la anon) y dejá la secreta sólo en SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_). Si ya estuvo publicada, rotala en Supabase."
      );
    }
  }
}

assertNoSecretInPublicEnv();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Por default (desde Next 15) una página dinámica (todo el panel, por
    // las cookies de sesión) se considera "vieja" apenas se pinta, así que
    // cada navegación —aunque sea al layout compartido (sidebar/topbar)—
    // vuelve a pedirle todo a Supabase. Con esto, ese layout se reusa
    // hasta 30s entre navegaciones en vez de recalcularse en cada click.
    // Abrir/cerrar caja y demás acciones usan revalidatePath, que pasa por
    // arriba de este valor. El POS no (ver CLAUDE.md): después de cobrar,
    // RefreshAfterSale refresca la primera página que se abre fuera del POS.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
