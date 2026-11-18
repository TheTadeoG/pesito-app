"use client";

import { useCallback, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

export interface UserSummary {
  userId: string;
  label: string;
  sales: number;
  salesTotal: number;
  voids: number;
  stockAdjustments: number;
  cashIn: number;
  cashOut: number;
  registersClosed: number;
  /** Suma de (contado − esperado) de las cajas cerradas: negativo = faltó plata. */
  cashDifference: number;
  shortages: number;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  at: string;
  kind: "stock" | "caja" | "anulacion";
  title: string;
  detail: string | null;
  /** Qué hizo, corto: «Ajuste de stock», «Retiro de caja», «Anulación de venta»… */
  action: string;
  /** Sobre qué: el producto, «Venta n.º 12», «Caja»… */
  subject: string;
  /** Cantidad de unidades (sólo movimientos de stock; con signo). */
  quantity: number | null;
  /** Monto en pesos (con signo: retiros y diferencias negativas restan). */
  amount: number | null;
  reason: string | null;
  tone: "neutral" | "success" | "warning" | "danger";
  /** Sucursal (sólo si el negocio tiene más de una). */
  branch: string | null;
}

const KINDS: { id: "todo" | ActivityEvent["kind"]; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "caja", label: "Caja" },
  { id: "stock", label: "Stock" },
  { id: "anulacion", label: "Anulaciones" },
];

