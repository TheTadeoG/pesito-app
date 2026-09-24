import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Por default (desde Next 15) una página dinámica (todo el panel, por
    // las cookies de sesión) se considera "vieja" apenas se pinta, así que
    // cada navegación —aunque sea al layout compartido (sidebar/topbar)—
    // vuelve a pedirle todo a Supabase. Con esto, ese layout se reusa
    // hasta 30s entre navegaciones en vez de recalcularse en cada click.
    // No arriesga mostrar datos viejos después de una venta o de abrir/
    // cerrar caja: esos flujos ya llaman router.refresh() (o revalidatePath
    // desde el server action), que fuerza los datos frescos igual, pasando
    // por arriba de este valor.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
