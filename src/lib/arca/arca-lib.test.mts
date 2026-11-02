import assert from "node:assert/strict";
import forge from "node-forge";
import { decryptSecret, encryptSecret, encryptionConfigured } from "./crypto.ts";
import { certificateFromFile } from "./cert-file.ts";
import { invoiceLines, receiverFromDocument } from "./sale-invoice.ts";
import { checkCertificate, cleanSubjectText, createCsr, isValidCuit } from "./csr.ts";

const key = Buffer.alloc(32, 7).toString("base64");

// Cifrado
const enc = encryptSecret("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----", key);
assert.ok(enc.startsWith("v1:"));
assert.equal(decryptSecret(enc, key), "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
assert.notEqual(encryptSecret("x", key), encryptSecret("x", key)); // iv distinto
assert.throws(() => decryptSecret(enc, Buffer.alloc(32, 8).toString("base64"))); // otra clave
assert.throws(() => encryptSecret("x", "corta"));
assert.equal(encryptionConfigured(key), true);
assert.equal(encryptionConfigured(undefined), false);
const tampered = enc.slice(0, -4) + (enc.endsWith("AAAA") ? "BBBB" : "AAAA");
assert.throws(() => decryptSecret(tampered, key));

// CUIT
assert.equal(isValidCuit("20123456786"), true);
assert.equal(isValidCuit("20123456785"), false);
assert.equal(isValidCuit("2012345678"), false);
assert.equal(cleanSubjectText("Kiosco Tadeo S.R.L. ñandú!"), "Kiosco Tadeo S R L nandu");

// CSR
const { privateKeyPem, csrPem } = createCsr({ taxId: "20123456786", organization: "Kiosco Tadeo", commonName: "pesito" });
assert.ok(csrPem.includes("BEGIN CERTIFICATE REQUEST"));
const csr = forge.pki.certificationRequestFromPem(csrPem);
assert.ok(csr.verify());
assert.equal(csr.subject.attributes.find((a) => a.type === "2.5.4.5")?.value, "CUIT 20123456786");
assert.equal(csr.subject.getField("C")?.value, "AR");

// Certificado autofirmado de prueba (lo que haría ARCA con la solicitud)
function certFor(cuit: string, years = 1, notBefore = new Date()) {
  const priv = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey as forge.pki.PublicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = new Date(notBefore.getTime() + years * 365 * 24 * 3600 * 1000);
  const subject = [{ name: "serialNumber", value: `CUIT ${cuit}` }, { name: "commonName", value: "pesito" }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(priv, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}
const good = checkCertificate({ certificatePem: certFor("20123456786"), privateKeyPem, taxId: "20123456786" });
assert.equal(good.ok, true);
const wrongCuit = checkCertificate({ certificatePem: certFor("20999999990"), privateKeyPem, taxId: "20123456786" });
assert.equal(wrongCuit.ok, false);
const expired = checkCertificate({ certificatePem: certFor("20123456786", 1, new Date("2020-01-01")), privateKeyPem, taxId: "20123456786" });
assert.equal(expired.ok, false);
const other = createCsr({ taxId: "20123456786", organization: "Otro", commonName: "otro" });
assert.equal(checkCertificate({ certificatePem: certFor("20123456786"), privateKeyPem: other.privateKeyPem, taxId: "20123456786" }).ok, false);
assert.equal(checkCertificate({ certificatePem: "basura", privateKeyPem, taxId: "20123456786" }).ok, false);

console.log("pruebas de arca (cifrado, CSR y certificado): ok");

// Venta -> comprobante: la suma de las líneas da el total cobrado (con descuento o recargo), al centavo.
{
  const lines = [
    { name: "Coca 500", quantity: 3, subtotal: 3000 },
    { name: "Alfajor", quantity: 1, subtotal: 1000 },
    { name: "Yerba", quantity: 1, subtotal: 2333.33 },
  ];
  for (const total of [6333.33, 5700, 6966.67, 1.01]) {
    assert.equal(invoiceLines(lines, total).reduce((n, l) => n + l.amount, 0), Math.round(total * 100));
  }
  assert.deepEqual(invoiceLines([], 100), []);
}
assert.deepEqual(receiverFromDocument("20-12345678-9"), { cuit: "20123456789" });
assert.deepEqual(receiverFromDocument("30.123.456"), { dni: "30123456" });
assert.deepEqual(receiverFromDocument("abc"), {});
assert.deepEqual(receiverFromDocument(null), {});

// Certificado desde un archivo: PEM (texto, con o sin ruido alrededor) o DER (binario).
{
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: "prueba" }]);
  cert.setIssuer([{ name: "commonName", value: "prueba" }]);
  cert.sign(keys.privateKey);
  const pem = forge.pki.certificateToPem(cert).replace(/\r\n/g, "\n");
  assert.equal(certificateFromFile(new TextEncoder().encode(`texto\r\n${pem}\r\notro`)), pem.trim());
  const der = Uint8Array.from(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary"));
  assert.equal(certificateFromFile(der), pem.trim());
  assert.equal(certificateFromFile(new TextEncoder().encode("esto no es un certificado")), null);
}
