"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Download, Eye, Printer, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { SaleDetailDialog } from "@/components/dashboard/sale-detail-dialog";
import { TicketPrint } from "@/components/dashboard/ticket-print";
import { VoidSaleDialog } from "@/components/dashboard/void-sale-dialog";
import { getSaleDetail, type SaleDetail } from "@/lib/actions/sales";
import { receiptFromSale } from "@/lib/sale-receipt";
import type { SaleReceipt } from "@/app/(dashboard)/pos/sale-done-dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface HistorialRow {
  id: string;
  createdAt: string;
  customerName: string;
  paymentMethod: string;
  total: number;
  voided: boolean;
  /** «Factura C 00003-00000142» si la venta tiene factura electrónica autorizada. */
  voucher: string | null;
}

interface Filters {
  desde: string;
  hasta: string;
  medio: string;
  estado: string;
  q: string;
  sucursal: string;
}

export function VentasHistorial({
  rows,
  total,
  page,
  pageSize,
  filters,
  paymentLabels,
  branches,
  canVoid,
  canExport,
  orgName,
  error,
}: {
  rows: HistorialRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Filters;
  paymentLabels: Record<string, string>;
  branches: { id: string; name: string }[];
  canVoid: boolean;
  canExport: boolean;
  orgName: string;
  error: string | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(filters);
  const [detail, setDetail] = useState<{ loading: boolean; sale: SaleDetail | null } | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; total: number } | null>(null);
  const [printing, setPrinting] = useState<SaleReceipt | null>(null);

  const go = useCallback(
    (next: Partial<Filters> & { pagina?: number; tam?: number }) => {
      const merged = { ...filters, ...next };
      const p = new URLSearchParams();
      if (merged.desde) p.set("desde", merged.desde);
      if (merged.hasta) p.set("hasta", merged.hasta);
      if (merged.medio) p.set("medio", merged.medio);
      if (merged.estado) p.set("estado", merged.estado);
      if (merged.q) p.set("q", merged.q);
      if (merged.sucursal) p.set("sucursal", merged.sucursal);
      const size = next.tam ?? pageSize;
      if (size !== 25) p.set("tam", String(size));
      if (next.pagina) p.set("pagina", String(next.pagina));
      router.push(`/ventas?${p.toString()}`);
    },
    [filters, pageSize, router]
  );

  async function openDetail(id: string) {
    setDetail({ loading: true, sale: null });
    const res = await getSaleDetail(id);
    setDetail({ loading: false, sale: res.sale ?? null });
  }

  const pageTotal = rows.filter((r) => !r.voided).reduce((n, r) => n + r.total, 0);
  const exportHref = `/configuracion/exportar?tipo=ventas&desde=${f.desde}&hasta=${f.hasta}`;
  const sale = detail?.sale ?? null;
  const hasInvoice = Boolean(sale?.vouchers.some((v) => v.kind === "invoice" && v.status === "authorized"));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go({ ...f });
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
              <Input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
              <Input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Medio de pago</label>
              <Select value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value })}>
                <option value="">Todos</option>
                {Object.entries(paymentLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
              <Select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
                <option value="">Todas</option>
                <option value="completada">Completadas</option>
                <option value="anulada">Anuladas</option>
              </Select>
            </div>
            {branches.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Sucursal</label>
                <Select value={f.sucursal} onChange={(e) => setF({ ...f, sucursal: e.target.value })}>
                  <option value="">Todas</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Buscar por nombre del cliente…" className="pl-9" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/ventas")}
              >
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {`${total.toLocaleString("es-AR")} ${total === 1 ? "venta" : "ventas"} en el período · en esta página, sin contar anuladas: `}
              <span className="font-semibold text-foreground">{formatCurrency(pageTotal)}</span>
            </p>
            {canExport && (
              <a href={exportHref} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
                <Download className="h-4 w-4" />
                Exportar el período (CSV)
              </a>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay ventas con esos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Medio de pago</th>
                    <th className="px-3 py-2.5">Comprobante</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => void openDetail(r.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted">
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{r.customerName}</td>
                      <td className="px-3 py-3">
                        <Badge>{paymentLabels[r.paymentMethod] ?? r.paymentMethod}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {r.voided ? <Badge tone="danger">Anulada</Badge> : (r.voucher ?? "Ticket interno")}
                        {r.voided && r.voucher ? ` · ${r.voucher}` : ""}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${r.voided ? "text-muted-foreground line-through" : "text-foreground"}`}>{formatCurrency(r.total)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="icon" aria-label="Ver detalle" title="Ver detalle" onClick={() => void openDetail(r.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canVoid && !r.voided && !r.voucher && (
                            <Button variant="outline" size="icon" aria-label="Anular venta" title="Anular venta" onClick={() => setVoidTarget({ id: r.id, total: r.total })}>
                              <Ban className="h-4 w-4 text-danger" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            total={total}
            page={page}
            pageSize={pageSize}
            noun="ventas"
            onPageChange={(p) => go({ pagina: p })}
            onPageSizeChange={(n) => go({ tam: n })}
          />
        </CardContent>
      </Card>

      <SaleDetailDialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        loading={detail?.loading ?? false}
        sale={sale}
        paymentLabels={paymentLabels}
        actions={
          sale && (
            <>
              <Button variant="outline" onClick={() => setPrinting(receiptFromSale(sale, orgName, paymentLabels))}>
                <Printer className="h-4 w-4" />
                Reimprimir ticket
              </Button>
              {canVoid && !sale.voided && sale.status !== "anulada" && !hasInvoice && (
                <Button variant="danger" onClick={() => setVoidTarget({ id: sale.id, total: sale.total })}>
                  <Ban className="h-4 w-4" />
                  Anular venta
                </Button>
              )}
              {hasInvoice && !sale.voided && (
                <p className="w-full text-right text-xs text-muted-foreground">
                  Esta venta tiene una factura electrónica: no se anula a secas, se corrige con una nota de crédito.
                </p>
              )}
            </>
          )
        }
      />

      <VoidSaleDialog
        sale={voidTarget}
        onClose={() => setVoidTarget(null)}
        onVoided={() => {
          setVoidTarget(null);
          setDetail(null);
          router.refresh();
        }}
      />

      <TicketPrint receipt={printing} onDone={() => setPrinting(null)} />
    </div>
  );
}
