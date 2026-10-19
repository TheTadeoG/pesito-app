// Qué correo automático le toca (si le toca alguno) a un negocio. Sólo decide; no manda nada ni
// toca la base: así se prueba sin nada alrededor (lifecycle.test.mts).
//
// Pocas reglas, a propósito: UN correo por negocio cada vez, al menos 2 días entre uno y otro,
// el más importante primero, y nada si pidió la baja o no hay email del dueño.

export type LifecycleTemplate = "welcome" | "add_products" | "first_sale" | "trial_ending" | "trial_ended" | "payment_failed";

export interface OrgLifecycleState {
  createdAt: string;
  productCount: number;
  saleCount: number;
  plan: string;
  trialEndsAt: string | null;
  /** Paga o pagó por Mercado Pago (un plan asignado a mano no cuenta). */
  paidViaMp: boolean;
  paymentStatus: string | null;
  ownerEmail: string | null;
  optedOut: boolean;
  sent: { kind: string; sentAt: string }[];
}

export interface Pick {
  /** Con qué se anota en lifecycle_emails (no se repite un mismo kind por negocio). */
  kind: string;
  template: LifecycleTemplate;
}

const DAY = 24 * 60 * 60 * 1000;
export const COOLDOWN_DAYS = 2;

/** Una clave por semana, para avisar un pago fallido a lo sumo una vez por semana. */
export function weekKey(now: number): string {
  return String(Math.floor(now / (7 * DAY)));
}

export function pickEmail(state: OrgLifecycleState, now: number): Pick | null {
  if (!state.ownerEmail || state.optedOut) return null;
  const last = state.sent.reduce((max, s) => Math.max(max, new Date(s.sentAt).getTime()), 0);
  if (last && now - last < COOLDOWN_DAYS * DAY) return null;
  const has = (kind: string) => state.sent.some((s) => s.kind === kind);
  const age = now - new Date(state.createdAt).getTime();

  if (state.paymentStatus === "past_due") {
    const kind = `payment_failed:${weekKey(now)}`;
    if (!has(kind)) return { kind, template: "payment_failed" };
  }

  if (state.plan === "gratis" && !state.paidViaMp && state.trialEndsAt) {
    const ends = new Date(state.trialEndsAt).getTime();
    if (ends > now && ends - now <= 3 * DAY && !has("trial_ending")) return { kind: "trial_ending", template: "trial_ending" };
    if (ends <= now && now - ends <= 5 * DAY && !has("trial_ended")) return { kind: "trial_ended", template: "trial_ended" };
  }

  if (state.productCount > 0 && state.saleCount === 0 && age >= 3 * DAY && age <= 21 * DAY && !has("first_sale")) {
    return { kind: "first_sale", template: "first_sale" };
  }
  if (state.productCount === 0 && age >= DAY && age <= 10 * DAY && !has("add_products")) {
    return { kind: "add_products", template: "add_products" };
  }
  if (age <= 3 * DAY && !has("welcome")) return { kind: "welcome", template: "welcome" };
  return null;
}
