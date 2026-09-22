import Link from "next/link";
import { AlertCircle, LockOpen, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface OpenRegisterRow {
  id: string;
  userLabel: string;
  openedAt: string;
  openingAmount: number;
  cashOnHand: number;
}

export interface DebtorRow {
  id: string;
  name: string;
  balance: number;
}

export function TeamCajasOverview({ rows }: { rows: OpenRegisterRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Cajas abiertas del equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No hay ninguna caja abierta en este momento.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-bg text-success">
                  <LockOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{row.userLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Abierta el {formatDateTime(row.openedAt)} · Inicial:{" "}
                    {formatCurrency(row.openingAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Efectivo disponible</p>
                  <p className="font-semibold text-foreground">{formatCurrency(row.cashOnHand)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DeudasFiadoOverview({
  totalDebt,
  debtors,
}: {
  totalDebt: number;
  debtors: DebtorRow[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4" />
          Deudas en fiado
        </CardTitle>
        <Badge tone={totalDebt > 0 ? "warning" : "default"}>
          Total: {formatCurrency(totalDebt)}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {debtors.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Ningún cliente tiene saldo pendiente.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {debtors.map((debtor) => (
              <Link
                key={debtor.id}
                href={`/clientes/${debtor.id}`}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted"
              >
                <span className="truncate font-medium text-foreground">{debtor.name}</span>
                <span className="shrink-0 font-semibold text-warning">
                  {formatCurrency(debtor.balance)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
