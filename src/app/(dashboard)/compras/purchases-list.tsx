import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface PurchaseRow {
  id: string;
  created_at: string;
  total: number;
  supplierName: string;
  itemsSummary: string;
  notes: string | null;
}

export function PurchasesList({ purchases }: { purchases: PurchaseRow[] }) {
  if (purchases.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Todavía no registraste ninguna compra.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {purchases.map((purchase) => (
        <div key={purchase.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{purchase.supplierName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {formatDateTime(purchase.created_at)} · {purchase.itemsSummary}
            </p>
            {purchase.notes && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{purchase.notes}</p>
            )}
          </div>
          <span className="font-semibold text-foreground">{formatCurrency(purchase.total)}</span>
        </div>
      ))}
    </div>
  );
}
