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

/** Un elemento de una ilustración esquemática. `hot` lo resalta (es lo que hay que tocar o mirar en ese paso). */
export type DocMockEl =
  | { t: "btn"; text: string; hot?: boolean; tone?: "primary" | "outline" | "danger" }
  | { t: "input"; text: string; hot?: boolean }
  | { t: "text"; text: string; strong?: boolean; muted?: boolean; hot?: boolean }
  | { t: "chip"; text: string; hot?: boolean }
  | { t: "item"; text: string; detail?: string; price?: string; hot?: boolean }
  | { t: "total"; text: string; price: string; hot?: boolean }
  | { t: "tabs"; items: string[]; active?: number; hot?: number };

/**
 * Ilustración esquemática de una pantalla (no es una captura: se dibuja con la web, se ve en modo claro y oscuro y no se
 * desactualiza por una foto vieja). Cada fila es una línea de elementos; los `hot` marcan dónde tocar.
 */
export interface DocMock {
  /** Nombre de la pantalla o ventana ("Punto de Venta"). */
  title: string;
  rows: DocMockEl[][];
  /** Texto alternativo: qué muestra la ilustración (para lectores de pantalla). */
  caption: string;
}

/** Un paso. Los nombres de botones y pantallas van entre **dobles asteriscos** (se muestran en negrita). */
export interface DocStep {
  text: string;
  /** Aclaración corta debajo del paso. */
  note?: string;
  /** Ilustración esquemática de la pantalla en este paso (opcional). */
  mock?: DocMock;
}

/** Un efecto en otro módulo ("Al vender, el stock baja solo"), con la guía donde se explica. */
export interface DocConnection {
  /** Guía del otro módulo (slug). */
  slug: string;
  /** Qué pasa o qué conviene saber; nombres de botones en **negrita**. */
  text: string;
}

/** Una duda común, con su respuesta completa. */
export interface DocFaq {
  /** La pregunta como la diría la persona ("¿Puedo vender sin tener la caja abierta?"). */
  q: string;
  /** Respuesta clara y autocontenida; nombres de botones en **negrita**. */
  a: string;
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
  /** Qué es y cuándo se usa (uno o dos párrafos cortos), antes de los pasos. */
  intro?: string[];
  steps: DocStep[];
  tips?: string[];
  /** Dudas frecuentes: lo que la gente pregunta después de leer los pasos. */
  faq?: DocFaq[];
  /** Palabras y frases con las que la gente busca esto (sinónimos, formas de decirlo). */
  keywords: string[];
  /** Otras guías relacionadas (slugs). */
  related?: string[];
  /** Cómo se conecta con otros módulos: qué pasa en otra parte del sistema por lo que se hace acá (con la guía de esa parte). */
  connections?: DocConnection[];
  /** Fecha de la última revisión contra el sistema (AAAA-MM-DD). */
  updatedAt: string;
}
