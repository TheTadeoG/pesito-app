import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildForward, isForSupport, parseAddress, verifySvixSignature } from "./inbound-email.ts";

const secretBytes = Buffer.from("clave-de-prueba-1234567890");
const secret = `whsec_${secretBytes.toString("base64")}`;
const body = JSON.stringify({ type: "email.received", data: { email_id: "abc" } });
const id = "msg_1";
const ts = "1700000000";
const sig = createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64");
const base = { secret, id, timestamp: ts, body, nowSeconds: 1700000010 };

// Firma
assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}` }), true);
assert.equal(verifySvixSignature({ ...base, signature: `v1,AAAA v1,${sig}` }), true, "acepta varias firmas");
assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}`, body: body + " " }), false, "cuerpo cambiado");
assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}`, id: "otro" }), false, "id distinto");
assert.equal(verifySvixSignature({ ...base, signature: `v2,${sig}` }), false, "versión desconocida");
assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}`, nowSeconds: 1700000000 + 3600 }), false, "aviso viejo");
assert.equal(verifySvixSignature({ ...base, signature: null }), false);
assert.equal(verifySvixSignature({ ...base, secret: "", signature: `v1,${sig}` }), false, "sin clave no pasa nada");
assert.equal(verifySvixSignature({ ...base, signature: "basura" }), false);

// Direcciones
assert.deepEqual(parseAddress("Ana Pérez <ana@correo.com>"), { name: "Ana Pérez", address: "ana@correo.com" });
assert.deepEqual(parseAddress('"Ana" <ana@correo.com>'), { name: "Ana", address: "ana@correo.com" });
assert.deepEqual(parseAddress("ana@correo.com"), { name: "", address: "ana@correo.com" });
assert.equal(isForSupport(["Soporte <SOPORTE@pesito.com.ar>"], "soporte@pesito.com.ar"), true);
assert.equal(isForSupport(["info@pesito.com.ar"], "soporte@pesito.com.ar"), false);
assert.equal(isForSupport(undefined, "soporte@pesito.com.ar"), false);

// Mail reenviado
const f = buildForward({ from: "Ana <ana@correo.com>", to: ["soporte@pesito.com.ar"], subject: "Ayuda", text: "Hola", html: "<p>Hola</p>", attachmentCount: 2 });
assert.equal(f.subject, "[Soporte] Ayuda");
assert.equal(f.replyTo, "ana@correo.com");
assert.match(f.text, /De: Ana <ana@correo.com>/);
assert.match(f.text, /Adjuntos: 2/);
assert.match(f.html ?? "", /<p>Hola<\/p>/);
assert.equal(buildForward({ from: "x", to: [], subject: "", text: "", html: "", attachmentCount: 0 }).replyTo, undefined, "sin dirección válida no hay Reply-To");
assert.match(buildForward({ from: "a@b.c", to: [], subject: null, text: null, html: null, attachmentCount: 0 }).subject, /sin asunto/);
console.log("inbound-email: ok");
