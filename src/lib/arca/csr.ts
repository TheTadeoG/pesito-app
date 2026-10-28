import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

// Solicitud de certificado (CSR) para ARCA y comprobación del certificado que devuelve. Para producción
// y homologación el subject es el que pide ARCA: C=AR, O=<empresa>, CN=<alias>, serialNumber=CUIT <cuit>.

export interface CsrInput {
  taxId: string;
  organization: string;
  commonName: string;
}

export function isValidCuit(raw: string): boolean {
  if (!/^\d{11}$/.test(raw)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(raw[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(raw[10]);
}

/** Letras, números y espacios: ARCA rechaza símbolos raros en el subject. */
export function cleanSubjectText(raw: string, max = 60): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function createCsr(input: CsrInput): { privateKeyPem: string; csrPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const request = forge.pki.createCertificationRequest();
  request.publicKey = forge.pki.publicKeyFromPem(publicKey);
  request.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: cleanSubjectText(input.organization) || "Negocio" },
    { name: "commonName", value: cleanSubjectText(input.commonName, 30) || "pesito" },
    { name: "serialNumber", value: `CUIT ${input.taxId}` },
  ]);
  request.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { privateKeyPem: privateKey, csrPem: forge.pki.certificationRequestToPem(request) };
}

export type CertCheck = { ok: true; expiresAt: Date } | { ok: false; error: string };

/**
 * El certificado pegado tiene que ser un PEM, corresponder a la clave guardada, no estar vencido y, si
 * dice a qué CUIT pertenece, que sea el del negocio.
 */
export function checkCertificate(input: { certificatePem: string; privateKeyPem: string; taxId: string; now?: Date }): CertCheck {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(input.certificatePem.trim());
  } catch {
    return { ok: false, error: "Lo que pegaste no es un certificado válido. Tiene que empezar con -----BEGIN CERTIFICATE-----." };
  }
  let key: forge.pki.rsa.PrivateKey;
  try {
    key = forge.pki.privateKeyFromPem(input.privateKeyPem) as forge.pki.rsa.PrivateKey;
  } catch {
    return { ok: false, error: "No pudimos leer la clave guardada. Generá la solicitud de nuevo." };
  }
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  if (pub.n.toString(16) !== key.n.toString(16)) {
    return { ok: false, error: "Este certificado no corresponde a la solicitud que generamos. Pegá el que te dio ARCA para esta solicitud." };
  }
  const now = input.now ?? new Date();
  if (cert.validity.notAfter < now) return { ok: false, error: "El certificado está vencido." };
  if (cert.validity.notBefore > new Date(now.getTime() + 24 * 60 * 60 * 1000)) return { ok: false, error: "El certificado todavía no está vigente." };
  // forge no encuentra "serialNumber" por nombre (no tiene sigla): se busca por su OID.
  const serial = String(cert.subject.attributes.find((a) => a.type === "2.5.4.5" || a.name === "serialNumber")?.value ?? "");
  const cuit = serial.match(/\d{11}/)?.[0];
  if (cuit && cuit !== input.taxId) return { ok: false, error: `El certificado es del CUIT ${cuit}, no del ${input.taxId}.` };
  return { ok: true, expiresAt: cert.validity.notAfter };
}
