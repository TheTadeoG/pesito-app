// Embudo de activación y de la prueba Pro del panel interno. Todo es una cuenta sobre datos ya
// leídos (sin consultas): así se puede probar sin base. Mira NEGOCIOS (no empleados): un
// empleado que entra por invitación no es un alta nueva.

export interface OrgActivity {
  org_id: string;
  created_at: string;
  first_product_at: string | null;
  first_sale_at: string | null;
  sale_count: number;
  has_purchase: boolean;
  has_cash: boolean;
  has_cash_closed: boolean;
  has_customer: boolean;
  has_supplier: boolean;
  member_count: number;
}

export interface OrgSubscription {
  plan: string;
  trialEndsAt: string | null;
  /** Pagó o paga por Mercado Pago (no cuenta un plan asignado a mano desde el panel). */
  paidViaMp: boolean;
  cycle: "mensual" | "anual" | null;
}

export interface FunnelStep {
  label: string;
  count: number;
  /** % sobre el paso anterior. */
  pctPrev: number | null;
  /** % sobre el primer paso. */
  pctFirst: number | null;
}

export interface TrialStats {
  active: number;
  endingSoon: number;
  expiredUnpaid: number;
  converted: number;
  /** pagaron / (pagaron + vencieron sin pagar): sólo cuentan las pruebas ya decididas. */
  conversionPct: number | null;
}

export interface FunnelResult {
  steps: FunnelStep[];
  /** Mediana de horas entre el alta del negocio y su primera venta. */
  medianHoursToFirstSale: number | null;
  trial: TrialStats;
  payingOrgs: number;
  /** Ingreso mensual estimado de los que pagan por Mercado Pago (el anual, prorrateado al mes). */
  mrr: number;
  adoption: { label: string; count: number; pct: number }[];
  sellingOrgs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeFunnel(input: {
  /** Cuentas de dueños que se registraron (con o sin negocio creado todavía). */
  signedUpOwners: number;
  activity: OrgActivity[];
  subscriptions: Map<string, OrgSubscription>;
  /** Precio mensual de cada plan (lib/plan-features), para el ingreso estimado. */
  monthlyPrice: (plan: string, cycle: "mensual" | "anual" | null) => number;
  now?: number;
}): FunnelResult {
  const now = input.now ?? Date.now();
  const orgs = input.activity;
  const withProduct = orgs.filter((o) => o.first_product_at !== null);
  const sold = orgs.filter((o) => o.first_sale_at !== null);
  const paying = orgs.filter((o) => input.subscriptions.get(o.org_id)?.paidViaMp);

  const counts: [string, number][] = [
    ["Se registraron (dueños)", input.signedUpOwners],
    ["Crearon su negocio", orgs.length],
    ["Cargaron un producto", withProduct.length],
    ["Hicieron una venta", sold.length],
    ["Pagan un plan", paying.length],
  ];
  const steps: FunnelStep[] = counts.map(([label, count], i) => ({
    label,
    count,
    pctPrev: i === 0 ? null : pct(count, counts[i - 1][1]),
    pctFirst: i === 0 ? null : pct(count, counts[0][1]),
  }));

  const hours = sold.map((o) => (new Date(o.first_sale_at as string).getTime() - new Date(o.created_at).getTime()) / HOUR_MS).filter((h) => h >= 0);

  const trial: TrialStats = { active: 0, endingSoon: 0, expiredUnpaid: 0, converted: 0, conversionPct: null };
  for (const o of orgs) {
    const sub = input.subscriptions.get(o.org_id);
    if (!sub?.trialEndsAt) continue;
    const ends = new Date(sub.trialEndsAt).getTime();
    if (sub.paidViaMp) trial.converted += 1;
    else if (ends > now) {
      trial.active += 1;
      if (ends - now <= 3 * DAY_MS) trial.endingSoon += 1;
    } else if (sub.plan === "gratis") trial.expiredUnpaid += 1;
  }
  trial.conversionPct = pct(trial.converted, trial.converted + trial.expiredUnpaid);

  let mrr = 0;
  for (const o of paying) {
    const sub = input.subscriptions.get(o.org_id);
    if (sub) mrr += input.monthlyPrice(sub.plan, sub.cycle);
  }

  const adoptionDefs: [string, (o: OrgActivity) => boolean][] = [
    ["Abrieron una caja", (o) => o.has_cash],
    ["Cerraron una caja", (o) => o.has_cash_closed],
    ["Registraron una compra", (o) => o.has_purchase],
    ["Cargaron un cliente", (o) => o.has_customer],
    ["Cargaron un proveedor", (o) => o.has_supplier],
    ["Tienen más de un usuario", (o) => o.member_count > 1],
  ];
  const adoption = adoptionDefs.map(([label, test]) => {
    const count = sold.filter(test).length;
    return { label, count, pct: sold.length > 0 ? (count / sold.length) * 100 : 0 };
  });

  return {
    steps,
    medianHoursToFirstSale: median(hours),
    trial,
    payingOrgs: paying.length,
    mrr,
    adoption,
    sellingOrgs: sold.length,
  };
}

/** "3 h", "2 días": para mostrar la mediana del tiempo hasta la primera venta. */
export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "menos de 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} días`;
}
