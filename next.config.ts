import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
