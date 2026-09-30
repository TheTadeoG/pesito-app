import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { AnchorLink } from "@/components/marketing/anchor-link";

const trust = ["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"];

function Rows({ items }: { items: [string, string][] }) {
  return (
    <ul>
      {items.map(([a, b]) => (
        <li key={a} className="flex justify-between border-b border-border py-1 last:border-0">
          <span>{a}</span>
          <span className="font-semibold tabular-nums">{b}</span>
        </li>
      ))}
    </ul>
  );
}

// Mostrador (compu) y celular con las ventas en vivo: explica que se cobra
// en un lado y se controla desde otro. Datos de ejemplo.
function Devices() {
  return (
    <div className="relative pb-6">
      <div className="w-[63%] rounded-t-2xl rounded-b-md border-[6px] border-foreground! bg-card p-3 text-card-foreground shadow-2xl shadow-black/30">
        <Rows items={[["Gaseosa cola 1.5L", "$2.200"], ["Alfajor triple x2", "$1.800"], ["Chicles menta", "$500"]]} />
        <div className="mt-2 flex items-baseline justify-between text-sm text-muted-foreground">
          <span>Total</span>
          <b className="text-xl text-foreground">$4.500</b>
        </div>
        <div className="mt-2 rounded-lg bg-primary py-2 text-center text-sm font-bold text-primary-foreground">
          Cobrar venta
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-[38%] rounded-3xl border-[5px] border-foreground! bg-card p-3 text-card-foreground shadow-2xl shadow-black/40">
        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success">
          <i className="h-1.5 w-1.5 rounded-full bg-success" />
          En vivo
        </span>
        <p className="text-[10.5px] text-muted-foreground">Ventas de hoy</p>
        <p className="text-2xl font-extrabold tabular-nums tracking-tight">$284.500</p>
        <div className="mt-1 text-[11px]">
          <Rows items={[["Efectivo", "$164k"], ["Tarjeta", "$77k"], ["Transf.", "$43k"]]} />
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-hero text-hero-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,var(--hero-glow),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-hero-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Funciona en el navegador, sin instalar nada
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
              Cobrá en el mostrador. <span className="text-hero-accent">Controlá desde donde estés.</span>
            </h1>

            <p
              className="fx-up mt-6 max-w-md text-lg leading-relaxed text-hero-muted"
              style={{ animationDelay: "80ms" }}
            >
              Vendés desde la compu o la tablet y mirás las ventas del día en tu celular. Stock y caja
              siempre al día.
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

          <div className="fx-up" style={{ animationDelay: "240ms" }}>
            <Devices />
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
