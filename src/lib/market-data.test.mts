import assert from "node:assert/strict";
import { cacheValidUntil } from "./market-prices.ts";

const at = (iso: string) => Date.parse(iso);

// Mientras el cron junta (días 1 a 11): sólo una hora.
assert.equal(cacheValidUntil(at("2026-11-03T12:00:00Z")), at("2026-11-03T13:00:00Z"));
// Pasada la ventana: hasta el día 1 del mes siguiente.
assert.equal(cacheValidUntil(at("2026-11-12T08:00:00Z")), at("2026-12-01T00:00:00Z"));
assert.equal(cacheValidUntil(at("2026-12-20T08:00:00Z")), at("2027-01-01T00:00:00Z"));
console.log("pruebas de caché de precios: ok");
