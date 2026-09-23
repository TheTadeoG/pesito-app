// Sólo dígitos, con código de país, como pide el link wa.me.
export const SUPPORT_WHATSAPP_NUMBER = "541169615044";

export function whatsappLink(message: string) {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
