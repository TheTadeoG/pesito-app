"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  PackagePlus,
  Receipt,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { getOnboardingProgress, type OnboardingProgress } from "@/components/dashboard/onboarding-actions";
import { cn } from "@/lib/utils";

// "Primeros pasos": una guía corta para el negocio recién creado. Primero lo mínimo para hacer la
// primera venta (producto, caja, venta); cuando eso está, qué más probar (una compra, un cliente,
// el cierre de caja y los reportes). Se avanza solo con lo que el negocio carga: no hay que marcar
// nada. Se puede ocultar y no vuelve. Sólo dueños y administradores, el primer mes.

const DISMISS_KEY = "pesito-onboarding-dismissed";
const FORCE_KEY = "pesito-onboarding-forced";
const OPEN_EVENT = "pesito:onboarding-open";
const VISITED_KEY = "pesito-onboarding-visited";
const REFETCH_MS = 20_000;

interface Step {
  id: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  /** true si ya está hecho, según lo que hay cargado (o lo que se visitó). */
  done: (p: OnboardingProgress, visited: Set<string>) => boolean;
}

const FIRST_SALE: Step[] = [
  {
    id: "product",
    title: "Cargá tu primer producto",
    text: "Nombre y precio alcanzan. El costo y el stock los podés sumar después. Si ya tenés una lista, subila desde Acciones → Cargar desde Excel.",
    href: "/productos",
    cta: "Cargar producto",
    icon: PackagePlus,
    done: (p) => p.product,
  },
  {
    id: "cash",
    title: "Abrí la caja",
    text: "Decí con cuánto efectivo arrancás. Así, al cerrar, ves si el dinero cierra.",
    href: "/caja",
    cta: "Abrir la caja",
    icon: Wallet,
    done: (p) => p.cashOpened,
  },
  {
    id: "sale",
    title: "Hacé tu primera venta",
    text: "Buscá el producto o escaneá el código, elegí cómo paga y cobrá. Te sale el vuelto y el ticket.",
    href: "/pos",
    cta: "Ir a vender",
    icon: ShoppingCart,
    done: (p) => p.sale,
  },
];

const NEXT_STEPS: Step[] = [
  {
    id: "purchase",
    title: "Registrá una compra",
    text: "Cuando te llega mercadería, cargala: suma el stock y guarda el costo de cada producto.",
    href: "/compras",
    cta: "Cargar una compra",
    icon: ShoppingBag,
    done: (p) => p.purchase,
  },
  {
    id: "customer",
    title: "Cargá un cliente",
    text: "Para anotarle lo que se lleva fiado y ver cuánto te debe.",
    href: "/clientes",
    cta: "Cargar un cliente",
    icon: UserPlus,
    done: (p) => p.customer,
  },
  {
    id: "close",
    title: "Cerrá la caja al terminar el día",
    text: "Contás el efectivo y Pesito te dice si sobra o falta.",
    href: "/caja",
    cta: "Ir a Caja",
    icon: Receipt,
    done: (p) => p.cashClosed,
  },
  {
    id: "reports",
    title: "Mirá tus reportes",
    text: "Cuánto vendiste, qué se vende más y cuánto ganás.",
    href: "/reportes",
    cta: "Ver reportes",
    icon: BarChart3,
    done: (_p, visited) => visited.has("reports"),
  },
];

/**
 * Vuelve a mostrar la guía (desde el botón de ayuda), aunque el negocio ya no sea nuevo, la haya
 * ocultado o la haya terminado: entonces se ven todos los pasos juntos, con los hechos tildados.
 */
