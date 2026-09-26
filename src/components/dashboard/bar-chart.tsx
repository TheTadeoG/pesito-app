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
}

export function BarChart({
  data,
  showValueLabels = true,
  labelEvery = 1,
  formatValue = formatCurrency,
}: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // Con muchas barras no entra el monto arriba de cada una (se pisaban,
  // p. ej. 30 días en /admin): queda sólo en el cartel al pasar el mouse.
  const valueLabels = showValueLabels && data.length <= 14;

  return (
    <div className="flex h-44 items-stretch justify-between gap-1">
      {data.map((d, i) => {
        // Escala raíz cuadrada en vez de lineal: con picos muy grandes (ej. un
        // día con $128.000 contra días de $5.000), una escala lineal aplasta
        // todo lo demás a la altura mínima y el gráfico parece "saltar" sólo
        // en esos picos. La raíz cuadrada conserva el orden pero achica la
        // distancia relativa entre valores chicos y grandes.
        const heightPct = d.value > 0 ? Math.max(6, Math.sqrt(d.value / max) * 100) : 0;
        return (
          <div
            key={`${d.label}-${i}`}
            // min-w-0 es lo que evita que este item se salga del contenedor:
            // por default un flex item no encoge por debajo del ancho de su
            // contenido (el texto de la fecha), así que con 30+ columnas la
            // fila entera terminaba desbordando la tarjeta y las barras
            // quedaban corridas respecto de las fechas del eje.
            className="group relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            {/* Tooltip al pasar el mouse: reemplaza la vieja regla de mostrar
                la fecha de cualquier día con venta aunque no le tocara turno
                en labelEvery — eso amontonaba etiquetas cuando esos días
                quedaban seguidos (ej. las ventas recién arrancando, todas
                sobre el final del período). Ahora el eje respeta un espaciado
                parejo y el detalle exacto de cada barra vive en el hover. */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {d.label} · {d.value > 0 ? formatValue(d.value) : "Sin ventas"}
            </div>
            {valueLabels && (
              <span className="text-[10px] font-medium text-muted-foreground">
                {d.value > 0 ? formatValue(d.value) : ""}
              </span>
            )}
            <div className="flex w-full flex-1 items-end border-b border-border">
              {d.value > 0 ? (
                <div
                  className="w-full rounded-t-md bg-primary transition-colors group-hover:bg-primary-hover"
                  style={{ height: `${heightPct}%` }}
                />
              ) : (
                // Sin esto, un día en $0 no dibuja nada — en un período con
                // varios días así (recién arrancando, o un rango largo con
                // poca actividad) el gráfico se lee como roto/vacío en vez
                // de "estos días no hubo ventas". Una marca plana lo aclara.
                <div className="h-1 w-full rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-muted-foreground/50" />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] text-muted-foreground",
                i % labelEvery !== 0 && "invisible"
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
