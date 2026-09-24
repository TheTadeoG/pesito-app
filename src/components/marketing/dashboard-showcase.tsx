"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Package,
  Scale,
  ShieldCheck,
  Store,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Versión corta ($18k en vez de $18.400) para que el monto entre arriba
// de cada barra sin desbordar en una columna angosta.
function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return formatCurrency(value);
}

// Paleta categórica ya validada (misma que DonutChart, ver ese archivo) —
// se reutiliza acá para que los mockups de la landing luzcan coherentes
// con los gráficos reales de adentro del sistema.
const PALETTE = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#db2777"];

// Números de ejemplo, no datos reales de ningún negocio — se aclara abajo.
// Coherentes entre sí (ganancia = ventas - costo) para que se sienta un
// panel real, no una lista de números sueltos.
const summary = [
  { label: "Ventas de hoy", value: 284500, icon: TrendingUp, tone: "text-foreground" },
  { label: "Costo de lo vendido", value: 171200, icon: ArrowDownRight, tone: "text-danger" },
  { label: "Ganancia", value: 113300, icon: ArrowUpRight, tone: "text-success" },
];

const topProducts = [
  { name: "Coca-Cola 2.25L", quantity: 18 },
  { name: "Pan lactal", quantity: 14 },
  { name: "Alfajor triple", quantity: 12 },
  { name: "Cigarrillos 20u", quantity: 9 },
];

const topDebtors = [
  { name: "Fernando R.", amount: 8200 },
  { name: "Lucía M.", amount: 5400 },
  { name: "Roberto G.", amount: 3150 },
];

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
const cajaDiferencia = cajaContado - cajaEsperado;
const cajaMatchPct = Math.round((cajaContado / cajaEsperado) * 1000) / 10;
const medios = [
  { label: "Efectivo", pct: 58, color: PALETTE[0] },
  { label: "Tarjeta", pct: 27, color: PALETTE[1] },
  { label: "Transferencia", pct: 9, color: PALETTE[2] },
  { label: "QR", pct: 6, color: PALETTE[3] },
];

const cajaPorEmpleado = [
  { name: "Rocío D.", faltante: 0 },
  { name: "Juan P.", faltante: 850 },
  { name: "Mica G.", faltante: 220 },
];

const sucursales = [
  { name: "Local Centro", ventas: 412000, ganancia: 156000 },
  { name: "Local Norte", ventas: 298000, ganancia: 101000 },
  { name: "Local Sur", ventas: 187000, ganancia: 58000 },
];

function SlideHeading({ icon: Icon, children }: { icon: typeof BarChart3; children: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </p>
  );
}

