import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosMockup } from "@/components/marketing/pos-mockup";
import { AnchorLink } from "@/components/marketing/anchor-link";

const trust = ["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"];

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-deep text-deep-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,rgb(52_211_153/0.16),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.6rem] xl:text-6xl">
              El sistema para manejar tu negocio{" "}
              <span className="text-lime">sin dolores de cabeza</span>
            </h1>

            <p
              className="fx-up mt-6 max-w-md text-lg leading-relaxed text-deep-muted"
              style={{ animationDelay: "80ms" }}
            >
              Cobrá más rápido y controlá stock, caja y fiado desde una sola pantalla. Empezás
              gratis, sin tarjeta.
            </p>

            <div
              className="fx-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "150ms" }}
            >
              <Link href="/registro">
                <Button size="lg" variant="lime" className="w-full font-bold sm:w-auto">
                  Empezar gratis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <AnchorLink href="#como-funciona">
                <Button size="lg" variant="onDark" className="w-full sm:w-auto">
                  Ver cómo funciona
                </Button>
              </AnchorLink>
            </div>
          </div>

          <div
            className="fx-up relative mx-auto w-full max-w-md lg:max-w-none"
            style={{ animationDelay: "240ms" }}
          >
            <PosMockup />
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