export function reopenOnboarding() {
  try {
    window.localStorage.removeItem(DISMISS_KEY);
    window.localStorage.setItem(FORCE_KEY, "1");
  } catch {
    // sin almacenamiento: se muestra igual mientras no se recargue
  }
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function readVisited(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(VISITED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function OnboardingChecklist({ show, canReopen }: { show: boolean; canReopen: boolean }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(true); // oculto hasta saber qué hay guardado
  const [forced, setForced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const lastFetch = useRef(0);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
      setForced(window.localStorage.getItem(FORCE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setVisited(readVisited());
  }, []);

  // Visitar Reportes cuenta como "mirá tus reportes".
  useEffect(() => {
    if (pathname !== "/reportes") return;
    const next = readVisited().add("reports");
    try {
      window.localStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // sin almacenamiento: queda sin marcar
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisited(next);
  }, [pathname]);

  const load = useCallback(async () => {
    lastFetch.current = Date.now();
    const next = await getOnboardingProgress();
    if (next) setProgress(next);
    setFailed(!next);
  }, []);

  // "Ver los primeros pasos" del menú de ayuda.
  useEffect(() => {
    function onOpen() {
      setForced(true);
      setDismissed(false);
      setOpen(true);
      void load();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [load]);

  const eligible = canReopen && (show || forced);

  // Al entrar y, al moverse entre pantallas, a lo sumo una vez cada 20 s.
  useEffect(() => {
    if (!eligible || dismissed) return;
    if (Date.now() - lastFetch.current < REFETCH_MS && progress) return;
    const id = window.setTimeout(load, progress ? 800 : 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed, pathname, load]);

  // Reabierta desde la ayuda y todavía sin datos: nunca queda en silencio (cargando, o no se pudo).
  if (eligible && !dismissed && forced && !progress && pathname !== "/pos") {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground sm:mx-6 lg:mx-8">
        <Rocket className="h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1">{failed ? "No pudimos cargar tus primeros pasos." : "Cargando tus primeros pasos…"}</p>
        {failed && (
          <button type="button" onClick={() => void load()} className="shrink-0 text-xs font-semibold text-primary hover:underline">
            Reintentar
          </button>
        )}
        <button type="button" onClick={dismiss} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          Cerrar
        </button>
      </div>
    );
  }

  // En el POS no: ahí se cobra y el espacio es del carrito.
  if (!eligible || dismissed || !progress || pathname === "/pos") return null;

  const firstDone = FIRST_SALE.every((s) => s.done(progress, visited));
  // Reabierta desde la ayuda: todos los pasos juntos, con los hechos tildados.
  const steps = forced ? [...FIRST_SALE, ...NEXT_STEPS] : firstDone ? NEXT_STEPS : FIRST_SALE;
  const doneCount = steps.filter((s) => s.done(progress, visited)).length;
  const allDone = !forced && firstDone && NEXT_STEPS.every((s) => s.done(progress, visited));
  const current = steps.find((s) => !s.done(progress, visited)) ?? null;
  const expanded = open ?? doneCount === 0;

  function dismiss() {
    setDismissed(true);
    setForced(false);
    try {
      window.localStorage.removeItem(FORCE_KEY);
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sin almacenamiento: vuelve en la próxima visita
    }
  }

  if (allDone) {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground sm:mx-6 lg:mx-8">
        <Check className="h-5 w-5 shrink-0 text-success" />
        <p className="flex-1">
          <span className="font-semibold">¡Listo, ya usaste lo principal de Pesito!</span> Si algo no cierra o te falta, escribinos desde el botón de ayuda.
        </p>
        <button type="button" onClick={dismiss} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Primeros pasos"
      className="mx-4 mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 sm:mx-6 lg:mx-8"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Rocket className="h-[18px] w-[18px]" />
        </span>
        <button type="button" onClick={() => setOpen(!expanded)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-foreground">
            {forced ? "Primeros pasos" : firstDone ? "Ya sabés vender. Sumá esto:" : "Tu primera venta en 3 pasos"}
            <span className="ml-2 text-xs font-medium text-muted-foreground">{`${doneCount} de ${steps.length}`}</span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </span>
        </button>
        {!expanded && current && (
          <Link
            href={current.href}
            prefetch={false}
            className="hidden shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 sm:inline-flex"
          >
            {current.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-label={expanded ? "Plegar los pasos" : "Ver los pasos"}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar los primeros pasos"
          title="Ocultar"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <ol className="space-y-2 border-t border-primary/15 p-3">
          {steps.map((s, i) => {
            const done = s.done(progress, visited);
            const isCurrent = current?.id === s.id;
            const Icon = s.icon;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-3",
                  done ? "border-border bg-card/60" : isCurrent ? "border-primary/40 bg-card" : "border-border bg-card/60"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done ? "bg-success text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("flex items-center gap-2 text-sm font-semibold", done ? "text-muted-foreground line-through" : "text-foreground")}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {s.title}
                  </p>
                  {!done && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>}
                </div>
                {!done && (
                  <Link
                    href={s.href}
                    prefetch={false}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90",
                      isCurrent ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
                    )}
                  >
                    {s.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
