import type { Plan, SubscriptionInfo } from "@/lib/subscription";
import { planLabels } from "@/lib/subscription";
import { getCashReminder } from "@/lib/cash-reminder";

// Avisos de la campana de la barra de arriba. Los que ya se saben en cada pantalla
// (plan, caja, dispositivos, deuda a proveedores) los arma el servidor en el layout y
// la caja el navegador (depende de la hora); lo que cuesta calcular (stock bajo,
// fiado) lo trae la acción `getBusinessAlerts` recién cuando se necesita.

export type BellTone = "danger" | "warning" | "info";

export interface BellAlert {
  id: string;
  tone: BellTone;
  title: string;
  detail?: string;
  href: string;
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

/** Ingresos desde dispositivos nuevos (últimas 48 h) para dueño o administrador. */
export function newDeviceAlert(logins: NewDeviceLogin[]): BellAlert | null {
  const first = logins[0];
  if (!first) return null;
  const more = logins.length > 1 ? ` (y ${logins.length - 1} más)` : "";
  return {
    id: "new-device",
    tone: "warning",
    title: "Ingreso desde un dispositivo nuevo",
    detail: `${first.who}, ${first.device}, ${first.at}${more}. ¿No lo reconocés? Cambiá la contraseña.`,
    href: "/configuracion",
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
      tone: "danger",
      title: "No pudimos cobrar tu plan",
      detail: "Actualizá el medio de pago en Mercado Pago para no perder las funciones.",
      href: "/planes",
    });
  }
  if (subscription.grace) {
    out.push({
      id: "plan-grace",
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
      tone: "warning",
      title: "Tenés una caja abierta de un día anterior",
      detail: "Cerrala para que las ventas de hoy queden en su propia caja.",
      href: "/caja",
    };
  }
  if (reminder.kind === "closing") {
    return {
      id: "cash-closing",
      tone: "warning",
      title: "Ya es hora de cerrar la caja",
      detail: `El cierre de tu negocio es a las ${reminder.closeTime}.`,
      href: "/caja",
    };
  }
  return {
    id: "cash-soon",
    tone: "info",
    title: `La caja cierra en ${reminder.minutesLeft} min`,
    detail: `El cierre de tu negocio es a las ${reminder.closeTime}.`,
    href: "/caja",
  };
}
