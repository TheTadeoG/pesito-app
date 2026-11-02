/**
 * Certificado a partir de los bytes de un archivo .crt / .cer / .pem que bajó la persona de ARCA, sin que lo abra
 * ni lo copie a mano. Acepta PEM (texto, el que da ARCA) y DER (binario, lo pasa a PEM). `null` si no parece un
 * certificado.
 */
export function certificateFromFile(bytes: Uint8Array): string | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const pem = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (pem) return pem[0].replace(/\r\n/g, "\n").trim();
  // DER: una secuencia ASN.1 (empieza con 0x30) y de un tamaño razonable.
  if (bytes.length > 100 && bytes.length < 20_000 && bytes[0] === 0x30) {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).match(/.{1,64}/g)?.join("\n") ?? "";
    return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
  }
  return null;
}
