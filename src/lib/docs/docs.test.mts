import assert from "node:assert/strict";
import { docArticles } from "./index.ts";
import { docCategories } from "./categories.ts";
import { buildIndex, normalize, searchDocs, tokens } from "./search.ts";
import { plainText, inlineParts } from "./format.ts";

// --- Datos: lo que la web y el sitemap suponen de cada guía ---
const slugs = new Set<string>();
const categoryIds = new Set(docCategories.map((c) => c.id));
for (const a of docArticles) {
  assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `slug inválido: ${a.slug}`);
  assert.ok(!slugs.has(a.slug), `slug repetido: ${a.slug}`);
  slugs.add(a.slug);
  assert.ok(categoryIds.has(a.category), `${a.slug}: categoría inexistente`);
  assert.ok(a.title.length <= 60, `${a.slug}: el título pasa de 60 caracteres (${a.title.length})`);
  assert.ok(a.summary.length <= 155, `${a.slug}: el resumen pasa de 155 caracteres (${a.summary.length})`);
  assert.ok(a.steps.length >= 2, `${a.slug}: necesita al menos 2 pasos`);
  assert.ok(a.keywords.length >= 3, `${a.slug}: necesita palabras clave`);
  assert.match(a.updatedAt, /^\d{4}-\d{2}-\d{2}$/, `${a.slug}: fecha inválida`);
  assert.equal((a.where.match(/\*\*/g) ?? []).length % 2, 0, `${a.slug}: negritas sin cerrar en "where"`);
  for (const s of a.steps) assert.equal((s.text.match(/\*\*/g) ?? []).length % 2, 0, `${a.slug}: negritas sin cerrar en un paso`);
}
for (const a of docArticles) for (const r of a.related ?? []) assert.ok(slugs.has(r), `${a.slug}: la guía relacionada "${r}" no existe`);

// --- Formato ---
assert.equal(plainText("Tocá **Cobrar** ya"), "Tocá Cobrar ya");
assert.deepEqual(inlineParts("a **b** c"), [{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]);

// --- Buscador ---
assert.equal(normalize("¿Cómo ANULO una Venta?"), "como anulo una venta");
assert.deepEqual(tokens("¿Cómo puedo anular las ventas?"), ["anular", "venta"]);
const index = buildIndex(docArticles);
const top = (q: string) => searchDocs(index, q)[0]?.article.slug;
const has = (q: string, slug: string, n = 3) => searchDocs(index, q).slice(0, n).some((r) => r.article.slug === slug);
assert.ok(has("anular una venta", "como-anular-una-venta", 1), "anular una venta");
assert.ok(has("cancelar una venta", "como-anular-una-venta"), "sinónimo: cancelar");
assert.ok(has("borrar venta", "como-anular-una-venta"), "sinónimo: borrar");
assert.ok(has("abrir caja", "como-abrir-la-caja", 1), "abrir caja");
assert.ok(has("cerrar la caja", "como-cerrar-la-caja", 1), "cerrar la caja");
assert.ok(has("arqueo", "como-cerrar-la-caja"), "arqueo");
assert.ok(has("vender fiado", "como-vender-fiado", 1), "fiado");
assert.ok(has("vuelto", "como-cobrar-en-efectivo-y-dar-vuelto", 1), "vuelto");
assert.ok(has("combo", "como-vender-un-combo-o-kit"), "combo");
assert.ok(has("alt c", "como-vender-un-combo-o-kit") || has("combos", "como-vender-un-combo-o-kit"), "combos");
assert.ok(has("anul", "como-anular-una-venta"), "mientras escribe: anul");
assert.ok(has("atajos", "atajos-de-teclado-del-punto-de-venta", 1), "atajos");
assert.deepEqual(searchDocs(index, ""), []);
assert.deepEqual(searchDocs(index, "como puedo"), [], "solo palabras de relleno no busca nada");
assert.equal(searchDocs(index, "zzzzxxxx").length, 0, "sin coincidencias");
void top;
console.log(`docs: ok (${docArticles.length} guías)`);
