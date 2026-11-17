import manifest from "../../../public/ayuda/manifest.json";
import { siteUrl } from "@/lib/utils";
import type { DocArticle } from "@/lib/docs/types";

// Capturas de las guías (public/ayuda): URL absoluta y tamaño, para el sitemap de imágenes, los datos estructurados y la
// imagen de vista previa. Aparte de index.ts para que la prueba en Node no tenga que cargar el JSON ni el alias "@/".

export interface DocImageInfo {
  name: string;
  alt: string;
  url: string;
  width: number;
  height: number;
}

const sizes = manifest as Record<string, { w: number; h: number }>;

/** Todas las capturas de una guía, en el orden de los pasos (sin repetir). */
export function docImagesOf(article: DocArticle): DocImageInfo[] {
  const seen = new Set<string>();
  const out: DocImageInfo[] = [];
  for (const step of article.steps) {
    for (const img of step.images ?? []) {
      const size = sizes[img.name];
      if (!size || seen.has(img.name)) continue;
      seen.add(img.name);
      out.push({ name: img.name, alt: img.alt, url: `${siteUrl}/ayuda/${img.name}.webp`, width: size.w, height: size.h });
    }
  }
  return out;
}
