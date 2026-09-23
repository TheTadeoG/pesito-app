import { AlertCircle, ArrowDownRight, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Números de ejemplo, no datos reales de ningún negocio — se aclara abajo.
// Coherentes entre sí (ganancia = ventas - costo) para que se sienta un
// panel real, no una lista de números sueltos.
const summary = [
  { label: "Ventas de hoy", value: 284500, icon: TrendingUp, tone: "text-foreground" },
  { label: "Costo de lo vendido", value: 171200, icon: ArrowDownRight, tone: "text-danger" },
  { label: "Ganancia", value: 113300, icon: ArrowUpRight, tone: "text-success" },
];

const topProducts = [
  { name: "Coca-Cola 2.25L", quantity: 18 },
  { name: "Pan lactal", quantity: 14 },
  { name: "Alfajor triple", quantity: 12 },
  { name: "Cigarrillos 20u", quantity: 9 },
];

const topDebtors = [
  { name: "Fernando R.", amount: 8200 },
  { name: "Lucía M.", amount: 5400 },
  { name: "Roberto G.", amount: 3150 },
];

export function DashboardPreview() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Así ves tu negocio todos los días
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Cuánto vendiste, cuánto ganaste y quién te debe — sin tener que sumarlo vos a mano.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-card border border-border bg-card shadow-lg shadow-black/5">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {summary.map((tile) => (
            <div key={tile.label} className="flex items-center gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <tile.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
                <p className={`truncate text-lg font-bold ${tile.tone}`}>
                  {formatCurrency(tile.value)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-0 border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
          <div className="p-5">
            <p className="text-sm font-semibold text-foreground">Productos más vendidos</p>
            <ul className="mt-3 space-y-2.5">
              {topProducts.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.quantity} u.</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-warning" />
              Clientes que más deben
            </p>
            <ul className="mt-3 space-y-2.5">
              {topDebtors.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <span className="font-medium text-warning">{formatCurrency(c.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        Números de ejemplo, no de un negocio real — así se ve tu propio panel una vez que cargás
        tus ventas.
      </p>
    </section>
  );
}
