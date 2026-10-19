// Pruebas de error-fingerprint. Correr con: node --experimental-strip-types src/lib/error-fingerprint.test.mts
import assert from "node:assert/strict";
import { errorFingerprint, isIgnorableError, scrub } from "./error-fingerprint.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  -", name);
};
const stack = (line: number) => `Error: x\n    at saveSale (/var/task/.next/server/app/pos.js:${line}:12)\n    at other (/var/task/a.js:1:1)`;

test("el mismo error con otros números, ids o líneas tiene la misma huella", () => {
  const a = errorFingerprint("server", "Producto 123 sin stock (id 1b4e28ba-2fa1-11d2-883f-0016d3cca427)", stack(10));
  const b = errorFingerprint("server", "Producto 987 sin stock (id 9b4e28ba-2fa1-11d2-883f-0016d3cca427)", stack(99));
  assert.equal(a, b);
});

test("errores distintos o de otro origen tienen huellas distintas", () => {
  assert.notEqual(errorFingerprint("server", "No se pudo cobrar", stack(1)), errorFingerprint("server", "No se pudo anular", stack(1)));
  assert.notEqual(errorFingerprint("server", "No se pudo cobrar", stack(1)), errorFingerprint("client", "No se pudo cobrar", stack(1)));
});

test("scrub saca emails y tokens y acorta", () => {
  assert.equal(scrub("falló para ana@gmail.com ahora", 100), "falló para <email> ahora");
  assert.ok(scrub("token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc", 100).includes("<token>"));
  assert.equal(scrub("palabra ".repeat(10), 10).length, 10);
});

test("se ignoran redirecciones, cortes de red y ruido del navegador", () => {
  for (const m of ["NEXT_REDIRECT", "Failed to fetch", "ResizeObserver loop limit exceeded", "Loading chunk 12 failed", "Script error."]) {
    assert.ok(isIgnorableError(m), m);
  }
  assert.ok(!isIgnorableError("Cannot read properties of undefined (reading 'total')"));
});

console.log(`${passed} pruebas pasaron`);
