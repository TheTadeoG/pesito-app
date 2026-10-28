import assert from "node:assert/strict";
import {
  isInternalEan, categoryPageUrl, dedupeByEan, diffPct, fetchStorePrice, leafCategories, parseVtexCatalogPage, MARKET_STORES, normalizeEan, parseVtexProducts, pricePosition, priceStats, roundShelfPrice, suggestPrice,
} from "./market-prices.ts";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve(fn()).then(() => { passed++; }, (e) => { console.error("FALLÓ:", name, e); process.exit(1); });
}

const vtex = [
  {
    productName: "Gaseosa Coca Cola Zero 1,75 L",
    brand: "Coca-Cola",
    link: "https://www.carrefour.com.ar/coca/p",
    items: [
      { ean: "7790895000782", images: [{ imageUrl: "https://img/x.jpg" }], sellers: [{ commertialOffer: { Price: 3499, ListPrice: 3999, AvailableQuantity: 10 } }] },
    ],
  },
];

test("normalizeEan", () => {
  assert.equal(normalizeEan(" 7790895000782 "), "7790895000782");
  assert.equal(normalizeEan("7790-8950-00782"), "7790895000782");
  assert.equal(normalizeEan("123"), null);
  assert.equal(normalizeEan(null), null);
});

test("parseVtexProducts toma la presentación con el mismo EAN", () => {
  const r = parseVtexProducts(vtex, "7790895000782");
  assert.equal(r?.price, 3499);
  assert.equal(r?.listPrice, 3999);
  assert.equal(r?.brand, "Coca-Cola");
  assert.equal(r?.available, true);
  assert.equal(parseVtexProducts(vtex, "7790000000000"), null);
  assert.equal(parseVtexProducts([], "7790895000782"), null);
  assert.equal(parseVtexProducts({ error: 1 }, "7790895000782"), null);
});

test("parseVtexProducts ignora ofertas sin precio y marca sin stock", () => {
  const sinPrecio = [{ items: [{ ean: "7790895000782", sellers: [{ commertialOffer: { Price: 0 } }] }] }];
  assert.equal(parseVtexProducts(sinPrecio, "7790895000782"), null);
  const agotado = [{ items: [{ ean: "7790895000782", sellers: [{ commertialOffer: { Price: 100, AvailableQuantity: 0 } }] }] }];
  assert.equal(parseVtexProducts(agotado, "7790895000782")?.available, false);
});

test("priceStats y mediana", () => {
  assert.deepEqual(priceStats([100, 300, 200]), { min: 100, max: 300, median: 200, stores: 3 });
  assert.equal(priceStats([100, 200])?.median, 150);
  assert.equal(priceStats([]), null);
  assert.equal(priceStats([0, NaN]), null);
});

test("posición contra los súper", () => {
  const stats = priceStats([1000, 1000, 1000])!;
  assert.equal(diffPct(1100, stats), 10);
  assert.equal(pricePosition(1000, stats), "en-rango");
  assert.equal(pricePosition(1250, stats), "caro");
  assert.equal(pricePosition(1400, stats), "muy-caro");
  assert.equal(pricePosition(800, stats), "barato");
  assert.equal(pricePosition(700, stats), "muy-barato");
});

test("precio sugerido", () => {
  assert.equal(roundShelfPrice(1234), 1230);
  assert.equal(roundShelfPrice(3499), 3500);
  const stats = priceStats([1000, 1000])!;
  assert.equal(suggestPrice(stats, null).price, 970);
  // Con costo alto, el piso es costo + 10%.
  assert.equal(suggestPrice(stats, 950).price, 1050);
});

test("fetchStorePrice: 404 = no lo tiene; 500 = error; 206 sirve", async () => {
  const store = MARKET_STORES[0];
  const mk = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  assert.equal(await fetchStorePrice(store, "7790895000782", mk(404, null)), null);
  await assert.rejects(() => fetchStorePrice(store, "7790895000782", mk(500, null)));
  assert.equal((await fetchStorePrice(store, "7790895000782", mk(206, vtex)))?.price, 3499);
  assert.equal((await fetchStorePrice(store, "7790895000782", mk(200, vtex)))?.price, 3499);
});

test("categorías hoja con su ruta", () => {
  const tree = [
    { id: 1, name: "Bebidas", children: [{ id: 10, name: "Gaseosas", children: [] }, { id: 11, name: "Aguas", children: [{ id: 110, name: "Saborizadas" }] }] },
    { id: 2, name: "Almacén" },
    { name: "sin id" },
  ];
  assert.deepEqual(leafCategories(tree).map((c) => c.path), ["1/10", "1/11/110", "2"]);
  assert.deepEqual(leafCategories({ x: 1 }), []);
});

test("página de catálogo: todas las presentaciones con EAN y precio", () => {
  const page = [
    { productName: "Coca", brand: "Coca-Cola", link: "/coca/p", items: [
      { ean: "7790895000782", nameComplete: "Coca 1,75 L", sellers: [{ commertialOffer: { Price: 3499, ListPrice: 3499, AvailableQuantity: 5 } }] },
      { ean: "7790895000799", nameComplete: "Coca 2,25 L", sellers: [{ commertialOffer: { Price: 0 } }] },
      { ean: "x", sellers: [{ commertialOffer: { Price: 10 } }] },
    ] },
    { productName: "Otra", items: [{ ean: "7790895000782", sellers: [{ commertialOffer: { Price: 3600 } }] }] },
  ];
  const { items, products } = parseVtexCatalogPage(page);
  assert.equal(products, 2);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Coca 1,75 L");
  assert.equal(dedupeByEan(items).length, 1);
  assert.deepEqual(parseVtexCatalogPage({ nope: 1 }), { items: [], products: 0 });
});

test("url de página de categoría", () => {
  assert.equal(
    categoryPageUrl(MARKET_STORES[0], "1/10", 50),
    "https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=C:/1/10/&_from=50&_to=99"
  );
});

test("códigos internos (200-299)", () => {
  assert.equal(isInternalEan("2990000000972"), true);
  assert.equal(isInternalEan("2000000000001"), true);
  assert.equal(isInternalEan("7790895000782"), false);
  assert.equal(isInternalEan("787985452315"), false);
});

setTimeout(() => console.log(`${passed} pruebas pasaron`), 200);
