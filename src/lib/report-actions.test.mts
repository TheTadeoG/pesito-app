import assert from "node:assert/strict";
import { buildReportActions, type ReportActionsInput } from "./report-actions.ts";

const base: ReportActionsInput = {
  lowStock: 0, negativeStock: 0, debtorCount: 0, debtTotal: 0, lossProducts: 0, lowMargin: 0, marginPercent: 10,
  idleCount: 0, idleCapital: 0, idleDays: 30, salesCount: 0, ingresos: 0, ganancia: null, deltaPct: null,
  topMargin: null, topQuantity: null, soldAtLoss: null, fiadoShare: 0, cashShortages: null,
};

// Sin datos no se inventa nada.
assert.deepEqual(buildReportActions(base), []);

// Stock bajo y fiado van en "sumar"; vender a pérdida y stock parado en "revisar".
const r = buildReportActions({ ...base, lowStock: 4, debtTotal: 15000, debtorCount: 2, lossProducts: 1, idleCount: 3, idleCapital: 90000 });
assert.deepEqual(r.map((a) => a.id), ["reponer", "cobrar", "perdida", "parado"]);
assert.equal(r.find((a) => a.id === "reponer")?.group, "sumar");
assert.equal(r.find((a) => a.id === "perdida")?.group, "revisar");

// Stock negativo es más urgente que cobrar, y el tope por grupo se respeta.
const many = buildReportActions({ ...base, negativeStock: 1, lowStock: 2, debtTotal: 1, debtorCount: 1, deltaPct: -30, salesCount: 20,
  topMargin: { name: "A", margin: 1000 }, topQuantity: { name: "B" } }, 2);
assert.equal(many.filter((a) => a.group === "sumar").length, 2);
assert.equal(many[0].id, "reponer");
assert.equal(many[0].tone, "danger");

// Mismo producto el que más se vende y el que más deja: no hay nada que "empujar".
assert.equal(buildReportActions({ ...base, salesCount: 50, topMargin: { name: "A", margin: 5 }, topQuantity: { name: "A" } }).length, 0);
// Pocas ventas: no opina sobre el producto estrella.
assert.equal(buildReportActions({ ...base, salesCount: 3, topMargin: { name: "A", margin: 5 }, topQuantity: { name: "B" } }).length, 0);
console.log("report-actions: ok");
