import Link from "next/link";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosMockup } from "@/components/marketing/pos-mockup";
import { AnchorLink } from "@/components/marketing/anchor-link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[32rem] bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.primary/12%),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-24">
        <div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            El sistema para manejar tu negocio sin dolores de cabeza
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Cobrá más rápido, controlá tu stock, tu caja y el fiado desde una
            sola pantalla. Empezás gratis —sin tarjeta y sin vencimiento— y
            elegís un plan recién cuando tu negocio crece.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/registro">
              <Button size="lg" className="w-full sm:w-auto">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <AnchorLink href="#como-funciona">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <PlayCircle className="h-4 w-4" />
                Ver cómo funciona
              </Button>
            </AnchorLink>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"].map(
              (item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" />
                  {item}
                </li>
              )
            )}
          </ul>
          <AnchorLink
            href="#precios"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ver qué incluye cada plan →
          </AnchorLink>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-transparent blur-2xl"
          />
          <PosMockup />
        </div>
      </div>
    </section>
  );
}
