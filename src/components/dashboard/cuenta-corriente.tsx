import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface CuentaCorrienteMovement {
  id: string;
  date: string;
  label: string;
  // Aumenta el saldo (lo que te deben o lo que le debés).
  cargo: number;
  // Reduce el saldo (un cobro o un pago).
  pago: number;
}

export function CuentaCorriente({
  movements,
  emptyLabel = "Todavía no hay movimientos de cuenta corriente.",
  oldestFirst = false,
  finalBalanceLabel,
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
}) {
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
  const displayRows = oldestFirst ? rows : [...rows].reverse();
  const finalSaldo = rows[rows.length - 1].saldo;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-5 py-2.5">Fecha</th>
            <th className="px-3 py-2.5">Operación</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right">Cargo</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right">Pago</th>
            <th className="whitespace-nowrap px-5 py-2.5 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {displayRows.map((row) => (
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
              <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-foreground">
                {formatCurrency(row.saldo)}
              </td>
            </tr>
          ))}
        </tbody>
        {oldestFirst && (
          <tfoot>
            <tr className="border-t-2 border-border bg-accent/40">
              <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-foreground">
                {finalBalanceLabel ? `Saldo actual · ${finalBalanceLabel}` : "Saldo actual"}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right text-base font-bold text-foreground">
                {formatCurrency(finalSaldo)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
