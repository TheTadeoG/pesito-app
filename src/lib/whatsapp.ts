// Sólo dígitos, con código de país, como pide el link wa.me.
export const SUPPORT_WHATSAPP_NUMBER = "541169615044";

export function whatsappLink(message: string) {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Link para abrir el chat de WhatsApp con un teléfono cargado a mano
 * (proveedores). Acepta el formato local argentino ("11 5555-0101",
 * "011 15 5555-0101" no: sólo área + número) y el internacional con 54.
 * Si no se puede armar un número válido, devuelve null.
 */
export function chatWhatsappUrl(phone: string | null | undefined, message?: string): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("54")) {
    // 54 + área + número (con o sin el 9 de celular).
    if (digits.length < 12) return null;
    if (!digits.startsWith("549") && digits.length === 12) digits = `549${digits.slice(2)}`;
  } else {
    digits = digits.replace(/^0+/, "");
    if (digits.length !== 10) return null;
    digits = `549${digits}`;
  }
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
