import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="relative overflow-hidden bg-deep text-deep-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_90%_100%,rgb(52_211_153/0.18),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <h2 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
          Dejá el cuaderno. <span className="text-lime">Pasate a Pesito hoy.</span>
        </h2>
        <p className="mt-6 max-w-md text-lg text-deep-muted">
          Registrate gratis y empezá a vender con tu negocio organizado desde el primer día.
        </p>
        <Link href="/registro" className="mt-9 inline-block">
          <Button size="lg" variant="lime" className="font-bold">
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
