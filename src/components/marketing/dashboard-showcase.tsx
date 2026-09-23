"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Package, Radio, Wallet } from "lucide-react";
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
const medios = [
  { label: "Efectivo", pct: 58, color: PALETTE[0] },
  { label: "Tarjeta", pct: 27, color: PALETTE[1] },
  { label: "Transferencia", pct: 9, color: PALETTE[2] },
  { label: "QR", pct: 6, color: PALETTE[3] },
];

const tabs = [
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "caja", label: "Caja", icon: Wallet },
];

// Cuenta de 0 al valor final con easing, para que los números "lleguen"
// en vez de aparecer de golpe — se relanza cada vez que `active` pasa a
// true (el panel entra en pantalla o se activa su tab).
function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);

  return value;
}

function ReportesPanel({ active }: { active: boolean }) {
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
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-foreground">Ventas de la semana</p>
        <div className="mt-4 flex h-32 items-end justify-between gap-1.5">
          {weeklySales.map((d, i) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: active ? `${Math.max(6, (d.value / maxSale) * 100)}%` : "0%",
                    background: `linear-gradient(180deg, ${PALETTE[0]}, ${PALETTE[1]})`,
                    transition: `height 700ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms`,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Ventas por categoría</p>
        <div className="mt-4 flex items-center gap-5">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="-rotate-90 shrink-0"
            style={{
              transform: active ? "rotate(-90deg) scale(1)" : "rotate(-90deg) scale(0.6)",
              opacity: active ? 1 : 0,
              transition: "transform 600ms cubic-bezier(0.22,1,0.36,1), opacity 500ms ease-out",
            }}
          >
            <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="var(--color-muted)" strokeWidth="16" />
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
  );
}

function InventarioPanel({ active }: { active: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Alertas de stock
      </p>
      <div className="mt-4 space-y-3">
        {stockAlerts.map((item, i) => {
          const style = stockLevelStyles[item.level];
          return (
            <div key={item.name} className="flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                {item.level === "critico" && (
                  <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", style.dot)} />
                )}
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", style.dot)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-foreground">{item.name}</span>
                  <span className={cn("shrink-0 text-xs font-semibold", style.text)}>{style.label}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", style.bar)}
                    style={{
                      width: active ? `${Math.max(4, item.pct)}%` : "0%",
                      transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${i * 90}ms`,
                    }}
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

function CajaPanel({ active }: { active: boolean }) {
  const matchPct = Math.round((cajaContado / cajaEsperado) * 1000) / 10;
  const esperado = useCountUp(cajaEsperado, active);
  const contado = useCountUp(cajaContado, active);

  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDash = active ? (matchPct / 100) * ringCircumference : 0;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex items-center gap-5">
        <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90 shrink-0">
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
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div>
          <p className="text-2xl font-bold text-success">{matchPct}%</p>
          <p className="text-xs text-muted-foreground">Caja cuadrada</p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Esperado</span>
          <span className="font-semibold text-foreground">{formatCurrency(esperado)}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Contado</span>
          <span className="font-semibold text-foreground">{formatCurrency(contado)}</span>
        </div>

        <p className="mt-4 text-xs font-semibold text-foreground">Medios de pago</p>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {medios.map((m, i) => (
            <div
              key={m.label}
              style={{
                width: active ? `${m.pct}%` : "0%",
                background: m.color,
                transition: `width 700ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
              }}
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
    </div>
  );
}

// El contenido de cada panel arranca "apagado" (barras en 0, dona
// achicada) y un tick después de montar pasa a visible, así el navegador
// alcanza a pintar el estado inicial antes de animar al final. Se remonta
// entero (vía la key del panel en el padre), así el estado siempre arranca
// en `false` sin necesidad de resetearlo a mano en un efecto.
function RevealOnMount({ children }: { children: (visible: boolean) => ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);
  return <>{children(visible)}</>;
}

const AUTO_ROTATE_MS = 5000;

export function DashboardShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const [panelKey, setPanelKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function goTo(index: number) {
    setActiveTab(index);
    setPanelKey((k) => k + 1);
  }

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
      setPanelKey((k) => k + 1);
    }, AUTO_ROTATE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function handleManualClick(index: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    goTo(index);
    intervalRef.current = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
      setPanelKey((k) => k + 1);
    }, AUTO_ROTATE_MS);
  }

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

      <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-card border border-border bg-card shadow-lg shadow-black/5">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-5">
          <div className="flex gap-1">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleManualClick(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  activeTab === i
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Radio className="h-3 w-3 animate-pulse text-success" />
            En vivo
          </span>
        </div>

        <div key={panelKey} className="p-5 sm:p-7">
          <RevealOnMount>
            {(visible) => (
              <>
                {activeTab === 0 && <ReportesPanel active={visible} />}
                {activeTab === 1 && <InventarioPanel active={visible} />}
                {activeTab === 2 && <CajaPanel active={visible} />}
              </>
            )}
          </RevealOnMount>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">
        Números de ejemplo, no de un negocio real — así se ve tu propio negocio una vez que cargás
        tus ventas.
      </p>
    </section>
  );
}
