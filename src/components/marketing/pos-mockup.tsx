import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const items = [
  { name: "Gaseosa cola 1.5L", code: "7790001", price: 2200, stock: 4, qty: 1 },
  { name: "Alfajor triple", code: "7790002", price: 900, stock: 12, qty: 2 },
  { name: "Chicles menta", code: "7790003", price: 500, stock: 30, qty: 1 },
];

export function PosMockup() {
  const total = items.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-primary/10 sm:p-4">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Escaneá o buscá un producto…</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.code}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  ${item.price.toLocaleString("es-AR")}
                </span>
                {item.stock <= 5 && (
                  <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
                    Stock {item.stock}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground">
                <Minus className="h-3 w-3" />
              </span>
              <span className="w-4 text-center text-sm font-medium">{item.qty}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground">
                <Plus className="h-3 w-3" />
              </span>
              <span className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-xl font-bold text-foreground">
          ${total.toLocaleString("es-AR")}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">
        Cobrar venta
      </div>
    </div>
  );
}
