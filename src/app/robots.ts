import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pesito.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/registro"],
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
