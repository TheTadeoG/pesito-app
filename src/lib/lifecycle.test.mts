// Pruebas de lifecycle. Correr con: node --experimental-strip-types src/lib/lifecycle.test.mts
import assert from "node:assert/strict";
import { pickEmail, type OrgLifecycleState } from "./lifecycle.ts";
import { renderLifecycleEmail } from "./lifecycle-templates.ts";

const NOW = new Date("2026-10-19T15:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const state = (over: Partial<OrgLifecycleState> = {}): OrgLifecycleState => ({
  createdAt: iso(-1 * 60 * 60 * 1000),
  productCount: 0,
  saleCount: 0,
  plan: "gratis",
  trialEndsAt: iso(13 * DAY),
  paidViaMp: false,
  paymentStatus: null,
  ownerEmail: "dueno@mail.com",
  optedOut: false,
  sent: [],
  ...over,
});
let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  -", name);
};

test("negocio recién creado: bienvenida", () => assert.equal(pickEmail(state(), NOW)?.template, "welcome"));
test("la bienvenida no se repite", () => assert.equal(pickEmail(state({ sent: [{ kind: "welcome", sentAt: iso(-1 * DAY) }] }), NOW), null));
test("sin productos al día siguiente: cargá productos (pasado el descanso de 2 días)", () => {
  const s = state({ createdAt: iso(-3 * DAY), sent: [{ kind: "welcome", sentAt: iso(-3 * DAY) }] });
  assert.equal(pickEmail(s, NOW)?.template, "add_products");
});
test("hay descanso de 2 días entre correos", () => {
  const s = state({ createdAt: iso(-2 * DAY), sent: [{ kind: "welcome", sentAt: iso(-1 * DAY) }] });
  assert.equal(pickEmail(s, NOW), null);
});
test("con productos y sin ventas a los 3 días: primera venta", () => {
  const s = state({ createdAt: iso(-4 * DAY), productCount: 20, sent: [{ kind: "welcome", sentAt: iso(-4 * DAY) }] });
  assert.equal(pickEmail(s, NOW)?.template, "first_sale");
});
test("si ya vendió no se le insiste", () => {
  const s = state({ createdAt: iso(-4 * DAY), productCount: 20, saleCount: 3, sent: [{ kind: "welcome", sentAt: iso(-4 * DAY) }] });
  assert.equal(pickEmail(s, NOW), null);
});
test("prueba por vencer (3 días o menos)", () => {
  const s = state({ createdAt: iso(-11 * DAY), productCount: 5, saleCount: 5, trialEndsAt: iso(2 * DAY), sent: [{ kind: "welcome", sentAt: iso(-11 * DAY) }] });
  assert.equal(pickEmail(s, NOW)?.template, "trial_ending");
});
test("prueba vencida hace poco: terminó la prueba; hace mucho, nada", () => {
  const base = { createdAt: iso(-20 * DAY), productCount: 5, saleCount: 5, sent: [{ kind: "welcome", sentAt: iso(-20 * DAY) }] };
  assert.equal(pickEmail(state({ ...base, trialEndsAt: iso(-2 * DAY) }), NOW)?.template, "trial_ended");
  assert.equal(pickEmail(state({ ...base, trialEndsAt: iso(-9 * DAY) }), NOW), null);
});
test("quien ya paga no recibe los de la prueba", () => {
  const s = state({ createdAt: iso(-20 * DAY), productCount: 5, saleCount: 5, plan: "pro", paidViaMp: true, trialEndsAt: iso(2 * DAY), sent: [{ kind: "welcome", sentAt: iso(-20 * DAY) }] });
  assert.equal(pickEmail(s, NOW), null);
});
test("pago fallido: tiene prioridad y se repite a lo sumo una vez por semana", () => {
  const s = state({ createdAt: iso(-30 * DAY), productCount: 5, saleCount: 5, plan: "pro", paidViaMp: true, paymentStatus: "past_due", sent: [{ kind: "welcome", sentAt: iso(-30 * DAY) }] });
  const first = pickEmail(s, NOW);
  assert.equal(first?.template, "payment_failed");
  const again = pickEmail({ ...s, sent: [...s.sent, { kind: first!.kind, sentAt: iso(-1 * DAY) }] }, NOW + 0);
  assert.equal(again, null);
});
test("baja o sin email del dueño: nada", () => {
  assert.equal(pickEmail(state({ optedOut: true }), NOW), null);
  assert.equal(pickEmail(state({ ownerEmail: null }), NOW), null);
});

const ctx = {
  orgName: "Kiosco Tadeo",
  siteUrl: "https://www.pesito.com.ar",
  unsubscribeUrl: "https://www.pesito.com.ar/api/lifecycle/baja?o=x&t=y",
  plans: { esencial: { name: "Plan Básico", priceLabel: "$17.000", promoLabel: "$15.000" }, pro: { name: "Plan Pro", priceLabel: "$29.000" } },
  trialEndsAt: iso(2 * DAY),
  graceUntil: iso(5 * DAY),
};
test("cada correo trae asunto, el link de baja y ninguna promesa de más", () => {
  for (const t of ["welcome", "add_products", "first_sale", "trial_ending", "trial_ended", "payment_failed"] as const) {
    const m = renderLifecycleEmail(t, ctx);
    assert.ok(m.subject.length > 5, t);
    assert.ok(m.text.includes(ctx.unsubscribeUrl), t);
    assert.ok(!/factura electr/i.test(m.text), t);
  }
  assert.ok(renderLifecycleEmail("trial_ending", ctx).text.includes("$15.000"));
  assert.ok(renderLifecycleEmail("payment_failed", ctx).text.includes("Tenés hasta el"));
});

console.log(`${passed} pruebas pasaron`);
