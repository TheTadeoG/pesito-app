import assert from "node:assert/strict";
import { cleanDocument, documentError, formatDocument, inferDocumentType, isValidCuit } from "./tax-id.ts";

// Guiones reglamentarios: después de los 2 primeros dígitos y antes del último, a medida que se escribe.
assert.equal(formatDocument("2", "cuit"), "2");
assert.equal(formatDocument("20", "cuit"), "20");
assert.equal(formatDocument("201", "cuit"), "20-1");
assert.equal(formatDocument("2012345678", "cuit"), "20-12345678");
assert.equal(formatDocument("20123456786", "cuit"), "20-12345678-6");
assert.equal(formatDocument("20-12345678-6-99", "cuit"), "20-12345678-6");
assert.equal(formatDocument("30.123.456", "dni"), "30123456");
assert.equal(formatDocument("ab-123456", "pasaporte"), "AB123456");
assert.equal(cleanDocument("20-12345678-6", "cuit"), "20123456786");

assert.equal(isValidCuit("20123456786"), true);
assert.equal(isValidCuit("20123456789"), false);
assert.equal(documentError("20123456789", "cuit"), "Ese CUIT no es válido: revisá los números.");
assert.equal(documentError("1234567", "dni"), null);
assert.equal(documentError("123", "dni"), "El DNI tiene 7 u 8 dígitos.");
assert.equal(documentError("", "cuit"), null);
assert.equal(inferDocumentType("30123456"), "dni");
assert.equal(inferDocumentType("20-12345678-6"), "cuit");
