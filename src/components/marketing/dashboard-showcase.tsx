import { AlertTriangle, BarChart3, Package, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Paleta categórica ya validada (misma que DonutChart, ver ese archivo) —
// se reutiliza acá para que los mockups de la landing luzcan coherentes
// con los gráficos reales de adentro del sistema.
const PALETTE = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#db2777"];

const weeklySales = [
  { day: "Lun", value: 18400 },
  { day: "Mar", value: 22100 },
  { day: "Mié", value: 19800 },
  { day: "Jue", value: 26700 },
  { day: "Vie", value: 34200 },
  { day: "Sáb", value: 41500 },
  { day: "Dom", value: 28900 },
];

const categorySales = [
  { label: "Bebidas", value: 41200 },
  { label: "Almacén", value: 33500 },
  { label: "Golosinas", value: 21800 },
  { label: "Limpieza", value: 14300 },
  { label: "Otros", value: 9200 },
];

const stockAlerts = [
  { name: "Coca-Cola 2.25L", level: "critico" as const, pct: 0 },
  { name: "Pan lactal", level: "bajo" as const, pct: 18 },
  { name: "Detergente 750ml", level: "bajo" as const, pct: 24 },
  { name: "Alfajor triple", level: "ok" as const, pct: 76 },
];

const stockLevelStyles = {
  critico: { label: "Sin stock", dot: "bg-danger", bar: "bg-danger", text: "text-danger" },
  bajo: { label: "Stock bajo", dot: "bg-warning", bar: "bg-warning", text: "text-warning" },
  ok: { label: "OK", dot: "bg-success", bar: "bg-success", text: "text-success" },
};

const cajaEsperado = 184500;
const cajaContado = 184200;
const cajaMatchPct = Math.round((cajaContado / cajaEsperado) * 1000) / 10;
const medios = [
  { label: "Efectivo", pct: 58, color: PALETTE[0] },
  { label: "Tarjeta", pct: 27, color: PALETTE[1] },
  { label: "Transferencia", pct: 9, color: PALETTE[2] },
  { label: "QR", pct: 6, color: PALETTE[3] },
];

function ReportesCard() {
  const maxSale = Math.max(...weeklySales.map((d) => d.value));
  const totalCategorySales = categorySales.reduce((acc, c) => acc + c.value, 0);
  const donutRadius = 55;
  const circumference = 2 * Math.PI * donutRadius;

  const segments = categorySales.reduce<
    Array<{ label: string; value: number; dash: number; dashOffset: number; color: string }>
  >((acc, c, i) => {
    const fraction = c.value / totalCategorySales;
    const dash = fraction * circumference;
    const offsetSoFar = acc.reduce((sum, s) => sum + s.dash, 0);
    return [...acc, { ...c, dash, dashOffset: -offsetSoFar, color: PALETTE[i % PALETTE.length] }];
  }, []);

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-lg shadow-black/5 sm:p-6">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Reportes
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Ventas de la semana</p>
          <div className="mt-3 flex h-28 items-end justify-between gap-1.5">
            {weeklySales.map((d, i) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="animate-grow-in-y w-full rounded-t-md"
                    style={{
                      height: `${Math.max(6, (d.value / maxSale) * 100)}%`,
                      background: `linear-gradient(180deg, ${PALETTE[0]}, ${PALETTE[1]})`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Ventas por categoría</p>
          <div className="mt-3 flex items-center gap-5">
            <svg
              width="110"
              height="110"
              viewBox="0 0 120 120"
              className="animate-pop-in -rotate-90 shrink-0"
            >
              <circle
                cx="60"
                cy="60"
                r={donutRadius}
                fill="none"
                stroke="var(--color-muted)"
                strokeWidth="16"
              />
              {segments.map((s) => (
                <circle
                  key={s.label}
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                  strokeDashoffset={s.dashOffset}
                />
              ))}
            </svg>
            <div className="min-w-0 space-y-1.5">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventarioCard() {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-lg shadow-black/5 sm:p-6">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Package className="h-4 w-4 text-muted-foreground" />
        Inventario
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        Alertas de stock
      </p>
      <div className="mt-3 space-y-3">
        {stockAlerts.map((item, i) => {
          const style = stockLevelStyles[item.level];
          return (
            <div key={item.name} className="flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                {item.level === "critico" && (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                      style.dot
                    )}
                  />
                )}
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", style.dot)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-foreground">{item.name}</span>
                  <span className={cn("shrink-0 text-xs font-semibold", style.text)}>
                    {style.label}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("animate-grow-in-x h-full rounded-full", style.bar)}
                    style={{ width: `${Math.max(4, item.pct)}%`, animationDelay: `${i * 80}ms` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CajaCard() {
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDash = (cajaMatchPct / 100) * ringCircumference;

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-lg shadow-black/5 sm:p-6">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        Caja
      </p>

      <div className="mt-4 flex items-center gap-5">
        <svg width="100" height="100" viewBox="0 0 110 110" className="animate-pop-in -rotate-90 shrink-0">
          <circle cx="55" cy="55" r={ringRadius} fill="none" stroke="var(--color-muted)" strokeWidth="10" />
          <circle
            cx="55"
            cy="55"
            r={ringRadius}
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${ringDash} ${ringCircumference - ringDash}`}
          />
        </svg>
        <div>
          <p className="text-2xl font-bold text-success">{cajaMatchPct}%</p>
          <p className="text-xs text-muted-foreground">Caja cuadrada</p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Esperado</span>
        <span className="font-semibold text-foreground">{formatCurrency(cajaEsperado)}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Contado</span>
        <span className="font-semibold text-foreground">{formatCurrency(cajaContado)}</span>
      </div>

      <p className="mt-4 text-xs font-semibold text-foreground">Medios de pago</p>
      <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {medios.map((m, i) => (
          <div
            key={m.label}
            className="animate-grow-in-x"
            style={{ width: `${m.pct}%`, background: m.color, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {medios.map((m) => (
          <span key={m.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
            {m.label} {m.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function DashboardShowcase() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Mirá cómo se ve tu negocio en Pesito
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Ventas, stock y caja, siempre a la vista — así lucen Reportes, Inventario y Caja una vez
          que cargás tu negocio.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-6">
        <ReportesCard />
        <div className="grid gap-6 sm:grid-cols-2">
          <InventarioCard />
          <CajaCard />
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">
        Números de ejemplo, no de un negocio real — así se ve tu propio negocio una vez que cargás
        tus ventas.
      </p>
    </section>
  );
}
