import type { Plan, SubscriptionInfo } from "@/lib/subscription";
import { planLabels } from "@/lib/subscription";
import { getCashReminder } from "@/lib/cash-reminder";
import { formatDate } from "@/lib/utils";

// Avisos de la campana de la barra de arriba. Los que ya se saben en cada pantalla
// (plan, caja, dispositivos, deuda a proveedores) los arma el servidor en el layout y
// la caja el navegador (depende de la hora); lo que cuesta calcular (stock bajo,
// fiado) lo trae la acción `getBusinessAlerts` recién cuando se necesita.

export type BellTone = "danger" | "warning" | "info";

/**
 * A qué módulo del sistema pertenece un aviso. Es la clave de la coherencia:
 * todo número de avisos (campana, menú lateral, tira de un módulo) cuenta
 * AVISOS —no productos ni proveedores— y la insignia de cada módulo es la
 * cantidad de avisos de ese módulo; la campana es la suma de todos.
 */
export type AlertModule = "productos" | "proveedores" | "clientes" | "caja" | "plan" | "seguridad";

/** Link del menú lateral donde se muestra la insignia de cada módulo. */
export const MODULE_HREF: Record<AlertModule, string> = {
  productos: "/productos",
  proveedores: "/proveedores",
  clientes: "/clientes",
  caja: "/caja",
  plan: "/planes",
  seguridad: "/configuracion",
};

export const MODULE_LABEL: Record<AlertModule, string> = {
  productos: "Productos",
  proveedores: "Proveedores",
  clientes: "Clientes",
  caja: "Caja",
  plan: "Mi plan",
  seguridad: "Seguridad",
};

/** Urgente: hay que atenderlo hoy. Normal: conviene revisarlo cuando se pueda. */
export type AlertPriority = "urgent" | "normal";

export interface BellAlert {
  id: string;
  module: AlertModule;
  /** Si no se indica: "urgent" para los rojos (danger) y "normal" para el resto. */
  priority?: AlertPriority;
  /** No se puede marcar como visto (p. ej. no se pudo cobrar el plan). */
  pinned?: boolean;
  tone: BellTone;
  title: string;
  detail?: string;
  href: string;
  /** Resumen corto para la tira compacta de Productos ("12 stock bajo"). */
  chip?: string;
  /** Atajos debajo del aviso (p. ej. "Qué comprar"); el aviso entero lleva a `href`. */
  actions?: { label: string; href: string }[];
  /** Plan que desbloquea el detalle (la función no está en el plan del negocio). */
  lockedPlan?: Plan;
  /**
   * Aviso que se descarta al abrirlo: queda guardado en este navegador (`key`) con el
   * `token` del último hecho (p. ej. el id del último ingreso) y vuelve sólo si cambia.
   */
  dismiss?: { key: string; token: string };
}

export interface NewDeviceLogin {
  id: string;
  who: string;
  device: string;
  at: string;
}

export function alertPriority(a: Pick<BellAlert, "priority" | "tone">): AlertPriority {
  return a.priority ?? (a.tone === "danger" ? "urgent" : "normal");
}

/** Ingresos desde dispositivos nuevos (últimas 48 h) para dueño o administrador. */
export function newDeviceAlert(logins: NewDeviceLogin[]): BellAlert | null {
  const first = logins[0];
  if (!first) return null;
  const more = logins.length > 1 ? ` (y ${logins.length - 1} más)` : "";
  return {
    id: "new-device",
    module: "seguridad",
    priority: "urgent",
    tone: "warning",
    title: "Ingreso desde un dispositivo nuevo",
    detail: `${first.who}, ${first.device}, ${first.at}${more}. ¿No lo reconocés? Cambiá la contraseña.`,
    href: "/configuracion?tab=cuenta",
    // La misma clave que usaba el cartel de arriba: quien ya lo había cerrado no lo vuelve a ver.
    dismiss: { key: "pesito-dismissed-new-device", token: first.id },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Avisos del plan para el dueño o administrador (los mismos casos que los carteles del layout). */
export function planAlerts(subscription: SubscriptionInfo, expiringPeriodEnd: string | null): BellAlert[] {
  const out: BellAlert[] = [];
  if (subscription.billing?.status === "past_due") {
    out.push({
      id: "plan-past-due",
      module: "plan",
      pinned: true,
      tone: "danger",
      title: "No pudimos cobrar tu plan",
      detail: subscription.billing.graceUntil
        ? `Actualizá el medio de pago en Mercado Pago antes del ${formatDate(subscription.billing.graceUntil)}: si no, el negocio pasa al Plan Gratis.`
        : "Actualizá el medio de pago en Mercado Pago para no perder las funciones.",
      href: "/planes",
    });
  }
  if (subscription.grace) {
    out.push({
      id: "plan-grace",
      module: "plan",
      priority: subscription.grace.kind === "downgrade" ? "normal" : "urgent",
      tone: "warning",
      title:
        subscription.grace.kind === "downgrade"
          ? `Pasaste al Plan ${planLabels[subscription.grace.nextPlan]}`
          : `Tu Plan ${planLabels[subscription.grace.keepsPlan]} venció`,
      detail:
        subscription.grace.kind === "downgrade"
          ? "Seguís con las funciones anteriores unos días más."
          : "Renovalo para no pasar al Plan Gratis.",
      href: "/planes",
    });
  } else if (expiringPeriodEnd) {
    out.push({
      id: "plan-expiring",
      module: "plan",
      tone: "warning",
      title: `Tu Plan ${planLabels[subscription.plan]} está por vencer`,
      detail: "Si no lo renovás, el negocio pasa al Plan Gratis (sin perder datos).",
      href: "/planes",
    });
  }
  if (subscription.plan === "gratis" && subscription.proTrialEndsAt) {
    const left = new Date(subscription.proTrialEndsAt).getTime() - Date.now();
    if (left > 0 && left <= 3 * DAY_MS) {
      const days = Math.max(1, Math.ceil(left / DAY_MS));
      out.push({
        id: "trial-ending",
        module: "plan",
        tone: "info",
        title: days === 1 ? "Tu prueba Pro termina mañana" : `Tu prueba Pro termina en ${days} días`,
        detail: "Elegí un plan para no perder las funciones Pro.",
        href: "/planes",
      });
    }
  }
  return out;
}

/** Aviso de la caja abierta (hora de cierre o caja de un día anterior); null si no hace falta. */
export function cashAlert(openedAt: string, closeTime: string | null): BellAlert | null {
  const reminder = getCashReminder(openedAt, closeTime);
  if (!reminder) return null;
  if (reminder.kind === "stale") {
    return {
      id: "cash-stale",
      module: "caja",
      tone: "warning",
      title: "Tenés una caja abierta de un día anterior",
      detail: "Cerrala para que las ventas de hoy queden en su propia caja.",
      href: "/caja",
    };
  }
  if (reminder.kind === "closing") {
    return {
      id: "cash-closing",
      module: "caja",
      tone: "warning",
      title: "Ya es hora de cerrar la caja",
      detail: `El cierre de tu negocio es a las ${reminder.closeTime}.`,
      href: "/caja",
    };
  }
  return {
    id: "cash-soon",
    module: "caja",
    tone: "info",
    title: `La caja cierra en ${reminder.minutesLeft} min`,
    detail: `El cierre de tu negocio es a las ${reminder.closeTime}.`,
    href: "/caja",
  };
}
