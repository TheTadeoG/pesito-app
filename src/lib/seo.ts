import type { Metadata } from "next";
import { siteUrl } from "@/lib/utils";

/**
 * Metadata consistente para una página pública: título, descripción,
 * canonical y Open Graph/Twitter explícitos (si no se setean acá, el
 * crawler que arma la vista previa usa los de la home para cualquier
 * página, que es peor para SEO/GEO que tener los propios de cada una).
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = `${title} | Pesito`;
  const url = `${siteUrl}${path}`;

  return {
    title,
    description,
    // Next.js no mezcla "alternates" entre el layout raíz y cada página:
    // el que define la página pisa el del layout entero, así que el
    // hreflang autoreferenciado del layout raíz se perdía en cualquier
    // página que use este helper. Se repite acá para que quede en todas.
    alternates: { canonical: path, languages: { "es-AR": url } },
    openGraph: {
      type: "website",
      locale: "es_AR",
      url,
      siteName: "Pesito",
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
