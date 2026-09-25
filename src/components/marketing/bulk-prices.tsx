import { ArrowRight, Check, TrendingUp } from "lucide-react";

// El aumento masivo por proveedor o marca (Productos → "Aumentar precios" /
// "Aumentar costos") está en todos los planes. Los números del ejemplo son
// ilustrativos.
const points = [
  "Por proveedor o por marca, en un solo paso",
  "En porcentaje o con un monto fijo",
  "Sobre el precio de venta o sobre el costo",
  "Los cambios de precio quedan en el historial de cada producto",
];

const exampleRows = [
  { name: "Galletitas surtidas 300 g", before: 1850, after: 2090 },
  { name: "Alfajor triple", before: 1200, after: 1356 },
  { name: "Gaseosa cola 2,25 L", before: 3400, after: 3842 },
];

const ars = (n: number) => `$${n.toLocaleString("es-AR")}`;

export function BulkPrices() {
  return (
    <section className="bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Lo que otros sistemas no te resuelven
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            ¿Te aumentó el proveedor? Actualizás todo en segundos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Elegís el proveedor o la marca, ponés el porcentaje y Pesito actualiza
            los precios o los costos de todos sus productos de una vez. Nada de
            cambiar uno por uno.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm font-medium text-foreground">
            Incluido en todos los planes, también en el gratis.
          </p>
        </div>

        <div className="rounded-card border border-border bg-card p-6 shadow-xl shadow-primary/5">
          <p className="text-sm font-semibold text-foreground">Aumentar precios</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border px-3.5 py-2.5">
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium text-foreground">Distribuidora Norte</p>
            </div>
            <div className="rounded-xl border border-border px-3.5 py-2.5">
              <p className="text-xs text-muted-foreground">Aumento</p>
              <p className="font-medium text-foreground">+13%</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {exampleRows.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="truncate text-foreground">{row.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-muted-foreground line-through">{ars(row.before)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{ars(row.after)}</span>
                </span>
              </div>
            ))}
            <div className="px-3.5 py-2.5 text-center text-xs text-muted-foreground">
              y 145 productos más
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">
            Aplicar a 148 productos
          </div>
        </div>
      </div>
    </section>
  );
}
