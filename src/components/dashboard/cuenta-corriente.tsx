"use client";

import type { ReactNode } from "react";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface CuentaCorrienteMovement {
  id: string;
  date: string;
  label: string;
  // Aumenta el saldo (lo que te deben o lo que le debés).
  cargo: number;
  // Reduce el saldo (un cobro o un pago).
  pago: number;
  /** Botón opcional al final de la fila (ej. anular un pago). */
  action?: ReactNode;
}

export function CuentaCorriente({
  movements,
  emptyLabel = "Todavía no hay movimientos de cuenta corriente.",
  oldestFirst = false,
  finalBalanceLabel,
  creditBalanceLabel,
  zeroBalanceLabel = "Sin deuda",
}: {
  movements: CuentaCorrienteMovement[];
  emptyLabel?: string;
  /**
   * Lo más viejo arriba y el saldo corriendo hacia abajo, cerrando con una
   * fila que marca el saldo actual (se lee como un extracto). Sin esto, lo
   * más nuevo va arriba.
   */
  oldestFirst?: boolean;
  /** Aclaración junto al saldo final (ej. "Le debés"). */
  finalBalanceLabel?: string;
  /** Aclaración cuando el saldo es negativo (ej. "A su favor"); si no se pasa, se usa finalBalanceLabel. */
  creditBalanceLabel?: string;
  /** Texto del cuadro de arriba cuando el saldo es cero (ej. "Sin deuda"). */
  zeroBalanceLabel?: string;
}) {
  const pager = usePagination(movements.length, String(movements.length), "pesito-cuenta-page-size");
  if (movements.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  const chronological = [...movements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const rows = chronological.reduce<(CuentaCorrienteMovement & { saldo: number })[]>(
    (acc, m) => {
      const previousSaldo = acc.length > 0 ? acc[acc.length - 1].saldo : 0;
      acc.push({ ...m, saldo: previousSaldo + m.cargo - m.pago });
      return acc;
    },
    []
  );
  const hasActions = movements.some((m) => m.action);
  const displayRows = oldestFirst ? rows : [...rows].reverse();
  const finalSaldo = rows[rows.length - 1].saldo;
  const settled = Math.abs(finalSaldo) < 0.005;
  const balanceLabel = finalSaldo < 0 ? (creditBalanceLabel ?? finalBalanceLabel) : finalBalanceLabel;
  const pageRows = displayRows.slice(pager.start, pager.end);
  // Lo viejo arriba y el saldo corriendo hacia abajo: en las páginas siguientes arranca con el saldo que
  // venía de la anterior, y la fila "Saldo actual" cierra la última página.
  const carried = oldestFirst && pager.start > 0 ? displayRows[pager.start - 1].saldo : null;
  const isLastPage = pager.end >= displayRows.length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border bg-accent/40 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo a la fecha</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(finalSaldo)}</p>
        </div>
        <p className={`text-sm font-semibold ${settled ? "text-success" : "text-warning"}`}>
          {settled ? zeroBalanceLabel : (balanceLabel ?? "")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="whitespace-nowrap px-5 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Operación</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Cargo</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Pago</th>
              <th className="whitespace-nowrap px-5 py-2.5 text-right">Saldo</th>
              {hasActions && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {carried !== null && (
              <tr className="bg-muted/40">
                <td colSpan={4} className="px-5 py-2 text-xs font-medium text-muted-foreground">
                  Viene de la página anterior
                </td>
                <td className="whitespace-nowrap px-5 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                  {formatCurrency(carried)}
                </td>
                {hasActions && <td />}
              </tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                  {formatDateTime(row.date)}
                </td>
                <td className="px-3 py-2.5 text-foreground">{row.label}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-warning">
                  {row.cargo > 0 ? formatCurrency(row.cargo) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-success">
                  {row.pago > 0 ? formatCurrency(row.pago) : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(row.saldo)}
                </td>
                {hasActions && <td className="whitespace-nowrap px-3 py-2.5 text-right">{row.action}</td>}
              </tr>
            ))}
          </tbody>
          {oldestFirst && isLastPage && (
            <tfoot>
              <tr className="border-t-2 border-border bg-accent/40">
                <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-foreground">
                  {balanceLabel && !settled ? `Saldo actual · ${balanceLabel}` : "Saldo actual"}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-base font-bold text-foreground">
                  {formatCurrency(finalSaldo)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <PaginationBar
        total={displayRows.length}
        page={pager.page}
        pageSize={pager.pageSize}
        noun="movimientos"
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
      />
    </>
  );
}
