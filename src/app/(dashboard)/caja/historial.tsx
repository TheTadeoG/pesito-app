import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface CajaHistorialRow {
  id: string;
  userLabel: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number;
}

export function CajaHistorial({ rows }: { rows: CajaHistorialRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de caja</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no cerraste ninguna caja.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const diff = row.closingAmount - row.expectedAmount;
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{row.userLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(row.openedAt)} → {formatDateTime(row.closedAt)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Inicial: {formatCurrency(row.openingAmount)}</p>
                    <p>Contado: {formatCurrency(row.closingAmount)}</p>
                  </div>
                  {diff === 0 ? (
                    <Badge tone="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Sin diferencia
                    </Badge>
                  ) : (
                    <Badge tone={diff > 0 ? "success" : "danger"}>
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
