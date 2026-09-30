import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { AnchorLink } from "@/components/marketing/anchor-link";

const trust = ["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"];

// De la libreta al sistema: cada garabato de cuaderno aparece al lado con lo
// que hace Pesito. Explica qué es sin listar funciones. Datos de ejemplo.
function Note({ children, tilt }: { children: ReactNode; tilt: string }) {
  return (
    <div
      className={cn(
        "rounded bg-[#f4ecc8] px-3 py-2 font-[cursive] text-sm leading-snug text-[#4a3f14] shadow-md shadow-black/20",
        tilt
      )}
    >
      {children}
    </div>
  );
}

function Result({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] text-card-foreground shadow-lg shadow-black/10">
      <span className="min-w-0">{left}</span>
      <span className="shrink-0">{right}</span>
    </div>
  );
}

function Tag({ tone, children }: { tone: "ok" | "bad" | "warn"; children: ReactNode }) {
  const c = {
    ok: "bg-success-bg text-success",
    bad: "bg-danger-bg text-danger",
    warn: "bg-warning-bg text-warning",
  }[tone];
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", c)}>{children}</span>;
}

const notebookRows: { note: ReactNode; result: ReactNode }[] = [
  {
    note: (
      <>
        Carlos debe 9800, <s className="opacity-60">Diego 6300</s> 5300?
      </>
    ),
    result: (
      <Result
        left="Carlos R. · hace 12 días"
        right={
          <>
            <b className="tabular-nums">$9.800</b> <Tag tone="bad">Atrasado</Tag>
          </>
        }
      />
    ),
  },
  { note: "¿Cuánto vendí hoy??", result: <Result left="Ventas de hoy" right={<b className="tabular-nums">$284.500</b>} /> },
  { note: "Pedir aceite, arroz, leche…", result: <Result left="Pedido armado" right={<Tag tone="ok">Listo para enviar</Tag>} /> },
  { note: "Caja: falta plata??", result: <Result left="Caja de Lucas" right={<Tag tone="warn">Faltan $500</Tag>} /> },
];

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-hero text-hero-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,var(--hero-glow),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
              Lo que hoy anotás en el cuaderno, <span className="text-hero-accent">lo hace Pesito</span>
            </h1>

            <p
              className="fx-up mt-6 max-w-md text-lg leading-relaxed text-hero-muted"
              style={{ animationDelay: "80ms" }}
            >
              Quién te debe, cuánto vendiste, qué pedir, si la caja cuadra. Todo ordenado, sin sumar a
              mano.
            </p>

            <div
              className="fx-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "150ms" }}
            >
              <Link href="/registro">
                <Button size="lg" variant="primary" className="w-full font-bold sm:w-auto">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <AnchorLink href="#como-funciona">
                <Button size="lg" variant="heroGhost" className="w-full sm:w-auto">
                  Ver cómo funciona
                </Button>
              </AnchorLink>
            </div>
          </div>

          <div className="fx-up flex flex-col gap-2.5" style={{ animationDelay: "240ms" }}>
            <div className="hidden grid-cols-[1fr_1.75rem_1.25fr] gap-x-2 text-[11px] font-bold uppercase tracking-widest text-hero-muted sm:grid">
              <span>Hoy</span>
              <span />
              <span>Con Pesito</span>
            </div>
            {notebookRows.map((r, i) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1.75rem_1.25fr]">
                <Note tilt={i % 2 ? "rotate-1" : "-rotate-1"}>{r.note}</Note>
                <span aria-hidden className="hidden text-center text-lg font-extrabold text-hero-accent sm:block">
                  →
                </span>
                {r.result}
              </div>
            ))}
            <p className="mt-1 text-center text-xs text-hero-muted">Datos de ejemplo, no de un negocio real.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-medium text-foreground">
          {trust.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden className="font-extrabold text-primary">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center">
          <AnchorLink
            href="#precios"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver qué incluye cada plan →
          </AnchorLink>
        </p>
      </div>
    </>
  );
}