const DOT: Record<ActivityEvent["tone"], string> = {
  neutral: "bg-muted-foreground/50",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

function Diff({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">Sin diferencia</span>;
  return (
    <span className={cn("font-semibold", value < 0 ? "text-danger" : "text-warning")}>
      {value < 0 ? `Faltó ${formatCurrency(-value)}` : `Sobró ${formatCurrency(value)}`}
    </span>
  );
}

type SortKey = "at" | "user" | "action" | "subject" | "quantity" | "amount";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = { stock: "Stock", caja: "Caja", anulacion: "Anulación" };

type XlsCell = { value: string | number | Date; fontWeight?: "bold"; backgroundColor?: string; format?: string };

// Baja a Excel lo que se está viendo (con los filtros puestos) y, en otra hoja, el resumen por persona.
async function downloadExcel(users: UserSummary[], rows: ActivityEvent[], rangeLabel: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = (labels: string[]): XlsCell[] => labels.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#e5e7eb" }));
  const label = (id: string) => users.find((u) => u.userId === id)?.label ?? "Usuario";
  const detail: XlsCell[][] = [
    head(["Fecha", "Persona", "Tipo", "Acción", "Producto / referencia", "Cantidad", "Monto", "Motivo", "Sucursal"]),
    ...rows.map((e): XlsCell[] => [
      { value: new Date(e.at), format: "dd/mm/yyyy hh:mm" },
      { value: label(e.userId) },
      { value: KIND_LABEL[e.kind] },
      { value: e.action },
      { value: e.subject },
      { value: e.quantity ?? "" },
      e.amount === null ? { value: "" } : { value: e.amount, format: "#,##0.00" },
      { value: e.reason ?? "" },
      { value: e.branch ?? "" },
    ]),
  ];
  const money = (value: number): XlsCell => ({ value, format: "#,##0.00" });
  const summary: XlsCell[][] = [
    head(["Persona", "Ventas", "Importe de ventas", "Anulaciones", "Ajustes de stock", "Retiros", "Ingresos", "Cierres de caja", "Diferencia de caja (contado − esperado)"]),
    ...users.map((u): XlsCell[] => [
      { value: u.label },
      { value: u.sales },
      money(u.salesTotal),
      { value: u.voids },
      { value: u.stockAdjustments },
      money(u.cashOut),
      money(u.cashIn),
      { value: u.registersClosed },
      money(u.cashDifference),
    ]),
  ];
  await writeXlsxFile(
    [
      { data: detail, sheet: "Movimientos", columns: [{ width: 18 }, { width: 22 }, { width: 12 }, { width: 22 }, { width: 36 }, { width: 10 }, { width: 14 }, { width: 36 }, { width: 18 }], stickyRowsCount: 1 },
      { data: summary, sheet: "Por persona", columns: [{ width: 24 }, { width: 10 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 36 }], stickyRowsCount: 1 },
    ]
  ).toFile(`pesito-por-usuario-${rangeLabel.replace(/ a /g, "_al_")}.xlsx`);
}

export function ActividadClient({ users, events, periodKey, rangeLabel }: { users: UserSummary[]; events: ActivityEvent[]; periodKey: string; rangeLabel: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("todo");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "at", dir: -1 });

  const actions = useMemo(() => Array.from(new Set(events.map((e) => e.action))).sort((a, b) => a.localeCompare(b)), [events]);
  const labelOf = useCallback((id: string) => users.find((u) => u.userId === id)?.label ?? "Usuario", [users]);

  const filtered = useMemo(
    () => {
      const q = search.trim().toLowerCase();
      const rows = events.filter(
        (e) =>
          (userId === null || e.userId === userId) &&
          (kind === "todo" || e.kind === kind) &&
          (action === "" || e.action === action) &&
          (q === "" || `${e.action} ${e.subject} ${e.reason ?? ""} ${e.branch ?? ""}`.toLowerCase().includes(q))
      );
      const val = (e: ActivityEvent): string | number =>
        sort.key === "at" ? e.at
        : sort.key === "user" ? labelOf(e.userId).toLowerCase()
        : sort.key === "action" ? e.action.toLowerCase()
        : sort.key === "subject" ? e.subject.toLowerCase()
        : sort.key === "quantity" ? (e.quantity ?? -Infinity)
        : (e.amount ?? -Infinity);
      return [...rows].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    },
    [events, userId, kind, action, search, sort, labelOf]
  );
  const pg = usePagination(filtered.length, `${periodKey}|${userId}|${kind}|${action}|${search}|${sort.key}${sort.dir}`, "pesito:actividad:pagesize");
  const toggleSort = (key: SortKey) => setSort((cur) => (cur.key === key ? { key, dir: (cur.dir * -1) as 1 | -1 } : { key, dir: key === "at" || key === "quantity" || key === "amount" ? -1 : 1 }));
  const hasBranch = events.some((e) => e.branch);
  const selected = users.find((u) => u.userId === userId) ?? null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por persona</CardTitle>
          <p className="text-sm text-muted-foreground">Tocá a alguien para ver sólo lo que hizo.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Persona</th>
                <th className="px-3 py-2 text-right font-medium">Ventas</th>
                <th className="px-3 py-2 text-right font-medium">Anulaciones</th>
                <th className="px-3 py-2 text-right font-medium">Ajustes de stock</th>
                <th className="px-3 py-2 text-right font-medium">Retiros</th>
                <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                <th className="px-4 py-2 text-right font-medium">Cierres de caja</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  onClick={() => setUserId(userId === u.userId ? null : u.userId)}
                  className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-muted/50", userId === u.userId && "bg-primary/10")}
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {u.sales}
                    <span className="block text-xs text-muted-foreground">{formatCurrency(u.salesTotal)}</span>
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", u.voids > 0 && "font-semibold text-danger")}>{u.voids}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.stockAdjustments}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.cashOut > 0 ? formatCurrency(u.cashOut) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.cashIn > 0 ? formatCurrency(u.cashIn) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {u.registersClosed === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="tabular-nums">{u.registersClosed}</span>
                        <span className="block text-xs">
                          <Diff value={u.cashDifference} />
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Todavía no hay movimientos en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">{selected ? `Movimientos de ${selected.label}` : "Todos los movimientos"}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Select value={userId ?? ""} onChange={(e) => setUserId(e.target.value || null)} aria-label="Persona" className="h-9 px-2.5">
                <option value="">Todas las personas</option>
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Acción" className="h-9 px-2.5">
                <option value="">Todas las acciones</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar: producto, motivo…" className="h-9" aria-label="Buscar" />
            </div>
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  kind === k.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
                )}
              >
                {k.label}
              </button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={filtered.length === 0}
              onClick={() => void downloadExcel(users, filtered, rangeLabel)}
              className="ml-auto"
            >
              <Download className="h-4 w-4" />
              Exportar a Excel
            </Button>
            {selected && (
              <button type="button" onClick={() => setUserId(null)} className="rounded-full px-3 py-1 text-xs font-medium text-primary hover:underline">
                Ver a todos
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay movimientos con ese filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <SortTh label="Fecha y hora" k="at" sort={sort} onSort={toggleSort} className="pl-6" />
                    <SortTh label="Persona" k="user" sort={sort} onSort={toggleSort} />
                    <SortTh label="Acción" k="action" sort={sort} onSort={toggleSort} />
                    <SortTh label="Producto / referencia" k="subject" sort={sort} onSort={toggleSort} />
                    <SortTh label="Cantidad" k="quantity" sort={sort} onSort={toggleSort} right />
                    <SortTh label="Monto" k="amount" sort={sort} onSort={toggleSort} right />
                    <th className="px-3 py-2.5">Motivo</th>
                    {hasBranch && <th className="px-3 py-2.5 pr-6">Sucursal</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(pg.start, pg.end).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap py-2.5 pl-6 pr-3 text-muted-foreground">{formatDateTime(e.at)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{labelOf(e.userId)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[e.tone])} />
                          {e.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{e.subject}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", e.quantity !== null && e.quantity < 0 && "text-danger")}>
                        {e.quantity === null ? "—" : `${e.quantity > 0 ? "+" : ""}${e.quantity.toLocaleString("es-AR")}`}
                      </td>
                      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", e.amount !== null && e.amount < 0 && "text-danger")}>
                        {e.amount === null ? "—" : `${e.amount < 0 ? "− " : ""}${formatCurrency(Math.abs(e.amount))}`}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.reason ?? "—"}</td>
                      {hasBranch && <td className="whitespace-nowrap px-3 py-2.5 pr-6 text-muted-foreground">{e.branch ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar
            total={filtered.length}
            page={pg.page}
            pageSize={pg.pageSize}
            onPageChange={pg.setPage}
            onPageSizeChange={pg.setPageSize}
            noun="movimientos"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  right,
  className,
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
    <th className={cn("px-3 py-2.5", right && "text-right", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground", active && "text-foreground")}>
        {label}
        <span aria-hidden className="text-[10px]">{active ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
