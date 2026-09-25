import Link from "next/link";
import { AlertCircle, AlertTriangle, HandCoins, LockOpen, Users } from "lucide-react";
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

export interface CreditorRow {
  id: string;
  name: string;
  balance: number;
}

export interface RecurringDiscrepancyRow {
  userId: string;
  userLabel: string;
  faltanteCount: number;
  consideredCount: number;
  totalFaltante: number;
}

// Un faltante suelto pasa — el problema es cuando se repite. Se muestra
// sólo a owner/admin (ver caja/page.tsx), igual que el resto de esta
// vista de equipo, para no señalar a nadie frente al resto del personal.
export function RecurringDiscrepanciesOverview({ rows }: { rows: RecurringDiscrepancyRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-danger" />
          Faltantes recurrentes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nadie tiene faltantes seguidos en sus últimos cierres.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.userId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.userLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.faltanteCount} de sus últimos {row.consideredCount} cierres tuvieron
                    faltante
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-danger">
                  -{formatCurrency(row.totalFaltante)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
                prefetch={false}
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

export function CuentasPorPagarOverview({
  totalDebt,
  creditors,
}: {
  totalDebt: number;
  creditors: CreditorRow[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="h-4 w-4" />
          Cuentas por pagar a proveedores
        </CardTitle>
        <Badge tone={totalDebt > 0 ? "warning" : "default"}>
          Total: {formatCurrency(totalDebt)}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {creditors.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No le debés saldo a ningún proveedor.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {creditors.map((creditor) => (
              <Link
                key={creditor.id}
                href="/proveedores"
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted"
              >
                <span className="truncate font-medium text-foreground">{creditor.name}</span>
                <span className="shrink-0 font-semibold text-warning">
                  {formatCurrency(creditor.balance)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
