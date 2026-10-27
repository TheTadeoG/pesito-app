import assert from "node:assert/strict";
import { brandFilter, brandKey, brandMatches } from "./market-brands.ts";

const f = brandFilter(undefined);
assert.equal(brandKey("Coca-Cola"), "cocacola");
assert.equal(brandKey("La Serenísima"), "laserenisima");
assert.ok(brandMatches("Coca Cola", f));
assert.ok(brandMatches("COCA-COLA", f));
assert.ok(brandMatches("La Serenísima", f));
assert.ok(brandMatches("Arcor", f));
assert.ok(!brandMatches("Marca Propia XYZ", f));
assert.ok(!brandMatches(null, f));
assert.ok(!brandMatches("Al", f));
// "Ala" no debe entrar por ser el comienzo de otra marca más larga de 3 letras (mínimo 4 para "empieza con").
assert.ok(!brandMatches("Alambre Fino", f));
// Lista propia y "todas".
const mine = brandFilter("Acme, Foo Bar");
assert.ok(brandMatches("foo-bar", mine));
assert.ok(!brandMatches("Arcor", mine));
assert.equal(brandFilter("todas"), null);
assert.ok(brandMatches("Cualquiera", null));
console.log("pruebas de marcas: ok");
