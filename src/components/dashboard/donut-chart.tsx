// Paleta categórica validada con el script de la skill de dataviz (chroma
// floor + separación CVD) contra las superficies reales de la app, claro y
// oscuro — el slot 6 gris (#64748b) no pasaba el piso de chroma.
const PALETTE = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#a16207"];

export interface DonutSlice {
  label: string;
  value: number;
}

interface DonutChartProps {
  data: DonutSlice[];
  formatValue: (value: number) => string;
}

export function DonutChart({ data, formatValue }: DonutChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce<{ label: string; dash: number; dashOffset: number }[]>(
    (acc, slice) => {
      const fraction = total > 0 ? slice.value / total : 0;
      const dash = fraction * circumference;
      const offsetSoFar = acc.length > 0 ? acc[acc.length - 1].dashOffset - acc[acc.length - 1].dash : 0;
      acc.push({ label: slice.label, dash, dashOffset: offsetSoFar });
      return acc;
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg width="150" height="150" viewBox="0 0 160 160" className="-rotate-90 shrink-0">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth="20" />
        {segments.map((segment, i) => (
          <circle
            key={segment.label}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="20"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={segment.dashOffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="w-full space-y-2">
        {data.map((slice, i) => (
          <div key={slice.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate text-foreground">{slice.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {formatValue(slice.value)} · {total > 0 ? ((slice.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
