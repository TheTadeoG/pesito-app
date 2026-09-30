"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Radio,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
import { useActive, useCountUp } from "@/components/marketing/features-live";
import {
  ActionButton,
  Card,
  LAST_PHASE,
  Line,
  Meter,
  Num,
  Pill,
  ars,
  cols,
  type SceneProps,
} from "@/components/marketing/hero-panel-ui";
import { useSale } from "@/components/marketing/hero-sale";
import { useStaticHero } from "@/components/marketing/hero-static";
import { cn } from "@/lib/utils";

// Panel de la portada: el menú es el del sistema real. Sin JS, fuera de
// pantalla o con movimiento reducido queda el estado final completo; con
// movimiento corre sola la venta y las demás pantallas se animan (y se cargan,
// las que pesan) sólo si alguien las toca. Todos los datos son de ejemplo.

type SceneId = "pos" | "caja" | "productos" | "clientes" | "proveedores";

// Sola corre únicamente la venta; las demás pantallas se animan si alguien las toca.
const TOUR: SceneId[] = ["pos"];

const TITLES: Record<SceneId, string> = {
  pos: "Punto de Venta",
  caja: "Caja",
  productos: "Productos",
  clientes: "Clientes",
  proveedores: "Proveedores",
};

const NAV = [
  { title: "Operación", items: [
    { id: "pos", label: "Punto de Venta", icon: ShoppingCart },
    { id: "caja", label: "Caja", icon: Wallet },
    { id: "compras", label: "Compras", icon: ShoppingBag },
  ] },
  { title: "Catálogo", items: [{ id: "productos", label: "Productos", icon: LayoutGrid }] },
  { title: "Personas", items: [
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "proveedores", label: "Proveedores", icon: Truck },
  ] },
  { title: "Análisis", items: [
    { id: "envivo", label: "En vivo", icon: Radio },
    { id: "reportes", label: "Reportes", icon: BarChart3 },
  ] },
];

// Ancho al que se dibuja el panel; por debajo de eso se achica.
const DESIGN_WIDTH = 680;

const isScene = (id: string): id is SceneId => id in TITLES;

/* ---------------- escenas del recorrido ---------------- */

