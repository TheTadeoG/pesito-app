import type { ReactNode } from "react";
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

// Montos grandes se muestran en millones ("+$1.026" con la unidad "millones")
// en vez del número completo — para un total en miles de millones, sigue
// expresándose como millones (más legible que "1,025 mil M").
function formatAbbreviatedAmount(value: number): { value: string; unit?: string } {
  if (value >= 1_000_000) {
    return { value: `+$${numberFormatter.format(Math.round(value / 1_000_000))}`, unit: "millones" };
  }
  return { value: `+$${numberFormatter.format(roundToStep(value, 10_000))}` };
}

interface Tile {
  label: ReactNode;
  value: string;
  unit?: string;
}

export async function Stats() {
  const stats = await getLandingStats();

  const tiles: Tile[] = (
    [
      stats.kioscos > 0 && {
        label: "Negocios usando Pesito",
        value: `+${numberFormatter.format(stats.kioscos)}`,
      },
      stats.ventas > 0 && {
        label: "Ventas registradas",
        value: formatRoundedCount(stats.ventas),
      },
      stats.monto > 0 && {
        label: (
          <>
            <span className="font-bold text-success">Pesitos</span> procesados
          </>
        ),
        ...formatAbbreviatedAmount(stats.monto),
      },
    ] as (Tile | false)[]
  ).filter((t): t is Tile => Boolean(t));

  // Sin datos reales ni offset cargado: mejor no mostrar nada que un
  // "+0" poco creíble — mismo criterio que Testimonials sin reseñas.
  if (tiles.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid divide-y divide-border sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
        {tiles.map((tile) => (
          <div
            key={tile.value}
            className="py-5 first:pt-0 last:pb-0 sm:px-8 sm:py-1 sm:first:pl-0 sm:last:pr-0"
          >
            <p className="text-4xl font-extrabold tracking-[-0.035em] tabular-nums text-foreground sm:text-5xl">
              <span className="text-primary">{tile.value.charAt(0)}</span>
              {tile.value.slice(1)}
              {tile.unit && (
                <span className="ml-1.5 text-xl font-bold tracking-normal sm:text-2xl">{tile.unit}</span>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
