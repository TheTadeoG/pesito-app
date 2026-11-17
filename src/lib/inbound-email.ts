// Correo entrante de soporte (Resend Receiving): Resend avisa con un webhook (`email.received`, firmado con Svix) y la
// ruta /api/inbound-email reenvía el mail a la casilla del dueño. Acá están las partes puras (con pruebas en
// inbound-email.test.mts). Sólo servidor.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Tolerancia entre la hora del aviso y la nuestra (evita que se reutilice un aviso viejo). */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifica la firma de un webhook de Resend (formato Svix): HMAC-SHA256 de `${id}.${timestamp}.${cuerpo}` con la clave
 * `whsec_…` (en base64), que viene en el encabezado `svix-signature` como una lista "v1,firma v1,firma".
 */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    let got: Buffer;
    try {
      got = Buffer.from(sig, "base64");
    } catch {
      continue;
    }
    if (got.length === expected.length && timingSafeEqual(got, expected)) return true;
  }
  return false;
}

/** "Ana Pérez <ana@correo.com>" -> { name: "Ana Pérez", address: "ana@correo.com" }; "ana@correo.com" -> sin nombre. */
export function parseAddress(raw: string): { name: string; address: string } {
  const text = (raw ?? "").trim();
  const m = /^(.*)<([^<>]+)>\s*$/.exec(text);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), address: m[2].trim() };
  return { name: "", address: text };
}

/** ¿Alguno de los destinatarios es la casilla de soporte? (sin distinguir mayúsculas; acepta "Nombre <dir>") */
export function isForSupport(recipients: string[] | undefined, supportAddress: string): boolean {
  const target = supportAddress.trim().toLowerCase();
  return (recipients ?? []).some((r) => parseAddress(r).address.toLowerCase() === target);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Arma el mail que se reenvía: el original con un encabezado de quién lo mandó y a qué dirección llegó. */
export function buildForward(input: {
  from: string;
  to: string[];
  subject: string | null | undefined;
  text: string | null | undefined;
  html: string | null | undefined;
  attachmentCount: number;
}): { subject: string; text: string; html?: string; replyTo?: string } {
  const sender = parseAddress(input.from);
  const subject = `[Soporte] ${(input.subject ?? "").trim() || "(sin asunto)"}`.slice(0, 200);
  const header = [
    `De: ${sender.name ? `${sender.name} <${sender.address}>` : sender.address}`,
    `Para: ${input.to.join(", ")}`,
    ...(input.attachmentCount > 0
      ? [`Adjuntos: ${input.attachmentCount} (no se reenvían: se ven en el panel de Resend, Emails → Receiving)`]
      : []),
  ];
  const replyTo = /^[^\s@<>]+@[^\s@<>]+$/.test(sender.address) ? sender.address : undefined;
  const text = `${header.join("\n")}\n\n${(input.text ?? "").trim() || "(el mensaje no tiene texto: mirá la versión con formato)"}`;
  const out: { subject: string; text: string; html?: string; replyTo?: string } = { subject, text, replyTo };
  if (input.html) {
    out.html = `<div style="font-family:system-ui,sans-serif;font-size:13px;color:#555;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:12px">${header
      .map(escapeHtml)
      .join("<br>")}</div>${input.html}`;
  }
  return out;
}