function PosScene({ ph, btnRef, tg, active }: SceneProps) {
  const done = ph >= 4;
  const hit = active && ph === 4;
  const caja = useCountUp(done ? 184500 : 180000, 900);
  const ventas = useCountUp(done ? 284500 : 280000, 900);
  return (
    <div className={cols}>
      <Card>
        <div className="mb-2 rounded-lg bg-muted px-2.5 py-2 text-muted-foreground">
          Escaneá o buscá un producto…
        </div>
        <Line title="Gaseosa cola 1.5L" sub="$2.200" qty="x1" />
        <Line title="Alfajor triple" sub="$900" qty="x2" />
        <Line title="Chicles menta" sub="$500" qty="x1" />
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2 text-muted-foreground">
          <span>Total</span>
          <b className="text-xl tabular-nums tracking-tight text-foreground">$4.500</b>
        </div>
        <ActionButton btnRef={btnRef} ph={ph} label="Cobrar venta" done="Venta cobrada" />
      </Card>
      <div className="flex flex-col gap-2.5">
        <Card
          title="Stock"
          tgRef={tg(0)}
          hit={hit}
          right={<Pill tone={done ? "warn" : "ok"}>{done ? "Queda poco" : "En stock"}</Pill>}
        >
          <div className="text-[11px] text-muted-foreground">Gaseosa cola 1.5L</div>
          <Num>
            {done ? 3 : 4} <span className="text-[11px] font-medium text-muted-foreground">unidades</span>
          </Num>
          <Meter pct={done ? 30 : 40} low={done} />
        </Card>
        <Card
          title="Caja de Lucas"
          tgRef={tg(1)}
          hit={hit}
          right={<Pill tone="soft" hidden={!done}>+$4.500</Pill>}
        >
          <div className="text-[11px] text-muted-foreground">Efectivo esperado</div>
          <Num>{ars(caja)}</Num>
        </Card>
        <Card
          title="Ventas de hoy"
          tgRef={tg(2)}
          hit={hit}
          right={<Pill>{`${done ? 48 : 47} ventas`}</Pill>}
        >
          <Num>{ars(ventas)}</Num>
          <div className="mt-2 flex h-11 items-end gap-[5px]">
            {[38, 52, 46, 64, 80, 58].map((h, i) => (
              <i key={i} className="flex-1 rounded-t-sm bg-accent" style={{ height: `${h}%` }} />
            ))}
            <i
              className="flex-1 rounded-t-sm bg-primary transition-[height] duration-700"
              style={{ height: done ? "100%" : "92%" }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

const PRODUCTS = [
  ["Aceite 900 ml", 3850],
  ["Fideos 500 g", 1250],
  ["Azúcar 1 kg", 1900],
  ["Galletitas 300 g", 1850],
] as const;

function PriceRow({ name, base, done }: { name: string; base: number; done: boolean }) {
  const price = useCountUp(done ? Math.round(base * 1.1) : base, 900);
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-b border-border py-1.5 tabular-nums last:border-0">
      <span>{name}</span>
      <span className="text-[11px] text-muted-foreground">costo +10%</span>
      <span className="min-w-14 text-right font-bold">{ars(price)}</span>
    </li>
  );
}

function ProductosScene({ ph, btnRef, tg, active }: SceneProps) {
  const done = ph >= 4;
  const hit = active && ph === 4;
  const count = useCountUp(done ? 148 : 0, 1000);
  return (
    <div className={cols}>
      <Card
        title="Aumento masivo"
        right={
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            Distribuidora Norte
          </span>
        }
      >
        <ul>
          {PRODUCTS.map(([n, p]) => (
            <PriceRow key={n} name={n} base={p} done={done} />
          ))}
        </ul>
        <ActionButton btnRef={btnRef} ph={ph} label="Aplicar a 148 productos" done="Precios actualizados" />
      </Card>
      <div className="flex flex-col gap-2.5">
        <Card title="Productos actualizados" tgRef={tg(0)} hit={hit} right={<Pill hidden={!done}>Listo</Pill>}>
          <Num>{Math.round(count)}</Num>
          <Meter pct={done ? 100 : 0} />
        </Card>
        <Card title="Historial de precios" tgRef={tg(1)} hit={hit}>
          <ul>
            <li className="flex items-center justify-between gap-2 border-b border-border py-1.5">
              <span>Aceite 900 ml</span>
              <span className="text-[11px] text-muted-foreground">Aumento masivo +10%</span>
              <Pill tone="soft" hidden={!done}>Hoy</Pill>
            </li>
            <li className="flex items-center justify-between gap-2 py-1.5">
              <span>Aceite 900 ml</span>
              <span className="text-[11px] text-muted-foreground">Manual</span>
              <span className="text-[11px] text-muted-foreground">hace 30 días</span>
            </li>
          </ul>
        </Card>
        <Card title="Si te equivocás">
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
            Deshacer el aumento
          </span>
        </Card>
      </div>
    </div>
  );
}

function Debtor({ initials, name, days }: { initials: string; name: string; days: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-bold text-accent-foreground">
        {initials}
      </span>
      <span className="min-w-0">
        {name}
        <small className="block text-[11px] text-muted-foreground">{days}</small>
      </span>
    </span>
  );
}

function ClientesScene({ ph, btnRef, tg, active }: SceneProps) {
  const done = ph >= 4;
  const hit = active && ph === 4;
  const deben = useCountUp(done ? 9650 : 19450, 900);
  const cobrado = useCountUp(done ? 9800 : 0, 900);
  const caja = useCountUp(done ? 194300 : 184500, 900);
  return (
    <div className={cols}>
      <Card title="Fiado" right={<span className="text-[11px] font-normal">4 clientes</span>}>
        <Line
          gone={ph >= 5}
          title={<Debtor initials="CR" name="Carlos R." days="hace 12 días" />}
          qty={<Pill tone={done ? "ok" : "bad"}>{done ? "Pagó ✓" : "$9.800"}</Pill>}
        />
        <Line title={<Debtor initials="DM" name="Diego M." days="hace 11 días" />} qty={<Pill tone="bad">$6.300</Pill>} />
        <Line title={<Debtor initials="AP" name="Ana P." days="hace 7 días" />} qty={<Pill tone="warn">$2.100</Pill>} />
        <Line title={<Debtor initials="MG" name="Marta G." days="hace 8 días" />} qty={<Pill tone="warn">$1.250</Pill>} />
        <ActionButton btnRef={btnRef} ph={ph} label="Registrar pago de Carlos" done="Pago registrado" />
      </Card>
      <div className="flex flex-col gap-2.5">
        <Card title="Te deben" tgRef={tg(0)} hit={hit}>
          <Num>{ars(deben)}</Num>
        </Card>
        <Card title="Cobrado hoy" tgRef={tg(1)} hit={hit} right={<Pill tone="soft" hidden={!done}>+$9.800</Pill>}>
          <Num>{ars(cobrado)}</Num>
        </Card>
        <Card title="Caja de Lucas" tgRef={tg(2)} hit={hit}>
          <div className="text-[11px] text-muted-foreground">Efectivo esperado</div>
          <Num>{ars(caja)}</Num>
        </Card>
      </div>
    </div>
  );
}

const CajaScene = dynamic(() => import("@/components/marketing/hero-panel-extra").then((m) => m.CajaScene), { ssr: false });
const ProveedoresScene = dynamic(() => import("@/components/marketing/hero-panel-extra").then((m) => m.ProveedoresScene), { ssr: false });

const SCENES: Record<SceneId, ComponentType<SceneProps>> = {
  pos: PosScene,
  caja: CajaScene,
  productos: ProductosScene,
  clientes: ClientesScene,
  proveedores: ProveedoresScene,
};

/* ---------------- panel ---------------- */

interface Geo {
  key: string;
  paths: string[];
  ends: { x: number; y: number }[];
  origin: { x: number; y: number };
  cursor: { x: number; y: number };
  start: { x: number; y: number };
}

export function HeroPanel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const btnEl = useRef<HTMLDivElement | null>(null);
  const targets = useRef<(HTMLElement | null)[]>([]);
  const { trigger: fireSale } = useSale();
  const staticHero = useStaticHero();
  const inView = useActive(wrapRef);
  const [paused, setPaused] = useState(false);
  // Corre una sola vez apenas entra en pantalla y después queda quieta.
  const [done, setDone] = useState(false);
  // Corre una sola vez y espera: arranca al primer scroll o a los 2,5 segundos,
  // lo que pase antes, para que primero se lea el título. Mientras espera (y ya
  // hay JS y movimiento) muestra la escena sin cobrar; sin JS o con movimiento
  // reducido queda el estado final completo.
  const [armed, setArmed] = useState(false);
  const [mode, setMode] = useState<"ssr" | "wait" | "static">("ssr");
  const waiting = mode === "wait" && !done && !paused;
  const active = inView && armed && !paused && !done && mode !== "static";
  const [scene, setScene] = useState<SceneId>("pos");
  const [ph, setPh] = useState(0);
  const [auto, setAuto] = useState(true);
  const [runs, setRuns] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  // En pantallas angostas el mismo panel se dibuja a un ancho de escritorio y se
  // achica para que entre, en vez de rearmarlo distinto.
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  const shown = active ? ph : waiting ? 0 : LAST_PHASE;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setMode(reduced || staticHero ? "static" : "wait"), 0);
    return () => window.clearTimeout(id);
  }, [staticHero]);

  useEffect(() => {
    const start = () => setArmed(true);
    const timer = window.setTimeout(start, 2500);
    window.addEventListener("scroll", start, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", start);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));
    (async () => {
      setPh(0);
      await wait(300);
      setPh(1);
      await wait(700);
      setPh(2);
      await wait(150);
      setPh(3);
      if (scene === "pos") fireSale();
      await wait(800);
      setPh(4);
      await wait(1000);
      setPh(5);
      await wait(900);
      if (cancelled) return;
      setPh(0);
      setRuns((r) => r + 1);
      const i = TOUR.indexOf(scene);
      if (auto && i < TOUR.length - 1) {
        setScene(TOUR[i + 1]);
      } else {
        setDone(true);
        if (auto) setScene("pos");
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [active, scene, auto, runs, fireSale]);

  const measure = useCallback(() => {
    const main = mainRef.current;
    const btn = btnEl.current;
    if (!main || !btn) {
      setGeo(null);
      return;
    }
    const m = main.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    // Si el panel está achicado, las medidas de pantalla se llevan a las del panel.
    const k = m.width / main.offsetWidth || 1;
    const ax = (b.right - m.left) / k - 4;
    const ay = (b.top + b.height / 2 - m.top) / k;
    const ends: { x: number; y: number }[] = [];
    const paths = targets.current
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const bx = (r.left - m.left) / k - 2;
        const by = (r.top + r.height / 2 - m.top) / k;
        const mx = (ax + bx) / 2;
        ends.push({ x: bx, y: by });
        return `M${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
      });
    const next: Geo = {
      key: paths.join("|"),
      paths,
      ends,
      origin: { x: ax, y: ay },
      cursor: { x: (b.left - m.left + b.width * 0.55) / k, y: (b.top - m.top + b.height * 0.4) / k },
      start: { x: m.width / k - 60, y: (b.top - m.top) / k - 60 },
    };
    setGeo((prev) => (prev && prev.key === next.key ? prev : next));
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const update = () => {
      const w = wrap.clientWidth;
      const scale = w >= DESIGN_WIDTH ? 1 : w / DESIGN_WIDTH;
      setFit((f) => (f.scale === scale && f.height === inner.offsetHeight ? f : { scale, height: inner.offsetHeight }));
    };
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    const late = window.setTimeout(measure, 650);
    const ro = new ResizeObserver(measure);
    if (mainRef.current) ro.observe(mainRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      ro.disconnect();
    };
  }, [scene, runs, shown, measure]);

  function go(id: SceneId) {
    setArmed(true);
    setAuto(false);
    setDone(false);
    setPaused(false);
    setPh(0);
    setRuns((r) => r + 1);
    setScene(id);
  }

  function replay() {
    setArmed(true);
    setAuto(true);
    setDone(false);
    setPaused(false);
    setPh(0);
    setRuns((r) => r + 1);
    setScene("pos");
  }

  const Scene = SCENES[scene];
  // Al arrancar o terminar se vuelve a montar la escena, así los números no "rebobinan".
  const sceneKey = `${scene}-${runs}-${active ? 1 : 0}`;
  const tg = (i: number) => (el: HTMLElement | null) => {
    targets.current[i] = el;
  };

  const scaled = fit.scale < 1;
  return (
    <div ref={wrapRef} className="w-full" style={scaled ? { height: fit.height * fit.scale } : undefined}>
    <div
      ref={innerRef}
      className="@container"
      style={scaled ? { width: DESIGN_WIDTH, transform: `scale(${fit.scale})`, transformOrigin: "top left" } : { minWidth: DESIGN_WIDTH }}
    >
    <div
      className="relative overflow-hidden rounded-t-2xl border border-b-0 border-border bg-background text-left text-xs text-foreground shadow-2xl shadow-black/20 @xl:grid @xl:grid-cols-[11.5rem_1fr]"
    >
      <aside className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3.5 @xl:flex">
        <Wordmark className="mx-2 text-xl" />
        <div className="mx-2 mb-1 mt-2 border-b border-border pb-2.5 text-[11.5px] text-muted-foreground">
          <strong className="block text-[12.5px] text-foreground">Kiosco Don Pepe</strong>
          Lucía
          <span className="mt-1.5 flex w-fit items-center gap-1.5 rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-bold text-success">
            <i className="h-1.5 w-1.5 rounded-full bg-current" />
            Caja abierta
          </span>
        </div>
        {NAV.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="mx-2 mb-0.5 mt-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const cls = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium";
              if (!isScene(item.id)) {
                return (
                  <span key={item.id} className={cn(cls, "text-sidebar-foreground/70")}>
                    <Icon className="h-[15px] w-[15px] shrink-0" />
                    {item.label}
                  </span>
                );
              }
              const on = item.id === scene;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id as SceneId)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    cls,
                    "cursor-pointer transition-colors",
                    on
                      ? "bg-sidebar-active-bg font-bold text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="min-w-0">
        <div ref={mainRef} className="relative min-h-[27rem] px-4 pb-5 pt-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold">{TITLES[scene]}</h3>
            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              {!auto && (
                <button
                  type="button"
                  onClick={replay}
                  className="rounded-full border border-border px-2.5 py-0.5 font-semibold hover:text-foreground"
                >
                  Volver a la venta
                </button>
              )}
              {done ? (
                <button
                  type="button"
                  onClick={replay}
                  aria-label="Repetir animación"
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "Reanudar animación" : "Pausar animación"}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border hover:text-foreground"
                >
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                </button>
              )}
              <span>Caja 1</span>
            </div>
          </div>

          <div key={sceneKey}>
            <Scene ph={shown} active={active} variant={runs} btnRef={btnEl} tg={tg} />
          </div>

          {geo && (
            <>
              <svg aria-hidden className="pointer-events-none absolute inset-0 z-[3] h-full w-full overflow-visible">
                {geo.paths.map((d, i) => (
                  <g key={i}>
                    <path d={d} fill="none" strokeWidth={2} strokeDasharray="3 5" strokeLinecap="round" className="stroke-border" />
                    <path
                      d={d}
                      fill="none"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      pathLength={1}
                      className="stroke-primary"
                      style={{
                        strokeDasharray: 1,
                        strokeDashoffset: shown >= 3 ? 0 : 1,
                        opacity: shown >= 3 ? 1 : 0,
                        transition: shown >= 3 ? "stroke-dashoffset 800ms cubic-bezier(0.4, 0.1, 0.2, 1)" : "none",
                      }}
                    />
                  </g>
                ))}
              </svg>
              {staticHero && shown >= 3 && (
                <svg aria-hidden className="pointer-events-none absolute inset-0 z-[3] h-full w-full overflow-visible">
                  <circle cx={geo.origin.x} cy={geo.origin.y} r={4.5} className="fill-primary" />
                  {geo.ends.map((e, i) => (
                    <circle key={i} cx={e.x} cy={e.y} r={4.5} className="fill-primary" />
                  ))}
                </svg>
              )}
              {active && shown === 3 &&
                geo.paths.map((d, i) => <i key={`${sceneKey}-${i}`} className="hp-dot" style={{ offsetPath: `path('${d}')` }} />)}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-0 top-0 z-[4] h-5 w-5 drop-shadow-md"
                style={{
                  transform: `translate(${shown >= 1 ? geo.cursor.x : geo.start.x}px, ${shown >= 1 ? geo.cursor.y : geo.start.y}px)`,
                  transition: "transform 700ms cubic-bezier(0.4, 0.1, 0.2, 1), opacity 300ms",
                  opacity: active && shown <= 4 ? 1 : 0,
                }}
              >
                <path d="M4 2l15 9-6.5 1.6L9.6 19z" className="fill-foreground stroke-background" strokeWidth={1.5} />
              </svg>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
