import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado de la clave privada de cada negocio antes de guardarla (AES-256-GCM). La clave de cifrado
// (ARCA_ENCRYPTION_KEY, 32 bytes en base64) vive sólo en el servidor: quien lea la base no puede usar
// las claves. Formato: "v1:" + base64(iv 12 bytes | etiqueta 16 bytes | texto cifrado).

const VERSION = "v1:";

function keyFrom(base64: string | undefined): Buffer {
  const key = Buffer.from(base64 ?? "", "base64");
  if (key.length !== 32) throw new Error("ARCA_ENCRYPTION_KEY tiene que ser una clave de 32 bytes en base64.");
  return key;
}

export function encryptSecret(plain: string, keyBase64: string | undefined = process.env.ARCA_ENCRYPTION_KEY): string {
  const key = keyFrom(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptSecret(stored: string, keyBase64: string | undefined = process.env.ARCA_ENCRYPTION_KEY): string {
  if (!stored.startsWith(VERSION)) throw new Error("Formato de clave guardada desconocido.");
  const key = keyFrom(keyBase64);
  const raw = Buffer.from(stored.slice(VERSION.length), "base64");
  if (raw.length < 29) throw new Error("Clave guardada dañada.");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** ¿Está cargada la clave de cifrado del servidor? */
export function encryptionConfigured(keyBase64: string | undefined = process.env.ARCA_ENCRYPTION_KEY): boolean {
  try {
    keyFrom(keyBase64);
    return true;
  } catch {
    return false;
  }
}
