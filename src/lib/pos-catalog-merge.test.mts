// Pruebas de pos-catalog-merge. Correr con: node --experimental-strip-types src/lib/pos-catalog-merge.test.mts
import assert from "node:assert/strict";
import { mergeDelta, mergeFull, type CatalogItem, type ChangedRow } from "./pos-catalog-merge.ts";

const item = (id: string, name: string, price = 100, stock = 10): CatalogItem => ({
  id, name, barcode: null, sku: null, price, stock, min_stock: 1, unit: "u", image_url: null,
});
const row = (id: string, name: string, price: number | string = 100, active = true): ChangedRow => ({
  id, name, barcode: null, sku: null, price, min_stock: 1, unit: "u", image_url: null, active,
});
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("ok  -", name); };

const base = [item("a", "Arroz"), item("b", "Bizcocho"), item("c", "Cafe")];

test("delta: cambia el precio y el stock de uno", () => {
  const out = mergeDelta(base, [row("b", "Bizcocho", "150.50")], [["b", "7.00"]], 3)!;
  assert.equal(out.length, 3);
  const b = out.find((p) => p.id === "b")!;
  assert.equal(b.price, 150.5);
  assert.equal(b.stock, 7);
  assert.equal(out.find((p) => p.id === "a")!.stock, 10);
});
test("delta: solo cambia el stock (sin fila en changed)", () => {
  const out = mergeDelta(base, [], [["a", 3]], 3)!;
  assert.equal(out.find((p) => p.id === "a")!.stock, 3);
});
test("delta: producto nuevo", () => {
  const out = mergeDelta(base, [row("d", "Dulce", 50)], [["d", 20]], 4)!;
  assert.equal(out.length, 4);
  assert.equal(out.find((p) => p.id === "d")!.stock, 20);
});
test("delta: producto desactivado sale", () => {
  const out = mergeDelta(base, [row("c", "Cafe", 100, false)], [], 2)!;
  assert.deepEqual(out.map((p) => p.id), ["a", "b"]);
});
test("delta: la cantidad de activos no coincide => null (borrado que no llegó)", () => {
  assert.equal(mergeDelta(base, [], [], 2), null);
  assert.equal(mergeDelta(base, [], [], 4), null);
});
test("delta: producto cambiado sin su stock => null", () => {
  assert.equal(mergeDelta(base, [row("b", "Bizcocho", 120)], [], 3), null);
});
test("delta: stock de un producto que no existe => null", () => {
  assert.equal(mergeDelta(base, [], [["zzz", 1]], 3), null);
});
test("delta: números inválidos => null", () => {
  assert.equal(mergeDelta(base, [row("b", "Bizcocho", "abc")], [["b", 1]], 3), null);
  assert.equal(mergeDelta(base, [], [["a", "x"]], 3), null);
  assert.equal(mergeDelta(base, [], [], -1), null);
  assert.equal(mergeDelta(base, [], [], 1.5), null);
});
test("delta: aplicar dos veces lo mismo da lo mismo", () => {
  const once = mergeDelta(base, [row("b", "Bizcocho", 150)], [["b", 7]], 3)!;
  const twice = mergeDelta(once, [row("b", "Bizcocho", 150)], [["b", 7]], 3)!;
  assert.deepEqual(once, twice);
});
test("delta: reactivar un producto (vuelve con su stock)", () => {
  const without = mergeDelta(base, [row("c", "Cafe", 100, false)], [], 2)!;
  const back = mergeDelta(without, [row("c", "Cafe", 100, true)], [["c", 9]], 3)!;
  assert.equal(back.find((p) => p.id === "c")!.stock, 9);
});
test("delta: copia vacía + delta no alcanza => null", () => {
  assert.equal(mergeDelta([], [row("a", "Arroz")], [["a", 1]], 3), null);
});
test("full: arma desde la lista oficial y descarta lo que no figura", () => {
  const out = mergeFull(base, [row("a", "Arroz", 99)], [["a", 5], ["b", 6]])!;
  assert.deepEqual(out.map((p) => [p.id, p.price, p.stock]), [["a", 99, 5], ["b", 100, 6]]);
});
test("full: un producto activo sin datos => null", () => {
  assert.equal(mergeFull(base, [], [["a", 1], ["nuevo", 2]]), null);
});
test("full: ids repetidos => null", () => {
  assert.equal(mergeFull(base, [], [["a", 1], ["a", 2]]), null);
});
test("orden alfabético en español (acentos y mayúsculas)", () => {
  const out = mergeFull([], [row("1", "Ñoquis"), row("2", "arroz"), row("3", "Zapallo"), row("4", "Árbol")], [["1", 1], ["2", 1], ["3", 1], ["4", 1]])!;
  assert.deepEqual(out.map((p) => p.name), ["Árbol", "arroz", "Ñoquis", "Zapallo"]);
});

// Prueba de propiedades: un "servidor" simulado con la misma regla que la base
// (changed = modificados desde `since`; stock = de los modificados o con movimiento)
// y un cliente que sincroniza por delta tiene que quedar siempre igual a la verdad.
test("fuzz: el cliente por delta converge a la verdad (5.000 rondas)", () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  type Truth = { id: string; name: string; price: number; stock: number; active: boolean; updated: number };
  const truth = new Map<string, Truth>();
  let clock = 1;
  let nextId = 0;
  const add = () => { const id = `p${nextId++}`; truth.set(id, { id, name: `Prod ${Math.floor(rnd() * 1e6)}`, price: 100, stock: 50, active: true, updated: clock }); };
  for (let i = 0; i < 40; i++) add();
  const toRow = (t: Truth): ChangedRow => ({ ...row(t.id, t.name, t.price, t.active) });
  let client: CatalogItem[] = [];
  let since = 0;
  const full = () => {
    const act = [...truth.values()].filter((t) => t.active);
    const out = mergeFull([], act.map(toRow), act.map((t) => [t.id, t.stock] as [string, number]))!;
    assert.ok(out);
    client = out; since = clock;
  };
  full();
  for (let round = 0; round < 5000; round++) {
    clock++;
    const ops = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < ops; k++) {
      const all = [...truth.values()];
      const t = all[Math.floor(rnd() * all.length)];
      const r = rnd();
      if (r < 0.5) { t.stock = Math.max(0, t.stock - 1 - Math.floor(rnd() * 3)); t.updated = clock; }
      else if (r < 0.65) { t.stock += 10; t.updated = clock; }
      else if (r < 0.8) { t.price = Math.round(100 + rnd() * 900); t.updated = clock; }
      else if (r < 0.88) { add(); }
      else if (r < 0.94) { t.active = false; t.updated = clock; }
      else { t.active = true; t.updated = clock; }
    }
    if (rnd() < 0.6) { // a veces el cliente sincroniza (con superposición de 1 tic)
      const s = since - 1;
      const changed = [...truth.values()].filter((t) => t.updated > s);
      const stock = changed.filter((t) => t.active).map((t) => [t.id, t.stock] as [string, number]);
      const activeCount = [...truth.values()].filter((t) => t.active).length;
      const merged = mergeDelta(client, changed.map(toRow), stock, activeCount);
      if (merged === null) full(); else { client = merged; since = clock; }
      const expected = [...truth.values()].filter((t) => t.active).map((t) => [t.id, t.price, t.stock]).sort();
      const got = client.map((p) => [p.id, p.price, p.stock]).sort();
      assert.deepEqual(got, expected, `ronda ${round}`);
    }
  }
});
console.log(`\n${passed} pruebas pasaron`);
