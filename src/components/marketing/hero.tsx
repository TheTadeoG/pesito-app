import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
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
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Hecho para kioscos y almacenes de barrio
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            El sistema para manejar tu kiosco sin dolores de cabeza
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Cobrá más rápido, controlá tu stock y llevá tu caja al día desde
            una sola pantalla. Pesito reemplaza el cuaderno, la calculadora y
            las planillas sueltas.
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

          <p className="mt-4 text-sm text-muted-foreground">
            Sin tarjeta de crédito · Configurás tu kiosco en minutos
          </p>
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
