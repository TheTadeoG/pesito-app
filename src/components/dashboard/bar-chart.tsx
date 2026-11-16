import { cn, formatCurrency } from "@/lib/utils";

export interface BarChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  showValueLabels?: boolean;
  labelEvery?: number;
  formatValue?: (value: number) => string;
  /** Texto del cartel cuando una barra vale 0 (por defecto «Sin ventas»). */
  emptyLabel?: string;
  /** Alto del área del gráfico (clase de Tailwind). */
  heightClass?: string;
}

/** Valor del eje en corto: 12 mil, 1,2 M. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

/** Tope "redondo" del eje (1, 2, 4, 5, 6, 8, 10 × potencia de 10), par si los datos son enteros para que la mitad también lo sea. */
function niceMax(max: number, integers: boolean): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(max, 1e-9)));
  const nice = [1, 2, 4, 5, 6, 8, 10].map((m) => m * pow).find((c) => c >= max) ?? max;
  return integers && nice % 2 !== 0 ? nice + 1 : nice;
}

/**
 * Gráfico de barras: eje con valores, líneas guía, barras con degradé y el cartel de cada una al pasar el mouse. La barra
 * más alta lleva su valor arriba (y todas, si son pocas). Escala lineal: la altura es proporcional al valor.
 */
export function BarChart({
  data,
  showValueLabels = true,
  labelEvery = 1,
  formatValue = formatCurrency,
  emptyLabel = "Sin ventas",
  heightClass = "h-52",
}: BarChartProps) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const integers = data.every((d) => Number.isInteger(d.value));
  const top = niceMax(Math.max(max, 1), integers);
  const isMoney = formatValue === formatCurrency;
  const axis = (n: number) => `${isMoney && n > 0 ? "$ " : ""}${compact(n)}`;
  const ticks = [top, top / 2, 0];
  const maxIndex = data.findIndex((d) => d.value === max);
  const everyBar = showValueLabels && data.length <= 12;

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex gap-3", heightClass)}>
        <div className="flex w-12 shrink-0 flex-col justify-between text-right text-[11px] leading-none text-muted-foreground" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="tabular-nums">{axis(t)}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Líneas guía: arriba, a la mitad y la base. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            <div className="border-t border-dashed border-border" />
            <div className="border-t border-dashed border-border/70" />
            <div className="border-t border-border" />
          </div>

          <div className="absolute inset-0 flex items-stretch justify-between gap-[3px] sm:gap-1">
            {data.map((d, i) => {
              const pct = d.value > 0 ? Math.max(3, (d.value / top) * 100) : 0;
              const showValue = d.value > 0 && showValueLabels && (everyBar || i === maxIndex);
              return (
                <div key={`${d.label}-${i}`} className="group relative flex min-w-0 flex-1 items-end justify-center">
                  {d.value > 0 ? (
                    <div
                      className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary/60 to-primary transition-[filter] duration-150 group-hover:brightness-110"
                      style={{ height: `${pct}%` }}
                    />
                  ) : (
                    <div className="mb-px h-[3px] w-full max-w-[44px] rounded-full bg-muted-foreground/25" />
                  )}
                  {showValue && (
                    <span
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-foreground"
                      style={{ bottom: `calc(${pct}% + 4px)` }}
                    >
                      {isMoney ? `$ ${compact(d.value)}` : compact(d.value)}
                    </span>
                  )}
                  {/* Cartel al pasar el mouse, con la fecha y el valor exactos. */}
                  <div
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                    style={{ bottom: `calc(${pct}% + ${showValue ? 24 : 8}px)` }}
                  >
                    <span className="opacity-75">{d.label}</span> · <b>{d.value > 0 ? formatValue(d.value) : emptyLabel}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fechas: una cada `labelEvery`, centradas bajo su barra y sin partirse en dos renglones. */}
      <div className="flex gap-3" aria-hidden="true">
        <div className="w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 justify-between gap-[3px] sm:gap-1">
          {data.map((d, i) => (
            <div key={`${d.label}-${i}`} className="relative h-4 min-w-0 flex-1">
              {i % labelEvery === 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">{d.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
