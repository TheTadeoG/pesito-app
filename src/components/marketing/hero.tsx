import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/marketing/wordmark";
import { cn } from "@/lib/utils";
import { AnchorLink } from "@/components/marketing/anchor-link";

const trust = ["Plan Gratis para siempre", "Sin tarjeta", "14 días de Plan Pro de regalo"];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

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

// El panel de Pesito con datos de ejemplo: la portada muestra el sistema en
// vez de un carrito suelto, así se entiende qué es de un vistazo.
function AppWindow() {
  const nav = ["Vender", "Productos", "Caja", "Clientes", "Proveedores", "Reportes"];
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-background text-left text-xs text-foreground shadow-2xl shadow-black/20 sm:grid-cols-[8.25rem_1fr]">
      <div className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3 sm:flex">
        <Wordmark className="mx-1.5 text-lg" />
        <p className="mx-1.5 mb-2 border-b border-border pb-2 text-[11px] text-muted-foreground">
          Kiosco Don Pepe
        </p>
        {nav.map((n, i) => (
          <span
            key={n}
            className={cn(
              "rounded-md px-2 py-1.5 font-medium",
              i === 5 ? "bg-sidebar-active-bg font-bold text-sidebar-active-foreground" : "text-sidebar-foreground"
            )}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 p-3.5">
        <p className="text-sm font-bold">Resumen de hoy</p>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Ventas" value="$284.500" />
          <Kpi label="Ganancia" value="$113.300" />
          <Kpi label="Te deben" value="$19.450" />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Ventas de la semana</p>
            <div className="mt-2 flex h-16 items-end gap-1.5">
              {[36, 48, 44, 62, 78, 100, 58].map((h, i) => (
                <i
                  key={i}
                  style={{ height: `${h}%` }}
                  className={cn("flex-1 rounded-t-sm", i === 5 ? "bg-primary" : "bg-accent")}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Alertas de stock</p>
            <Rows items={[["Coca-Cola 2.25L", "Sin stock"], ["Pan lactal", "Bajo"], ["Detergente", "Bajo"]]} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(var(--color-border)_1px,transparent_1.2px)] [background-size:18px_18px] [mask-image:linear-gradient(#000_40%,transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Sistema de ventas, stock y caja
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
              Tu negocio entero, en <span className="text-primary">una sola pantalla</span>
            </h1>

            <p
              className="fx-up mt-6 max-w-md text-lg leading-relaxed text-muted-foreground"
              style={{ animationDelay: "80ms" }}
            >
              Cobrá, controlá el stock, cerrá la caja y anotá el fiado. Todo se actualiza solo con cada
              venta.
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

          <div
            className="fx-up relative mx-auto w-full max-w-xl lg:max-w-none"
            style={{ animationDelay: "240ms" }}
          >
            <AppWindow />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Datos de ejemplo, no de un negocio real.
            </p>
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
