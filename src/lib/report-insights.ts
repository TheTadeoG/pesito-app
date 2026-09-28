import { ARG_TZ, argHour } from "@/lib/timezone";
import { formatCurrency } from "@/lib/utils";

// "Reportes avanzados con IA" (Plan IA): un resumen en palabras que Pesito
// arma solo con los números del período. No llama a ningún modelo: son
// reglas fijas sobre datos que Reportes ya calculó, así que es gratis,
// instantáneo y no manda datos del negocio a terceros.

export interface ReportInsightsInput {
  sales: { created_at: string; total: number }[];
  ingresos: number;
  ganancia: number;
  /** Variación de ingresos contra el período anterior (null: sin comparar). */
  deltaPct: number | null;
  comparisonLabel: string | null;
  topByQuantity: { name: string; quantity: number }[];
  topByMargin: { name: string; margin: number }[];
  lossProducts: { name: string; quantity: number; loss: number }[];
  paymentBreakdown: { label: string; value: number }[];
  fiadoOwed: number;
  /** Con horas o días de un solo día no tiene sentido hablar de "el mejor día". */
  singleDay: boolean;
}

const weekdayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: ARG_TZ });

function pct(value: number) {
  return `${Math.abs(Math.round(value))}%`;
}

export function buildReportInsights(input: ReportInsightsInput): string[] {
  const out: string[] = [];
  if (input.sales.length === 0) return ["Todavía no hay ventas en este período para resumir."];

  // Tendencia
  if (input.deltaPct !== null && input.comparisonLabel) {
    if (Math.abs(input.deltaPct) < 2) {
      out.push(`Vendiste prácticamente lo mismo que ${input.comparisonLabel}.`);
    } else {
      out.push(
        `Vendiste ${pct(input.deltaPct)} ${input.deltaPct > 0 ? "más" : "menos"} que ${input.comparisonLabel}.`
      );
    }
  }

  // Margen
  if (input.ingresos > 0) {
    const margin = (input.ganancia / input.ingresos) * 100;
    out.push(
      `De cada $100 que vendés, te quedan unos $${Math.round(margin)} de ganancia estimada (${formatCurrency(input.ganancia)} en total).`
    );
  }

  // Mejor día y hora pico
  if (!input.singleDay) {
    const byDay = new Map<string, { total: number; days: Set<string> }>();
    for (const sale of input.sales) {
      const date = new Date(sale.created_at);
      const key = weekdayFormatter.format(date);
      const entry = byDay.get(key) ?? { total: 0, days: new Set<string>() };
      entry.total += sale.total;
      entry.days.add(date.toLocaleDateString("en-CA", { timeZone: ARG_TZ }));
      byDay.set(key, entry);
    }
    const avg = Array.from(byDay.entries())
      .map(([day, e]) => ({ day, avg: e.total / e.days.size, days: e.days.size }))
      .filter((d) => d.days >= 2)
      .sort((a, b) => b.avg - a.avg);
    if (avg.length >= 2) {
      out.push(
        `Tu mejor día es el ${avg[0].day} (${formatCurrency(avg[0].avg)} en promedio) y el más flojo, el ${avg[avg.length - 1].day} (${formatCurrency(avg[avg.length - 1].avg)}).`
      );
    }
  }
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const sale of input.sales) byHour[argHour(new Date(sale.created_at))] += sale.total;
  const totalByHour = byHour.reduce((a, b) => a + b, 0);
  // Ventana de 3 horas seguidas con más ventas.
  let bestStart = 0;
  let best = -1;
  for (let h = 0; h < 22; h++) {
    const sum = byHour[h] + byHour[h + 1] + byHour[h + 2];
    if (sum > best) {
      best = sum;
      bestStart = h;
    }
  }
  if (totalByHour > 0 && input.sales.length >= 10) {
    out.push(
      `Entre las ${bestStart} y las ${bestStart + 3} hs concentrás el ${Math.round((best / totalByHour) * 100)}% de tus ventas: ahí conviene tener la caja y la góndola a punto.`
    );
  }

  // Productos
  if (input.topByQuantity[0]) {
    const top = input.topByQuantity[0];
    out.push(`El producto que más salió fue ${top.name} (${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(top.quantity)} vendidos).`);
  }
  if (input.topByMargin[0] && input.topByMargin[0].name !== input.topByQuantity[0]?.name) {
    out.push(
      `El que más plata te dejó fue ${input.topByMargin[0].name} (${formatCurrency(input.topByMargin[0].margin)} de ganancia estimada), aunque no es el que más se vendió.`
    );
  }
  if (input.lossProducts.length > 0) {
    const total = input.lossProducts.reduce((n, p) => n + p.loss, 0);
    out.push(
      `Atención: vendiste ${input.lossProducts.length === 1 ? "un producto" : "productos"} por debajo del costo, entre ellos ${input.lossProducts[0].name}. Perdiste unos ${formatCurrency(total)} en los que más pesan; revisá sus precios en Recomendaciones.`
    );
  }

  // Cobros y fiado
  const paid = input.paymentBreakdown.reduce((n, p) => n + p.value, 0);
  if (paid > 0 && input.paymentBreakdown[0]) {
    const first = input.paymentBreakdown[0];
    out.push(`${first.label} es tu medio de cobro principal (${Math.round((first.value / paid) * 100)}% de lo vendido).`);
  }
  if (input.fiadoOwed > 0 && input.ingresos > 0) {
    out.push(`Tus clientes te deben ${formatCurrency(input.fiadoOwed)} en total (fiado). Es plata que ya vendiste y todavía no cobraste.`);
  }
  return out;
}
