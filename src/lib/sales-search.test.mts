import assert from "node:assert/strict";
import { parseAmount, parseSalesSearch } from "./sales-search.ts";

assert.equal(parseAmount("1.150,50"), 1150.5);
assert.equal(parseAmount("1150"), 1150);
assert.equal(parseAmount("$ 1.150"), 1150);
assert.equal(parseAmount("1,150.50"), 1150.5);
assert.equal(parseAmount("12,5"), 12.5);
assert.equal(parseAmount("abc"), null);
assert.equal(parseAmount("0"), null);

assert.equal(parseSalesSearch("00003-00000004").voucherNumber, 4);
assert.equal(parseSalesSearch("4").voucherNumber, 4);
assert.equal(parseSalesSearch("12345678901234").cae, "12345678901234");
assert.equal(parseSalesSearch("juan").voucherNumber, null);
assert.equal(parseSalesSearch("juan").amount, null);
assert.equal(parseSalesSearch("Juan (kiosco)").text, "Juan kiosco");
