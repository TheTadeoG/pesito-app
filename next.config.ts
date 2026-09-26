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
