import { formatCurrency } from "@/lib/utils";

export interface BarChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  showValueLabels?: boolean;
  labelEvery?: number;
  formatValue?: (value: number) => string;
}

export function BarChart({
  data,
  showValueLabels = true,
  labelEvery = 1,
  formatValue = formatCurrency,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-40 items-stretch justify-between gap-1">
      {data.map((d, i) => {
        // Escala raíz cuadrada en vez de lineal: con picos muy grandes (ej. un
        // día con $128.000 contra días de $5.000), una escala lineal aplasta
        // todo lo demás a la altura mínima y el gráfico parece "saltar" sólo
        // en esos picos. La raíz cuadrada conserva el orden pero achica la
        // distancia relativa entre valores chicos y grandes.
        const heightPct = d.value > 0 ? Math.max(6, Math.sqrt(d.value / max) * 100) : 0;
        return (
          <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            {showValueLabels && (
              <span className="text-[10px] font-medium text-muted-foreground">
                {d.value > 0 ? formatValue(d.value) : ""}
              </span>
            )}
            <div className="flex w-full flex-1 items-end border-b border-border">
              {d.value > 0 && (
                <div
                  className="w-full rounded-t-md bg-primary/80"
                  style={{ height: `${heightPct}%` }}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {i % labelEvery === 0 ? d.label : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
