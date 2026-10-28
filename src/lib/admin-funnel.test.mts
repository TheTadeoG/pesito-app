// Pruebas de admin-funnel. Correr con: node --experimental-strip-types src/lib/admin-funnel.test.mts
import assert from "node:assert/strict";
import { computeFunnel, formatDuration, type OrgActivity, type OrgSubscription } from "./admin-funnel.ts";

const NOW = new Date("2026-10-19T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const org = (id: string, over: Partial<OrgActivity> = {}): OrgActivity => ({
  org_id: id,
  created_at: iso(-10 * DAY),
  first_product_at: null,
  first_sale_at: null,
  sale_count: 0,
  has_purchase: false,
  has_cash: false,
  has_cash_closed: false,
  has_customer: false,
  has_supplier: false,
  member_count: 1,
  ...over,
});
const price = (plan: string, cycle: "mensual" | "anual" | null) => ({ basico: 17000, pro: 29000, max: 34000 }[plan] ?? 0) * (cycle === "anual" ? 0.8 : 1);
let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  -", name);
};

test("el embudo cuenta cada paso y los porcentajes", () => {
  const activity = [
    org("a"),
    org("b", { first_product_at: iso(-9 * DAY) }),
    org("c", { first_product_at: iso(-9 * DAY), first_sale_at: iso(-9 * DAY + 3 * 60 * 60 * 1000), sale_count: 5 }),
    org("d", { first_product_at: iso(-9 * DAY), first_sale_at: iso(-8 * DAY), sale_count: 2 }),
  ];
  const subs = new Map<string, OrgSubscription>([["d", { plan: "pro", trialEndsAt: iso(-1 * DAY), paidViaMp: true, cycle: "mensual" }]]);
  const r = computeFunnel({ signedUpOwners: 6, activity, subscriptions: subs, monthlyPrice: price, now: NOW });
  assert.deepEqual(r.steps.map((s) => s.count), [6, 4, 3, 2, 1]);
  assert.equal(Math.round(r.steps[1].pctPrev ?? 0), 67);
  assert.equal(Math.round(r.steps[4].pctPrev ?? 0), 50);
  assert.equal(r.mrr, 29000);
  assert.equal(r.payingOrgs, 1);
});

test("mediana de horas hasta la primera venta", () => {
  const activity = [
    org("a", { first_sale_at: iso(-10 * DAY + 2 * 60 * 60 * 1000) }),
    org("b", { first_sale_at: iso(-10 * DAY + 4 * 60 * 60 * 1000) }),
    org("c", { first_sale_at: iso(-10 * DAY + 30 * 60 * 60 * 1000) }),
  ];
  const r = computeFunnel({ signedUpOwners: 3, activity, subscriptions: new Map(), monthlyPrice: price, now: NOW });
  assert.equal(r.medianHoursToFirstSale, 4);
  assert.equal(formatDuration(4), "4 h");
  assert.equal(formatDuration(72), "3 días");
  assert.equal(formatDuration(null), "—");
});

test("prueba Pro: activas, por vencer, vencidas sin pagar y convertidas", () => {
  const activity = ["a", "b", "c", "d", "e"].map((id) => org(id));
  const subs = new Map<string, OrgSubscription>([
    ["a", { plan: "gratis", trialEndsAt: iso(5 * DAY), paidViaMp: false, cycle: null }], // activa
    ["b", { plan: "gratis", trialEndsAt: iso(2 * DAY), paidViaMp: false, cycle: null }], // por vencer
    ["c", { plan: "gratis", trialEndsAt: iso(-3 * DAY), paidViaMp: false, cycle: null }], // venció sin pagar
    ["d", { plan: "basico", trialEndsAt: iso(-3 * DAY), paidViaMp: true, cycle: "anual" }], // convirtió
    ["e", { plan: "pro", trialEndsAt: iso(-3 * DAY), paidViaMp: false, cycle: null }], // plan a mano: no cuenta
  ]);
  const r = computeFunnel({ signedUpOwners: 5, activity, subscriptions: subs, monthlyPrice: price, now: NOW });
  assert.equal(r.trial.active, 2);
  assert.equal(r.trial.endingSoon, 1);
  assert.equal(r.trial.expiredUnpaid, 1);
  assert.equal(r.trial.converted, 1);
  assert.equal(r.trial.conversionPct, 50);
  assert.equal(r.mrr, 13600);
});

test("adopción: sobre los negocios que vendieron", () => {
  const activity = [
    org("a", { first_sale_at: iso(-1 * DAY), has_cash: true, has_purchase: true }),
    org("b", { first_sale_at: iso(-1 * DAY), has_cash: true }),
    org("c", { has_cash: true }), // no vendió: no cuenta
  ];
  const r = computeFunnel({ signedUpOwners: 3, activity, subscriptions: new Map(), monthlyPrice: price, now: NOW });
  assert.equal(r.sellingOrgs, 2);
  assert.equal(r.adoption.find((x) => x.label === "Abrieron una caja")?.count, 2);
  assert.equal(r.adoption.find((x) => x.label === "Registraron una compra")?.pct, 50);
});

test("sin datos no rompe", () => {
  const r = computeFunnel({ signedUpOwners: 0, activity: [], subscriptions: new Map(), monthlyPrice: price, now: NOW });
  assert.equal(r.steps[1].pctPrev, null);
  assert.equal(r.trial.conversionPct, null);
  assert.equal(r.medianHoursToFirstSale, null);
});

console.log(`${passed} pruebas pasaron`);
