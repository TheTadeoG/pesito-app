import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Todo lo que no está explícitamente bloqueado abajo se permite
      // por default — no hace falta listar cada página pública nueva acá.
      allow: "/",
      disallow: [
        "/pos",
        "/compras",
        "/productos",
        "/inventario",
        "/clientes",
        "/usuarios",
        "/reportes",
        "/recomendaciones",
        "/baja-rotacion",
        "/configuracion",
        "/soporte",
        "/caja",
        "/onboarding",
        "/auth/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
