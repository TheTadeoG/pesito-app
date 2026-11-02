import assert from "node:assert/strict";
import { allowedInvoiceTypes } from "./invoice-labels.ts";

assert.deepEqual(allowedInvoiceTypes(null, ""), ["consumidor_final"]);
assert.deepEqual(allowedInvoiceTypes("monotributo", "responsable_inscripto"), ["consumidor_final", "factura_c"]);
assert.deepEqual(allowedInvoiceTypes("exento", ""), ["consumidor_final", "factura_c"]);
assert.deepEqual(allowedInvoiceTypes("responsable_inscripto", "responsable_inscripto"), ["consumidor_final", "factura_a"]);
assert.deepEqual(allowedInvoiceTypes("responsable_inscripto", "monotributo"), ["consumidor_final", "factura_b"]);
assert.deepEqual(allowedInvoiceTypes("responsable_inscripto", "consumidor_final"), ["consumidor_final", "factura_b"]);
assert.deepEqual(allowedInvoiceTypes("responsable_inscripto", ""), ["consumidor_final", "factura_a", "factura_b"]);
