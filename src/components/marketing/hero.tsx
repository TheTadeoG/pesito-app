import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPanel } from "@/components/marketing/hero-panel";
import { AnchorLink } from "@/components/marketing/anchor-link";

const trust = ["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"];

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(var(--color-border)_1px,transparent_1.2px)] [background-size:18px_18px] [mask-image:linear-gradient(#000_40%,transparent)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Punto de venta para tu negocio
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
            Cobrás, y todo lo demás <span className="text-primary">se hace solo</span>
          </h1>

          <p
            className="fx-up mx-auto mt-6 max-w-md text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Stock, caja y fiado se actualizan con cada venta. Empezás gratis, sin tarjeta.
          </p>

          <div
            className="fx-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
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

          <div
            className="fx-up mt-10 w-full max-w-4xl lg:max-h-[35rem] lg:overflow-hidden lg:[mask-image:linear-gradient(#000_84%,transparent)]"
            style={{ animationDelay: "240ms" }}
          >
            <HeroPanel />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Datos de ejemplo, no de un negocio real.</p>
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
