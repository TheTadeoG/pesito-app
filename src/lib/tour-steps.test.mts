// Pruebas de tour-steps. Correr con: node --experimental-strip-types src/lib/tour-steps.test.mts
import assert from "node:assert/strict";
import { TOUR_STEPS, stepNumber, visibleSteps } from "./tour-steps.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  -", name);
};

test("los ids son únicos", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("cada skipTo apunta a un paso que viene después", () => {
  TOUR_STEPS.forEach((s, i) => {
    if (!s.skipTo) return;
    const to = TOUR_STEPS.findIndex((t) => t.id === s.skipTo);
    assert.ok(to > i, `${s.id} -> ${s.skipTo}`);
  });
});

test("los pasos que saltan declaran adónde", () => {
  for (const s of TOUR_STEPS) if (s.ifMissing === "skip") assert.ok(s.skipTo, s.id);
});

test("los pasos con 'click' o 'gone' tienen elemento a señalar; sin elemento sólo 'next' o 'appear'", () => {
  for (const s of TOUR_STEPS) {
    if (s.advance.type === "click" || s.advance.type === "gone" || s.advance.type === "enabled") assert.ok(s.target, s.id);
    if (!s.target) assert.ok(s.advance.type === "next" || s.advance.type === "appear", s.id);
  }
});

test("los pasos de menú llevan a dónde decir si no se ven (celular)", () => {
  for (const s of TOUR_STEPS) if (s.path === "*") assert.ok(s.goTo?.startsWith("/"), s.id);
});

test("las rutas son válidas", () => {
  for (const s of TOUR_STEPS) assert.ok(s.path === "*" || s.path.startsWith("/"), s.id);
});

test("los pasos con cartel tienen título y texto; los silenciosos esperan algo", () => {
  for (const s of TOUR_STEPS) {
    if (s.quiet) assert.equal(s.advance.type, "appear", s.id);
    else assert.ok(s.title.length > 3 && s.text.length > 10, s.id);
  }
});

test("el número de paso no cuenta los silenciosos", () => {
  const total = visibleSteps().length;
  assert.equal(total, TOUR_STEPS.length - TOUR_STEPS.filter((s) => s.quiet).length);
  const last = stepNumber(TOUR_STEPS.length - 1);
  assert.equal(last.n, total);
  assert.equal(stepNumber(0).n, 1);
});

console.log(`${passed} pruebas pasaron`);
