import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPanel } from "@/components/marketing/hero-panel";
import { HeroSides } from "@/components/marketing/hero-sides";
import { SaleProvider } from "@/components/marketing/hero-sale";
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
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
            El sistema para manejar tu negocio <span className="text-primary">sin dolores de cabeza</span>
          </h1>

          <p
            className="fx-up mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Cobrá y todo lo demás se hace solo: stock, caja y fiado se actualizan con cada venta.
          </p>

          <div
            className="fx-up mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center"
            style={{ animationDelay: "150ms" }}
          >
            <Link href="/registro">
              <Button size="lg" variant="primary" className="h-[54px] w-full px-8 text-[17px] font-bold sm:w-auto">
                Empezar gratis
                <ArrowRight className="h-[18px] w-[18px]" />
              </Button>
            </Link>
            <AnchorLink href="#funciones">
              <Button size="lg" variant="heroGhost" className="h-[54px] w-full px-8 text-[17px] sm:w-auto">
                Ver qué hace Pesito
              </Button>
            </AnchorLink>
          </div>

          <ul
            className="fx-up mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-sm font-medium text-muted-foreground"
            style={{ animationDelay: "190ms" }}
          >
            {trust.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span aria-hidden className="font-extrabold text-primary">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="fx-up mt-2" style={{ animationDelay: "210ms" }}>
            <AnchorLink href="#precios" className="text-sm font-medium text-primary hover:underline">
              Ver qué incluye cada plan →
            </AnchorLink>
          </p>

          <SaleProvider>
            <div className="relative mt-10 w-full max-w-4xl">
              <HeroSides />
              <div
                className="fx-up lg:max-h-[35rem] lg:overflow-hidden lg:[mask-image:linear-gradient(#000_84%,transparent)]"
                style={{ animationDelay: "240ms" }}
              >
                <HeroPanel />
              </div>
            </div>
          </SaleProvider>
          <p className="mt-2 text-xs text-muted-foreground">Tocá cualquier sección del menú para verla en acción. Datos de ejemplo, no de un negocio real.</p>
        </div>
      </section>
    </>
  );
}
