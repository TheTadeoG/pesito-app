// Guías de ayuda (/ayuda): "cómo hacer cada cosa" en pasos numerados. Fuente única: alimenta la página de ayuda, el
// buscador, el sitemap y llms.txt. Cada cambio de pantalla o de función obliga a revisar la guía que la cuenta
// (ver CLAUDE.md, "Mantener los textos al día"). Sin servidor ni imports del panel: es contenido de la web pública.

/** Plan mínimo que incluye la función (null = todos los planes, incluido el Gratis). */
export type DocPlan = "basico" | "pro" | "max";

export const DOC_CATEGORY_IDS = [
  "empezar",
  "vender",
  "caja",
  "productos",
  "stock",
  "compras",
  "clientes",
  "reportes",
  "comprobantes",
  "cuenta",
] as const;

export type DocCategoryId = (typeof DOC_CATEGORY_IDS)[number];

export interface DocCategory {
  id: DocCategoryId;
  title: string;
  description: string;
}

/** Un paso. Los nombres de botones y pantallas van entre **dobles asteriscos** (se muestran en negrita). */
export interface DocStep {
  text: string;
  /** Aclaración corta debajo del paso. */
  note?: string;
}

export interface DocArticle {
  /** Va en la dirección (/ayuda/<slug>): minúsculas, sin tildes, con guiones. */
  slug: string;
  /** Lo que la persona quiere hacer ("Cómo anular una venta"). Hasta 60 caracteres. */
  title: string;
  category: DocCategoryId;
  /** Una o dos frases: qué se logra y para qué sirve. Hasta 155 caracteres. */
  summary: string;
  /** Desde qué plan está disponible (null = todos). */
  plan: DocPlan | null;
  /** Dónde está en el sistema, con los nombres reales del menú ("Productos → Nuevo producto"). */
  where: string;
  /** Qué conviene tener antes de empezar. */
  before?: string[];
  steps: DocStep[];
  tips?: string[];
  /** Palabras y frases con las que la gente busca esto (sinónimos, formas de decirlo). */
  keywords: string[];
  /** Otras guías relacionadas (slugs). */
  related?: string[];
  /** Fecha de la última revisión contra el sistema (AAAA-MM-DD). */
  updatedAt: string;
}
