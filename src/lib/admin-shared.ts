// Piezas puras del panel interno (sin acceso a la base): se usan tanto en el servidor como en el navegador.

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdminOrg {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  plan: string;
  /** Fin de la prueba Pro (sólo plan gratis). */
  trialEndsAt: string | null;
  /** Paga o pagó por Mercado Pago (un plan asignado a mano no cuenta). */
  paidViaMp: boolean;
  paymentStatus: string | null;
  cycle: string | null;
  invoicePack: number;
  productCount: number;
  saleCount: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
  memberCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  lastSignIn: string | null;
}

/** Segmentos de la lista de negocios (los mismos que cuenta el Resumen). */
export type SegmentId =
  | "todos"
  | "nuevos"
  | "sin-vender"
  | "en-prueba"
  | "prueba-por-vencer"
  | "pagan"
  | "dejaron"
  | "cobro-fallido"
  // Listas de remarketing
  | "sin-productos"
  | "con-productos-sin-ventas"
  | "prueba-vencida"
  | "gratis-mucho-uso"
  | "pagan-30";

export function inSegment(o: AdminOrg, seg: SegmentId, now: number): boolean {
  const age = now - new Date(o.createdAt).getTime();
  const trialLeft = o.trialEndsAt ? new Date(o.trialEndsAt).getTime() - now : null;
  switch (seg) {
    case "todos":
      return true;
    case "nuevos":
      return age <= 7 * DAY_MS;
    case "sin-vender":
      return o.saleCount === 0;
    case "en-prueba":
      return o.plan === "gratis" && trialLeft !== null && trialLeft > 0;
    case "prueba-por-vencer":
      return o.plan === "gratis" && trialLeft !== null && trialLeft > 0 && trialLeft <= 3 * DAY_MS;
    case "pagan":
      return o.paidViaMp && o.plan !== "gratis" && o.paymentStatus !== "cancelled";
    case "dejaron":
      return o.saleCount > 0 && o.lastSaleAt !== null && now - new Date(o.lastSaleAt).getTime() > 14 * DAY_MS;
    case "cobro-fallido":
      return o.paymentStatus === "past_due";
    case "sin-productos":
      return o.productCount === 0 && age > DAY_MS;
    case "con-productos-sin-ventas":
      return o.productCount > 0 && o.saleCount === 0;
    case "prueba-vencida":
      return o.plan === "gratis" && trialLeft !== null && trialLeft <= 0;
    case "gratis-mucho-uso":
      return o.plan === "gratis" && !(trialLeft !== null && trialLeft > 0) && o.saleCount >= 100 && o.lastSaleAt !== null && now - new Date(o.lastSaleAt).getTime() <= 7 * DAY_MS;
    case "pagan-30":
      return o.paidViaMp && o.plan !== "gratis" && o.paymentStatus !== "cancelled" && age > 30 * DAY_MS;
  }
}

export const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevos", label: "Nuevos (7 días)" },
  { id: "sin-vender", label: "Sin vender" },
  { id: "en-prueba", label: "En prueba" },
  { id: "prueba-por-vencer", label: "Prueba por vencer" },
  { id: "pagan", label: "Pagan" },
  { id: "dejaron", label: "Dejaron de vender" },
  { id: "cobro-fallido", label: "Cobro fallido" },
];

/** Número de WhatsApp para wa.me (Argentina: 54 9 + área + número). */
export function whatsappNumber(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  let n = digits.replace(/^00/, "");
  if (n.startsWith("54")) {
    if (!n.startsWith("549")) n = `549${n.slice(2)}`;
    return n;
  }
  n = n.replace(/^0/, "").replace(/^(\d{2,4})15/, "$1");
  return `549${n}`;
}

const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

