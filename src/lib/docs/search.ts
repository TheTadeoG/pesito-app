// Buscador de las guías de ayuda: corre en el navegador sobre unas decenas de guías (sin servidor ni IA). Sin tildes ni
// mayúsculas, con sinónimos y con coincidencia de comienzos de palabra (mientras se escribe).
import type { DocArticle } from "@/lib/docs/types";

const STOPWORDS = new Set([
  "como", "hacer", "puedo", "quiero", "necesito", "se", "me", "mi", "mis", "un", "una", "unos", "unas", "el", "la", "los", "las",
  "de", "del", "al", "en", "con", "por", "para", "que", "y", "o", "a", "lo", "es", "si", "no", "hago", "haga", "ver", "tengo",
  "donde", "cuando", "cual", "cuanto", "pesito", "sistema", "poder", "puede", "pueden", "sirve",
]);

/** Grupos de palabras que significan lo mismo para quien busca. */
const SYNONYM_GROUPS: string[][] = [
  ["anular", "cancelar", "borrar", "eliminar", "deshacer", "revertir", "devolver", "devolucion"],
  ["cobrar", "cobro", "vender", "venta", "ventas", "vendo", "vendes"],
  ["fiado", "fiar", "deuda", "cuenta corriente", "debe", "deben", "adeuda"],
  ["caja", "arqueo", "efectivo"],
  ["producto", "productos", "articulo", "articulos", "mercaderia", "item"],
  ["precio", "precios", "costo", "costos", "aumento", "aumentos", "remarcar", "remarque", "actualizar"],
  ["stock", "existencia", "existencias", "inventario", "cantidad", "unidades"],
  ["factura", "facturar", "facturacion", "arca", "afip", "cae", "comprobante"],
  ["ticket", "imprimir", "impresora", "termica", "recibo"],
  ["excel", "planilla", "csv", "importar", "exportar", "descargar", "subir", "masiva", "masivo"],
  ["talle", "talles", "color", "colores", "variante", "variantes"],
  ["combo", "combos", "kit", "kits", "pack", "promo"],
  ["proveedor", "proveedores", "compra", "compras", "pedido", "pedidos"],
  ["usuario", "usuarios", "equipo", "empleado", "empleados", "vendedor", "vendedores", "invitar", "permisos", "rol", "roles"],
  ["plan", "planes", "suscripcion", "pagar", "pago", "mensual", "anual", "upgrade", "mejorar"],
  ["contrasena", "clave", "password", "olvide", "recuperar", "restablecer"],
  ["sucursal", "sucursales", "local", "locales", "transferir", "transferencia"],
  ["reporte", "reportes", "ganancia", "ganancias", "estadistica", "estadisticas", "informe", "margen"],
  ["codigo", "barras", "etiqueta", "etiquetas", "lector", "escanear"],
  ["descuento", "recargo", "interes", "porcentaje"],
];

const synonymIndex = new Map<string, string>();
SYNONYM_GROUPS.forEach((group, i) => group.forEach((w) => synonymIndex.set(w, `g${i}`)));

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Singulariza de forma simple ("ventas" -> "venta", "clientes" -> "cliente") para que coincidan plural y singular. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

interface Indexed {
  article: DocArticle;
  title: string[];
  keywords: string[];
  summary: string[];
  body: string[];
}

export function buildIndex(articles: DocArticle[]): Indexed[] {
  return articles.map((article) => ({
    article,
    title: tokens(article.title),
    keywords: tokens(article.keywords.join(" ")),
    summary: tokens(`${article.summary} ${article.where} ${(article.faq ?? []).map((f) => f.q).join(" ")}`),
    body: tokens(
      `${(article.intro ?? []).join(" ")} ${article.steps.map((s) => `${s.text} ${s.note ?? ""}`).join(" ")} ${(article.faq ?? []).map((f) => f.a).join(" ")}`
    ),
  }));
}

/** ¿La palabra buscada coincide con la del texto? Igual, sinónimo, o comienzo de palabra (mientras escribe). */
function matchKind(query: string, word: string): "exact" | "synonym" | "prefix" | null {
  if (query === word) return "exact";
  const qs = synonymIndex.get(query);
  const ws = synonymIndex.get(word);
  if (qs && qs === ws) return "synonym";
  if (query.length >= 3 && word.startsWith(query)) return "prefix";
  return null;
}

const WEIGHTS = { title: 6, keywords: 5, summary: 2, body: 1 } as const;
const KIND_FACTOR = { exact: 1, synonym: 0.7, prefix: 0.6 } as const;

function fieldScore(queryWord: string, fieldWords: string[], weight: number): number {
  let best = 0;
  for (const w of fieldWords) {
    const kind = matchKind(queryWord, w);
    if (kind) best = Math.max(best, weight * KIND_FACTOR[kind]);
  }
  return best;
}

export interface DocSearchResult {
  article: DocArticle;
  score: number;
}

/**
 * Busca en las guías. Cada palabra de la pregunta suma según dónde aparece (título > palabras clave > resumen > pasos). Si
 * hay varias palabras, tienen que aparecer casi todas: así "anular venta" no trae cualquier guía que diga "venta".
 */
export function searchDocs(index: Indexed[], query: string): DocSearchResult[] {
  const q = Array.from(new Set(tokens(query)));
  if (q.length === 0) return [];
  const results: DocSearchResult[] = [];
  for (const item of index) {
    let total = 0;
    let matched = 0;
    for (const word of q) {
      const s = Math.max(
        fieldScore(word, item.title, WEIGHTS.title),
        fieldScore(word, item.keywords, WEIGHTS.keywords),
        fieldScore(word, item.summary, WEIGHTS.summary),
        fieldScore(word, item.body, WEIGHTS.body)
      );
      if (s > 0) {
        matched += 1;
        total += s;
      }
    }
    const needed = q.length <= 2 ? q.length : Math.ceil(q.length * 0.6);
    if (matched >= needed && total > 0) results.push({ article: item.article, score: total * (matched / q.length) });
  }
  return results.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, "es"));
}
