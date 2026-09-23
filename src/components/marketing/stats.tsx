import { Receipt, ShoppingBag, Store } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getLandingStats } from "@/lib/landing-stats";

const numberFormatter = new Intl.NumberFormat("es-AR");

// Tailwind necesita ver la clase completa en el código para generarla —
// de ahí el mapa en vez de armar `grid-cols-${n}` con un template string.
const gridColsByCount: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

export async function Stats() {
  const stats = await getLandingStats();

  const tiles = [
    stats.kioscos > 0 && {
      icon: Store,
      label: "Kioscos y almacenes usando Pesito",
      value: `+${numberFormatter.format(stats.kioscos)}`,
    },
    stats.ventas > 0 && {
      icon: ShoppingBag,
      label: "Ventas registradas",
      value: `+${numberFormatter.format(stats.ventas)}`,
    },
    stats.monto > 0 && {
      icon: Receipt,
      label: "Procesado con Pesito",
      value: formatCurrency(stats.monto),
    },
  ].filter((t): t is { icon: typeof Store; label: string; value: string } => Boolean(t));

  // Sin datos reales ni offset cargado: mejor no mostrar nada que un
  // "+0" poco creíble — mismo criterio que Testimonials sin reseñas.
  if (tiles.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div
        className={cn(
          "grid gap-4 rounded-card border border-border bg-card p-6",
          gridColsByCount[tiles.length]
        )}
      >
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <tile.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-foreground">{tile.value}</p>
              <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