/** "hace 3 horas", "ayer", "hace 2 días" (con `now` fijo, así el servidor y el navegador dicen lo mismo). */
export function ago(iso: string | null, now: number): string {
  if (!iso) return "nunca";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return rtf.format(-Math.max(1, minutes), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export interface Audience {
  id: SegmentId;
  title: string;
  sub: string;
  /** Qué hacer con esa lista. */
  action: string;
  tone: "warning" | "info" | "danger" | "success";
  /** Mensaje base; se completa con los datos de cada negocio. */
  template: string;
  /** Se puede regalar días de prueba desde la lista. */
  canGiftTrial: boolean;
}

export const AUDIENCES: Audience[] = [
  {
    id: "prueba-por-vencer",
    title: "Pruebas que vencen en 3 días",
    sub: "Los que más conviene llamar: ya usaron Pesito.",
    action: "Contactar hoy",
    tone: "warning",
    canGiftTrial: true,
    template: "Hola {nombre}, soy Tadeo de Pesito. Vi que ya estás usando Pesito con {negocio} y tu prueba del Plan Pro termina en {dias}. ¿Querés que te cuente qué plan te conviene? Si necesitás más tiempo, te doy unos días más.",
  },
  {
    id: "sin-productos",
    title: "Se registraron y no cargaron productos",
    sub: "Se fueron en el primer paso. Ayuda para importar con Excel.",
    action: "Mensaje de ayuda",
    tone: "info",
    canGiftTrial: false,
    template: "Hola {nombre}, soy Tadeo de Pesito. Vi que creaste {negocio} pero todavía no cargaste productos. Si querés, te ayudo a importarlos desde Excel en unos minutos. ¿Te sirve?",
  },
  {
    id: "con-productos-sin-ventas",
    title: "Cargaron productos y no vendieron",
    sub: "Les falta abrir la caja y hacer la primera venta.",
    action: "Mensaje de ayuda",
    tone: "info",
    canGiftTrial: false,
    template: "Hola {nombre}, soy Tadeo de Pesito. Vi que en {negocio} ya cargaste {uso}, pero todavía no hiciste ninguna venta. ¿Te ayudo a abrir la caja y probar la primera?",
  },
  {
    id: "prueba-vencida",
    title: "Prueba vencida sin pagar",
    sub: "Usaron el Pro y no siguieron. Ofrecer el Básico o más días.",
    action: "Recuperar",
    tone: "warning",
    canGiftTrial: true,
    template: "Hola {nombre}, soy Tadeo de Pesito. La prueba del Plan Pro de {negocio} terminó. ¿Cómo te fue? Si querés, te muestro el plan que mejor te queda o te regalo unos días más para que lo sigas probando.",
  },
  {
    id: "dejaron",
    title: "Dejaron de vender hace 14 días o más",
    sub: "Vendían y pararon. Preguntar qué pasó.",
    action: "Recuperar",
    tone: "warning",
    canGiftTrial: false,
    template: "Hola {nombre}, soy Tadeo de Pesito. Vi que hace {dias} no registrás ventas en {negocio}. ¿Pasó algo? Si algo no te sirvió o no entendiste, contame y lo vemos juntos.",
  },
  {
    id: "gratis-mucho-uso",
    title: "Gratis con mucho uso",
    sub: "Venden seguido con el plan gratis: candidatos a pagar.",
    action: "Ofrecer un plan",
    tone: "success",
    canGiftTrial: true,
    template: "Hola {nombre}, soy Tadeo de Pesito. Vi que vendés seguido con {negocio} ({uso}). ¿Querés que veamos si te conviene pasar a un plan pago, con ventas ilimitadas, más usuarios y más cajas?",
  },
  {
    id: "cobro-fallido",
    title: "Cobro del plan fallido",
    sub: "Mercado Pago reintenta. Avisar para que cambien la tarjeta.",
    action: "Avisar hoy",
    tone: "danger",
    canGiftTrial: false,
    template: "Hola {nombre}, soy Tadeo de Pesito. No pudimos cobrar el plan de {negocio}. Mercado Pago lo va a reintentar, pero si cambiaste de tarjeta podés actualizarla desde Planes dentro de Pesito. Cualquier duda, avisame.",
  },
  {
    id: "pagan-30",
    title: "Pagan hace más de 30 días",
    sub: "Satisfechos: pedir una reseña o que lo recomienden.",
    action: "Pedir reseña",
    tone: "success",
    canGiftTrial: false,
    template: "Hola {nombre}, soy Tadeo de Pesito. Gracias por usar Pesito en {negocio}. ¿Cómo te está yendo? Si te sirve, me ayudaría mucho que me dejes una reseña o que se lo recomiendes a otro negocio.",
  },
];

/** Completa un mensaje con los datos del negocio: {nombre}, {negocio}, {dias} y {uso}. */
export function fillTemplate(template: string, org: AdminOrg, now: number): string {
  const first = (org.ownerName ?? "").split(" ")[0] || "";
  const trialDays = org.trialEndsAt ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - now) / DAY_MS)) : 0;
  const sinceSale = org.lastSaleAt ? Math.max(1, Math.floor((now - new Date(org.lastSaleAt).getTime()) / DAY_MS)) : 0;
  const days = org.plan === "gratis" && trialDays > 0 ? `${trialDays} ${trialDays === 1 ? "día" : "días"}` : `${sinceSale} ${sinceSale === 1 ? "día" : "días"}`;
  const use = org.saleCount > 0 ? `${org.saleCount} ventas` : `${org.productCount} productos`;
  return template
    .replaceAll("Hola {nombre}", first ? `Hola ${first}` : "Hola")
    .replaceAll("{nombre}", first)
    .replaceAll("{negocio}", org.name)
    .replaceAll("{dias}", days)
    .replaceAll("{uso}", use);
}
