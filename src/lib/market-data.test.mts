import assert from "node:assert/strict";
import { cacheValidUntil } from "./market-prices.ts";

const at = (iso: string) => Date.parse(iso);
const now = at("2026-10-28T12:00:00Z");

// Sin precios: pocos minutos (puede que todavía no se hayan juntado).
assert.equal(cacheValidUntil(now, null), now + 5 * 60 * 1000);
// Precios de hoy (se siguen juntando): pocos minutos.
assert.equal(cacheValidUntil(now, at("2026-10-28T10:00:00Z")), now + 5 * 60 * 1000);
// Precios de hace días: hasta el 1 del mes que viene.
assert.equal(cacheValidUntil(now, at("2026-10-20T10:00:00Z")), at("2026-11-01T00:00:00Z"));
assert.equal(cacheValidUntil(at("2026-12-20T08:00:00Z"), at("2026-12-02T10:00:00Z")), at("2027-01-01T00:00:00Z"));
console.log("pruebas de caché de precios: ok");
