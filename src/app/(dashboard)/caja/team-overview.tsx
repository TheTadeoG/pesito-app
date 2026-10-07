import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getCashReminder } from "@/lib/cash-reminder";
import type { Plan } from "@/lib/subscription";

export interface OpenRegisterRow {
  id: string;
  userLabel: string;
  openedAt: string;
  openingAmount: number;
  cashOnHand: number;
  /** Sucursal de la caja (sólo si el negocio tiene más de una). */
  branchName?: string | null;
}

export interface RecurringDiscrepancyRow {
  userId: string;
  userLabel: string;
  faltanteCount: number;
  consideredCount: number;
  totalFaltante: number;
}

function Line({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">{title}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground">
        {children}
      </div>
      {action && (
        <Link
          href={action.href}
          prefetch={false}
          className="ml-auto flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {action.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Lo de afuera de la caja propia, en tres líneas: el equipo, el fiado y los
 * proveedores. El detalle de cada uno vive en Clientes y Proveedores; acá
 * sólo el total y, si lo hay, el aviso de algo urgente.
 */
export function CajaResumen({
  others,
  closeTime,
  fiado,
  proveedores,
  supplierPlan,
  ownOpen,
  filteredBranchName = null,
}: {
  /** Sucursal filtrada (si hay): cambia el texto cuando no hay cajas para mostrar. */
  filteredBranchName?: string | null;
  /** La caja propia está abierta (para decir "solo vos" sólo si es cierto). */
  ownOpen: boolean;
  /** Cajas abiertas de otras personas. */
  others: OpenRegisterRow[];
  closeTime: string | null;
  fiado: { total: number; count: number };
  /** null: el plan no incluye cuentas con proveedores. */
  proveedores: { total: number; count: number; overdueSuppliers: number } | null;
  supplierPlan: Plan;
}) {
  return (
    <Card>
      <CardContent className="divide-y divide-border py-1">
        <Line title="Equipo" action={others.length > 0 ? { href: "/usuarios", label: "Mi equipo" } : undefined}>
          {others.length === 0 ? (
            <span>
              {filteredBranchName
                ? `No hay cajas abiertas en ${filteredBranchName}`
                : ownOpen
                  ? "Solo vos tenés caja abierta"
                  : "No hay ninguna caja abierta"}
            </span>
          ) : (
            <div className="w-full space-y-2">
              {others.map((row) => {
                const reminder = getCashReminder(row.openedAt, closeTime);
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.userLabel}</span>
                      {row.branchName && <Badge tone="default">{row.branchName}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        desde el {formatDateTime(row.openedAt)}
                      </span>
                      {reminder?.kind === "stale" && <Badge tone="danger">Abierta desde otro día</Badge>}
                      {reminder?.kind === "closing" && <Badge tone="warning">Pasó la hora de cierre</Badge>}
                    </span>
                    <span className="text-sm">
                      <span className="text-muted-foreground">En caja </span>
                      <b>{formatCurrency(row.cashOnHand)}</b>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Line>

        <Line title="Fiado" action={{ href: "/clientes", label: "Ver clientes" }}>
          {fiado.count === 0 ? (
            <span className="text-muted-foreground">Nadie te debe</span>
          ) : (
            <span>
              Te deben <b>{formatCurrency(fiado.total)}</b>
              <span className="text-muted-foreground">{` · ${fiado.count} ${fiado.count === 1 ? "cliente" : "clientes"}`}</span>
            </span>
          )}
        </Line>

        {proveedores ? (
          <Line title="Proveedores" action={{ href: "/proveedores", label: "Ver proveedores" }}>
            {proveedores.count === 0 ? (
              <span className="text-muted-foreground">No le debés a ningún proveedor</span>
            ) : (
              <>
                <span>
                  Debés <b>{formatCurrency(proveedores.total)}</b>
                  <span className="text-muted-foreground">{` · ${proveedores.count} ${proveedores.count === 1 ? "proveedor" : "proveedores"}`}</span>
                </span>
                {proveedores.overdueSuppliers > 0 && (
                  <Badge tone="danger">
                    {proveedores.overdueSuppliers === 1
                      ? "1 con deuda vencida"
                      : `${proveedores.overdueSuppliers} con deuda vencida`}
                  </Badge>
                )}
              </>
            )}
          </Line>
        ) : (
          <div className="py-3">
            <PlanLockNote plan={supplierPlan}>
              Con el Plan Esencial ves cuánto le debés a cada proveedor, con compras a cuenta y pagos
              parciales.
            </PlanLockNote>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Un faltante suelto pasa — el problema es cuando se repite. Se muestra sólo a
// owner/admin (ver caja/page.tsx) y sólo cuando hay algo para decir, para no
// señalar a nadie frente al resto del personal ni llenar la pantalla de "nada".
export function FaltantesAviso({ rows }: { rows: RecurringDiscrepancyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.userId}
          className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="h-[18px] w-[18px] shrink-0" />
          <span>
            <b>{row.userLabel}</b>
            {` cerró con faltante en ${row.faltanteCount} de sus últimos ${row.consideredCount} cierres (− ${formatCurrency(row.totalFaltante)} en total).`}
          </span>
        </div>
      ))}
    </div>
  );
}
