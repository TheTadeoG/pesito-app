"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { getCajaDetail, type CajaDetail } from "@/app/(dashboard)/caja/actions";
import { CajaDetailDialog } from "@/app/(dashboard)/caja/caja-detail-dialog";
import type { PaymentBreakdownRow } from "@/lib/caja";

export interface CajaHistorialRow {
  id: string;
  userLabel: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number;
  // Retiros manuales + compras y pagos a proveedores pagados en efectivo.
  egresosTotal: number;
  paymentBreakdown: PaymentBreakdownRow[];
  /** Sucursal de la caja (sólo si el negocio tiene más de una). */
  branchName?: string | null;
}

type SortKey = "fecha" | "quien" | "esperado" | "contado" | "diferencia";

export function CajaHistorial({
  rows,
  limitedTo,
  periodKey = "",
}: {
  rows: CajaHistorialRow[];
  /** Identifica el período/sucursal mostrados: al cambiar, la lista vuelve a la primera página. */
  periodKey?: string;
  /** El plan no incluye el historial completo: sólo se ven los últimos N cierres. */
  limitedTo?: number;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CajaDetail | null>(null);
  const [who, setWho] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fecha", dir: -1 });

  const people = useMemo(() => Array.from(new Set(rows.map((r) => r.userLabel))).sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => {
    const val = (r: CajaHistorialRow): string | number =>
      sort.key === "fecha" ? r.closedAt
      : sort.key === "quien" ? r.userLabel.toLowerCase()
      : sort.key === "esperado" ? r.expectedAmount
      : sort.key === "contado" ? r.closingAmount
      : r.closingAmount - r.expectedAmount;
    return rows
      .filter((r) => (who === "" || r.userLabel === who) && (!onlyDiff || r.closingAmount !== r.expectedAmount))
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [rows, who, onlyDiff, sort]);
  const pg = usePagination(filtered.length, `${periodKey}|${who}|${onlyDiff}|${sort.key}${sort.dir}`, "pesito:caja-historial:pagesize");
  const toggleSort = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: (cur.dir * -1) as 1 | -1 } : { key, dir: key === "quien" ? 1 : -1 }));

  // Totales de lo que se está viendo (todos los cierres filtrados, no sólo la página).
  const totals = useMemo(() => {
    let faltante = 0;
    let sobrante = 0;
    let withShortage = 0;
    for (const r of filtered) {
      const d = Math.round((r.closingAmount - r.expectedAmount) * 100) / 100;
      if (d < 0) {
        faltante += -d;
        withShortage += 1;
      } else if (d > 0) sobrante += d;
    }
    return { faltante, sobrante, withShortage, net: sobrante - faltante };
  }, [filtered]);

  async function openDetail(cashRegisterId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    // Si falla, el diálogo muestra "No pudimos cargar" en vez de quedar
    // cargando para siempre.
    const result = await getCajaDetail(cashRegisterId).catch(() => null);
    setDetailLoading(false);
    setDetail(result?.detail ?? null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de caja</CardTitle>
        <p className="text-xs text-muted-foreground">Tocá un cierre para ver el detalle.</p>
        {limitedTo !== undefined && (
          <p className="text-xs text-muted-foreground">
            {`Ves los últimos ${limitedTo} cierres. El historial completo está en el Plan Pro. `}
            <Link href="/suscribirse?plan=pro" prefetch={false} className="font-medium text-primary hover:underline">
              Pasate al Plan Pro
            </Link>
          </p>
        )}
      </CardHeader>
      {rows.length > 0 && (
        <div className="space-y-3 px-5 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Cierres" value={filtered.length.toLocaleString("es-AR")} hint="en el período" />
            <Stat label="Con faltante" value={String(totals.withShortage)} hint={totals.withShortage > 0 ? "cajas que cerraron de menos" : "ninguno"} tone={totals.withShortage > 0 ? "danger" : undefined} />
            <Stat label="Faltante total" value={formatCurrency(totals.faltante)} hint="suma de lo que faltó" tone={totals.faltante > 0 ? "danger" : undefined} />
            <Stat
              label="Diferencia neta"
              value={`${totals.net < 0 ? "− " : totals.net > 0 ? "+ " : ""}${formatCurrency(Math.abs(totals.net))}`}
              hint={`sobró ${formatCurrency(totals.sobrante)} · faltó ${formatCurrency(totals.faltante)}`}
              tone={totals.net < 0 ? "danger" : totals.net > 0 ? "warning" : "success"}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {people.length > 1 && (
              <div className="w-48">
                <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Quién" className="h-9 px-2.5">
                  <option value="">Todas las personas</option>
                  {people.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <button
              type="button"
              aria-pressed={onlyDiff}
              onClick={() => setOnlyDiff((v) => !v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${onlyDiff ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}
            >
              Sólo con diferencia
            </button>
          </div>
        </div>
      )}
      <div className="pt-3">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no cerraste ninguna caja.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs font-semibold text-muted-foreground">
                  <SortTh label="Fecha" k="fecha" sort={sort} onSort={toggleSort} className="px-5" />
                  <SortTh label="Quién" k="quien" sort={sort} onSort={toggleSort} />
                  <th className="hidden px-3 py-2 sm:table-cell">Horario</th>
                  <SortTh label="Esperado" k="esperado" sort={sort} onSort={toggleSort} right className="hidden md:table-cell" />
                  <SortTh label="Contado" k="contado" sort={sort} onSort={toggleSort} right className="hidden md:table-cell" />
                  <SortTh label="Diferencia" k="diferencia" sort={sort} onSort={toggleSort} right className="px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(pg.start, pg.end).map((row) => {
                  const diff = row.closingAmount - row.expectedAmount;
                  const openedDate = formatDate(row.openedAt);
                  const closedDate = formatDate(row.closedAt);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => openDetail(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(row.id);
                        }
                      }}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                        {openedDate}
                        {openedDate !== closedDate && (
                          <span className="text-xs font-normal text-muted-foreground">{` → ${closedDate}`}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {row.userLabel}
                        {row.branchName && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {row.branchName}
                          </span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-muted-foreground sm:table-cell">
                        {`${formatTime(row.openedAt)} → ${formatTime(row.closedAt)}`}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-foreground md:table-cell">
                        {formatCurrency(row.expectedAmount)}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-foreground md:table-cell">
                        {formatCurrency(row.closingAmount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {diff === 0 ? (
                          <Badge tone="success">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Sin diferencia
                          </Badge>
                        ) : (
                          <Badge tone={diff > 0 ? "warning" : "danger"}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {diff > 0 ? "+ " : "− "}
                            {formatCurrency(Math.abs(diff))}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay cierres con ese filtro.</p>
            )}
          </div>
        )}
        {limitedTo === undefined && (
          <PaginationBar
            total={filtered.length}
            page={pg.page}
            pageSize={pg.pageSize}
            onPageChange={pg.setPage}
            onPageSizeChange={pg.setPageSize}
            noun="cierres"
          />
        )}
      </div>

      <CajaDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        detail={detail}
      />
    </Card>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`truncate text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  right,
  className = "px-3",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  right?: boolean;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={`py-2 ${right ? "text-right" : ""} ${className}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}>
        {label}
        <span aria-hidden className="text-[10px]">{active ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
