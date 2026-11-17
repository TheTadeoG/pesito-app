import type { DocArticle, DocCategoryId } from "@/lib/docs/types";
import { docCategories } from "@/lib/docs/categories";
import { empezarDocs } from "@/lib/docs/articles/empezar";
import { venderDocs } from "@/lib/docs/articles/vender";
import { cajaDocs } from "@/lib/docs/articles/caja";
import { productosDocs } from "@/lib/docs/articles/productos";
import { stockDocs } from "@/lib/docs/articles/stock";
import { comprasDocs } from "@/lib/docs/articles/compras";
import { clientesDocs } from "@/lib/docs/articles/clientes";
import { reportesDocs } from "@/lib/docs/articles/reportes";
import { comprobantesDocs } from "@/lib/docs/articles/comprobantes";
import { cuentaDocs } from "@/lib/docs/articles/cuenta";

export { docCategories };

/** Todas las guías, en el orden de las categorías. */
export const docArticles: DocArticle[] = [
  ...empezarDocs,
  ...venderDocs,
  ...cajaDocs,
  ...productosDocs,
  ...stockDocs,
  ...comprasDocs,
  ...clientesDocs,
  ...reportesDocs,
  ...comprobantesDocs,
  ...cuentaDocs,
];

export function getDocBySlug(slug: string): DocArticle | undefined {
  return docArticles.find((a) => a.slug === slug);
}

export function docsInCategory(id: DocCategoryId): DocArticle[] {
  return docArticles.filter((a) => a.category === id);
}

/** Fecha de la última revisión más reciente de todas las guías (AAAA-MM-DD). */
export function docsLastUpdated(): string {
  return docArticles.reduce((latest, a) => (a.updatedAt > latest ? a.updatedAt : latest), "2000-01-01");
}
