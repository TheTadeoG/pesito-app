import type { AlertModule } from "@/lib/bell-alerts";
import type { PlanFeature } from "@/lib/plan-access";
import { IDLE_DAYS_OPTIONS, IDLE_DEFAULT_DAYS } from "@/lib/idle-days";

// Registro de los avisos del sistema: cuáles hay en cada módulo, cuáles se pueden apagar o
// ajustar y con qué plan. Lo usan el servidor (qué calcular), la campana (qué mostrar) y la
// pantalla Configuración → Avisos (qué se puede cambiar). Se guarda en alert_settings
// (migración 0074) como { "<id>": { enabled?, value? } }; lo que no está vale el valor por defecto.

export interface AlertParam {
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  /** Si hay opciones, se elige entre ellas en vez de escribir un número. */
  options?: readonly number[];
}

export interface AlertDef {
  /** Igual al `id` del aviso (BellAlert.id). */
  id: string;
  module: AlertModule;
  label: string;
  description: string;
  /** Función del plan que lo habilita (sin esto, es de todos los planes). */
  feature?: PlanFeature;
  param?: AlertParam;
}

export const ALERT_DEFS: AlertDef[] = [
  {
    id: "low-stock",
    module: "productos",
    label: "Stock bajo",
    description: "Productos que llegaron al stock mínimo que cargaste.",
  },
  {
    id: "selling-at-loss",
    module: "productos",
    label: "Venta a pérdida",
    description: "Productos con el costo por encima del precio de venta.",
  },
  {
    id: "review-numbers",
    module: "productos",
    label: "Números para revisar",
    description: "Stock negativo, productos sin costo y sin stock mínimo.",
  },
  {
    id: "low-margin",
    module: "productos",
    label: "Margen bajo",
    description: "Productos que ganan poco sobre el costo (sin llegar a perder).",
    feature: "marginAlerts",
    param: { label: "Avisar si la ganancia es menor a", unit: "%", min: 1, max: 50, default: 10 },
  },
  {
    id: "stale-cost",
    module: "productos",
    label: "Costo sin actualizar",
    description: "Productos cuyo costo no cambió en mucho tiempo (con la inflación, suele estar viejo).",
    feature: "marginAlerts",
    param: { label: "Avisar si el costo no cambió en", unit: "días", min: 30, max: 365, default: 90 },
  },
  {
    id: "cost-rise",
    module: "productos",
    label: "Precio sin actualizar",
    description: "El costo subió y todavía no cambiaste el precio de venta.",
    feature: "costRiseAlert",
  },
  {
    id: "idle-capital",
    module: "productos",
    label: "Plata parada",
    description: "Productos con stock que no se vendieron, y cuánta plata tenés ahí.",
    feature: "lowRotation",
    param: { label: "Sin ventas hace", unit: "días", min: 7, max: 90, default: IDLE_DEFAULT_DAYS, options: IDLE_DAYS_OPTIONS },
  },
  {
    id: "suppliers-overdue",
    module: "proveedores",
    label: "Deuda vencida con proveedores",
    description: "Proveedores a los que se les pasó el vencimiento de pago.",
  },
  {
    id: "fiado",
    module: "clientes",
    label: "Fiado",
    description: "Cuánta plata te deben tus clientes en fiado.",
  },
];

/** Módulos sin interruptores en Avisos: o no se apagan, o se configuran en otro lado. */
export const FIXED_MODULES: { module: AlertModule; label: string; description: string }[] = [
  { module: "caja", label: "Caja", description: "El recordatorio de cierre se prende y se elige la hora en Cierre de caja (más arriba)." },
  { module: "plan", label: "Mi plan", description: "No se pudo cobrar, vencimientos y fin de la prueba. Siempre activos." },
  { module: "seguridad", label: "Seguridad", description: "Ingresos desde dispositivos nuevos. Siempre activos." },
];

export interface AlertSetting {
  enabled?: boolean;
  value?: number;
}
export type AlertSettings = Record<string, AlertSetting>;

const DEF_BY_ID = new Map(ALERT_DEFS.map((d) => [d.id, d]));

/** Id con el que se guarda la configuración de un aviso (los de la caja van juntos y no se apagan desde Avisos). */
export function settingKey(alertId: string): string {
  return alertId.startsWith("cash-") ? "cash" : alertId;
}

/** Deja sólo lo que se conoce y con valores válidos (lo que viene de la base o del navegador no se cree). */
export function parseAlertSettings(raw: unknown): AlertSettings {
  const out: AlertSettings = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = DEF_BY_ID.get(id);
    if (!def || !value || typeof value !== "object") continue;
    const v = value as { enabled?: unknown; value?: unknown };
    const setting: AlertSetting = {};
    if (typeof v.enabled === "boolean") setting.enabled = v.enabled;
    if (def.param && typeof v.value === "number" && Number.isFinite(v.value)) {
      const { min, max, options } = def.param;
      const n = Math.round(v.value);
      if (n >= min && n <= max && (!options || options.includes(n))) setting.value = n;
    }
    if (Object.keys(setting).length > 0) out[id] = setting;
  }
  return out;
}

export function alertEnabled(settings: AlertSettings, id: string): boolean {
  return settings[settingKey(id)]?.enabled !== false;
}

export function alertValue(settings: AlertSettings, id: string): number {
  const def = DEF_BY_ID.get(id);
  return settings[id]?.value ?? def?.param?.default ?? 0;
}
