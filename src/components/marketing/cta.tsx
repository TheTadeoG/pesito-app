import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="flex flex-col items-center gap-6 rounded-card bg-primary px-6 py-14 text-center text-primary-foreground sm:px-14">
        <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Dejá el cuaderno. Pasate a Pesito hoy.
        </h2>
        <p className="max-w-md text-primary-foreground/85">
          Registrate gratis y empezá a vender con tu kiosco organizado desde
          el primer día.
        </p>
        <Link href="/registro">
          <Button size="lg" variant="onColor">
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
