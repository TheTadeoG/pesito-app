import { Receipt, ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLandingStats } from "@/lib/landing-stats";

const numberFormatter = new Intl.NumberFormat("es-AR");

// Números reales, pero no hace falta mostrar el dígito exacto — un "+236.000"
// se lee mejor (y sigue siendo honesto) que un "+236.014". Si el redondeo
// da 0 con un valor real positivo, se muestra el escalón en vez de "+0".
function roundToStep(value: number, step: number) {
  if (value <= 0) return 0;
  const rounded = Math.round(value / step) * step;
  return rounded === 0 ? step : rounded;
}

function formatRoundedCount(value: number) {
  return `+${numberFormatter.format(roundToStep(value, 10_000))}`;
}

// Montos grandes se muestran abreviados en millones ("+1025M") en vez del
// número completo con todos los decimales — para un total en miles de
// millones, sigue expresándose como millones (más legible que "1,025 mil M").
function formatAbbreviatedAmount(value: number) {
  if (value >= 1_000_000) {
    return `+$${Math.round(value / 1_000_000)}M`;
  }
  return `+$${numberFormatter.format(roundToStep(value, 10_000))}`;
}

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
      label: "Comercios usando Pesito",
      value: `+${numberFormatter.format(stats.kioscos)}`,
      tone: "text-foreground",
    },
    stats.ventas > 0 && {
      icon: ShoppingBag,
      label: "Ventas registradas",
      value: formatRoundedCount(stats.ventas),
      tone: "text-foreground",
    },
    // Verde porque son pesitos — mismo criterio que "Ganancia" en el
    // mini-dashboard de más abajo (texto grande y en negrita, no la
    // palabra suelta en un renglón chico: ahí se pierde y confunde).
    stats.monto > 0 && {
      icon: Receipt,
      label: "Pesitos procesados",
      value: formatAbbreviatedAmount(stats.monto),
      tone: "text-success",
    },
  ].filter(
    (t): t is { icon: typeof Store; label: string; value: string; tone: string } => Boolean(t)
  );

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
              <p className={cn("truncate text-xl font-bold", tile.tone)}>{tile.value}</p>
              <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
