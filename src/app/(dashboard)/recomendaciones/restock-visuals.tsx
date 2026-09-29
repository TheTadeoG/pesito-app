import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

// Piezas visuales de Recomendaciones: resumen de arriba, barra de días de
// stock y reparto del gasto por proveedor. Son sólo presentación.

const toneClass = {
  danger: "text-danger",
  warning: "text-warning",
  default: "text-foreground",
} as const;

export function RestockSummary({
  outOfStock,
  urgent,
  estimatedTotal,
  inTransit,
}: {
  outOfStock: number;
  urgent: number;
  estimatedTotal: number;
  inTransit: number;
}) {
  const tiles: { label: string; value: string; tone: keyof typeof toneClass; hint: string }[] = [
    {
      label: "Sin stock",
      value: String(outOfStock),
      tone: outOfStock > 0 ? "danger" : "default",
      hint: "productos en cero",
    },
    {
      label: "Urgentes",
      value: String(urgent),
      tone: urgent > 0 ? "warning" : "default",
      hint: "no llegan al próximo pedido",
    },
    {
      label: "Pedido estimado",
      value: estimatedTotal > 0 ? formatCurrency(estimatedTotal) : "—",
      tone: "default",
      hint: "todo lo sugerido, con costos cargados",
    },
    {
      label: "En camino",
      value: String(inTransit),
      tone: "default",
      hint: inTransit === 1 ? "pedido sin recibir" : "pedidos sin recibir",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className={cn("mt-0.5 truncate text-2xl font-bold", toneClass[tile.tone])}>{tile.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Barra de cuántos días alcanza el stock, contra los días que se quiere cubrir. */
export function DaysBar({
  daysLeft,
  targetDays,
  urgency,
}: {
  daysLeft: number | null;
  targetDays: number;
  urgency: "sin-stock" | "urgente" | "pronto";
}) {
  if (daysLeft === null) return null;
  const share = Math.max(0, Math.min(1, daysLeft / Math.max(1, targetDays)));
  const fill =
    urgency === "pronto" ? "bg-primary" : urgency === "urgente" ? "bg-amber-500" : "bg-danger";
  return (
    <div
      className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Alcanza ${Math.floor(daysLeft)} de ${targetDays} días`}
    >
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${Math.max(share * 100, urgency === "sin-stock" ? 0 : 4)}%` }}
      />
    </div>
  );
}

/** Cuánto se gastaría en cada proveedor con lo sugerido. */
export function SupplierSpendChart({ rows }: { rows: { name: string; cost: number }[] }) {
  const max = Math.max(...rows.map((r) => r.cost), 1);
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Cuánto se gastaría en cada proveedor</p>
          <p className="text-xs text-muted-foreground">Con lo sugerido abajo y los costos cargados.</p>
        </div>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-foreground">{row.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((row.cost / max) * 100, 3)}%` }}
                />
              </span>
              <span className="font-medium text-foreground">{formatCurrency(row.cost)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
