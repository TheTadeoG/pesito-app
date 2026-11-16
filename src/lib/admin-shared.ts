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
export type SegmentId = "todos" | "nuevos" | "sin-vender" | "en-prueba" | "prueba-por-vencer" | "pagan" | "dejaron" | "cobro-fallido";

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