function ResumenSlide() {
  return (
    <div>
      <SlideHeading icon={TrendingUp}>Resumen de hoy</SlideHeading>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border p-3">
            <tile.icon className={cn("h-4 w-4", tile.tone)} />
            <p className="mt-2 truncate text-xs text-muted-foreground">{tile.label}</p>
            <p className={cn("text-base font-bold sm:text-lg", tile.tone)}>
              {formatCurrency(tile.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Productos más vendidos</p>
          <ul className="mt-2.5 space-y-2">
            {topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{p.name}</span>
                <span className="shrink-0 text-muted-foreground">{p.quantity} u.</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Wallet className="h-3.5 w-3.5 text-warning" />
            Clientes que más deben
          </p>
          <ul className="mt-2.5 space-y-2">
            {topDebtors.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{c.name}</span>
                <span className="shrink-0 font-medium text-warning">
                  {formatCurrency(c.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Dona con separación real entre segmentos (2px de "hueco" en vez de que
// se toquen) y un total al centro — sin eso, un anillo grueso con colores
// pegados uno al lado del otro se lee como un borrón, no como datos.
const DONUT_GAP = 3;

function ReportesSlide() {
  const maxSale = Math.max(...weeklySales.map((d) => d.value));
  const weekTotal = weeklySales.reduce((acc, d) => acc + d.value, 0);
  const bestDay = weeklySales.reduce((best, d) => (d.value > best.value ? d : best), weeklySales[0]);
  const total = categorySales.reduce((acc, c) => acc + c.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = categorySales.reduce<
    Array<{ label: string; value: number; dash: number; dashOffset: number; color: string; pct: number }>
  >((acc, c, i) => {
    const rawDash = (c.value / total) * circumference;
    const offsetSoFar = acc.reduce((sum, s) => sum + s.dash + DONUT_GAP, 0);
    return [
      ...acc,
      {
        ...c,
        dash: Math.max(0, rawDash - DONUT_GAP),
        dashOffset: -offsetSoFar,
        color: PALETTE[i % PALETTE.length],
        pct: Math.round((c.value / total) * 100),
      },
    ];
  }, []);

  return (
    <div>
      <SlideHeading icon={BarChart3}>Reportes</SlideHeading>

      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Ventas de la semana</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(weekTotal)}{" "}
            <span className="text-sm font-normal text-muted-foreground">en 7 días</span>
          </p>
          <div className="mt-5 flex h-44 items-stretch justify-between gap-1.5">
            {weeklySales.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    d.day === bestDay.day ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {formatCompactCurrency(d.value)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${Math.max(6, (d.value / maxSale) * 100)}%`,
                      background: `linear-gradient(180deg, ${PALETTE[0]}, ${PALETTE[1]})`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs",
                    d.day === bestDay.day
                      ? "font-semibold text-success"
                      : "text-muted-foreground"
                  )}
                >
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Ventas por categoría</p>
          <div className="mt-5 flex items-center gap-6">
            <div className="relative shrink-0">
              <svg width="150" height="150" viewBox="0 0 120 120" className="-rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="var(--color-muted)"
                  strokeWidth="15"
                />
                {segments.map((s) => (
                  <circle
                    key={s.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="15"
                    strokeLinecap="round"
                    strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                    strokeDashoffset={s.dashOffset}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total
                </span>
                <span className="text-[13px] font-bold text-foreground">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-foreground">{s.label}</span>
                  <span className="shrink-0 text-muted-foreground">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inventario y Caja se unen en una sola diapositiva: cada uno por separado
// tiene mucho menos contenido que Reportes, así que el slider (que estira
// todas las diapositivas a la altura de la más alta) las dejaba con un
// hueco enorme abajo — sobre todo en celular, donde cada sección ya apila
// vertical y no hay una segunda columna que "rellene" el ancho.
function InventarioCajaSlide() {
  const diffLabel =
    cajaDiferencia === 0
      ? "Cuadra justo"
      : cajaDiferencia > 0
        ? `+${formatCurrency(cajaDiferencia)} de sobrante`
        : `${formatCurrency(cajaDiferencia)} de faltante`;
  const diffTone = cajaDiferencia === 0 ? "text-success" : "text-warning";

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div>
        <SlideHeading icon={Package}>Inventario</SlideHeading>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Alertas de stock
        </p>
        <div className="mt-3 space-y-3">
          {stockAlerts.map((item) => {
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
                      className={cn("h-full rounded-full", style.bar)}
                      style={{ width: `${Math.max(4, item.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SlideHeading icon={Wallet}>Caja</SlideHeading>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Coincidencia de caja
          </span>
          <span className="text-xl font-bold text-success">{cajaMatchPct}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${Math.min(100, cajaMatchPct)}%` }}
          />
        </div>
        <p className={cn("mt-1.5 text-xs font-medium", diffTone)}>{diffLabel}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Esperado</p>
            <p className="font-semibold text-foreground">{formatCurrency(cajaEsperado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contado</p>
            <p className="font-semibold text-foreground">{formatCurrency(cajaContado)}</p>
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold text-foreground">Medios de pago</p>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {medios.map((m) => (
            <div key={m.label} style={{ width: `${m.pct}%`, background: m.color }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {medios.map((m) => (
            <span
              key={m.label}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
              {m.label} {m.pct}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mismo motivo que InventarioCajaSlide: cada mitad por separado tiene poco
// contenido, así que se juntan en una sola diapositiva de dos columnas.
function EquipoSucursalesSlide() {
  const topSucursal = sucursales[0];

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div>
        <SlideHeading icon={Scale}>Caja por empleado</SlideHeading>
        <p className="mt-3 text-xs text-muted-foreground">Faltantes del mes, por vendedor</p>
        <ul className="mt-3 space-y-3">
          {cajaPorEmpleado.map((e) => (
            <li key={e.name} className="flex items-center justify-between text-sm">
              <span className="truncate text-foreground">{e.name}</span>
              {e.faltante > 0 ? (
                <span className="shrink-0 font-semibold text-danger">
                  -{formatCurrency(e.faltante)}
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-success">Cuadra perfecto</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SlideHeading icon={Store}>Sucursales</SlideHeading>
        <p className="mt-3 text-xs text-muted-foreground">Quién vende y gana más este mes</p>
        <ul className="mt-3 space-y-2">
          {sucursales.map((s, i) => (
            <li
              key={s.name}
              className={cn(
                "rounded-xl border p-3",
                s.name === topSucursal.name ? "border-success bg-success-bg" : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {s.name === topSucursal.name && (
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-success" />
                  )}
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">#{i + 1}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Ventas <span className="font-semibold text-foreground">{formatCurrency(s.ventas)}</span>
                </span>
                <span>
                  Ganancia <span className="font-semibold text-success">{formatCurrency(s.ganancia)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const slides = [
  { id: "resumen", label: "Resumen", Component: ResumenSlide },
  { id: "reportes", label: "Reportes", Component: ReportesSlide },
  { id: "inventario-caja", label: "Inventario y caja", Component: InventarioCajaSlide },
  { id: "equipo-sucursales", label: "Equipo y sucursales", Component: EquipoSucursalesSlide },
];

const AUTO_ADVANCE_MS = 15000;

export function DashboardShowcase() {
  const [active, setActive] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoplay = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
  }, []);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoplay]);

  function goTo(index: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(index);
    startAutoplay();
  }

  function step(delta: number) {
    goTo((active + delta + slides.length) % slides.length);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Mirá cómo se ve tu negocio en Pesito
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Ventas, stock y caja, siempre a la vista — sin tener que sumarlo vos a mano.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl">
        <div className="relative">
          <div className="overflow-hidden rounded-card border border-border bg-card shadow-lg shadow-black/5">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {slides.map(({ id, Component }) => (
                <div key={id} className="w-full shrink-0 p-5 sm:p-6">
                  <Component />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Diapositiva anterior"
            className="absolute left-0 top-1/2 hidden -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 text-muted-foreground shadow-md transition-colors hover:text-foreground sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Siguiente diapositiva"
            className="absolute right-0 top-1/2 hidden translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 text-muted-foreground shadow-md transition-colors hover:text-foreground sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver ${s.label}`}
              className={cn(
                "h-2 rounded-full transition-all",
                active === i ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">
        Números de ejemplo, no de un negocio real — así ves tus propios pesitos una vez que cargás
        tus ventas.
      </p>
    </section>
  );
}
