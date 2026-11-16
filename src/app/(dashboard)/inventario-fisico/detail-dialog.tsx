"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { cn, formatDateTime } from "@/lib/utils";
import { getInventoryDetail, type InventoryDetail } from "@/app/(dashboard)/inventario-fisico/actions";

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

async function downloadExcel(d: InventoryDetail) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = ["Producto", "SKU", "Unidad", "Sistema", "Contado", "Diferencia"].map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#e5e7eb" }));
  const num = (value: number) => ({ value, format: Number.isInteger(value) ? "0" : "0.00" });
  const body = (d.items ?? []).map((i) => [{ value: i.name }, { value: i.sku }, { value: i.unit }, num(i.expected), num(i.counted), num(Math.round((i.counted - i.expected) * 100) / 100)]);
  await writeXlsxFile([head, ...body], {
    columns: [{ width: 38 }, { width: 16 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }],
    stickyRowsCount: 1,
  }).toFile(`pesito-inventario-${(d.name ?? "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "fisico"}.xlsx`);
}

// Detalle de un inventario anterior: quién lo hizo, cuándo, y qué se contó de cada producto contra el sistema.
export function InventoryDetailDialog({ countId, onClose }: { countId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!countId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    getInventoryDetail(countId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [countId]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (detail?.items ?? []).filter((i) => (!onlyDiff || i.counted !== i.expected) && (q === "" || `${i.name} ${i.sku}`.toLowerCase().includes(q)));
  }, [detail, onlyDiff, search]);
  const pg = usePagination(items.length, `${countId}|${onlyDiff}|${search}`, "pesito:inventario-detalle:pagesize");
  const withDiff = (detail?.items ?? []).filter((i) => i.counted !== i.expected).length;

  return (
    <Dialog open={countId !== null} onClose={onClose} size="lg" title={detail?.name ?? "Inventario"} description={detail ? [detail.scope, detail.branch].filter(Boolean).join(" · ") : "Cargando…"}>
      {!detail ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando el detalle…</p>
      ) : detail.error ? (
        <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{detail.error}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-muted-foreground">
              Empezó: <span className="text-foreground">{detail.createdAt ? formatDateTime(detail.createdAt) : "—"}</span>
              {detail.createdBy && <span className="text-foreground">{` · ${detail.createdBy}`}</span>}
            </p>
            <p className="text-muted-foreground">
              {detail.status === "aplicado" ? "Aplicado: " : "Estado: "}
              <span className="text-foreground">{detail.status === "aplicado" ? (detail.appliedAt ? formatDateTime(detail.appliedAt) : "—") : detail.status}</span>
              {detail.appliedBy && <span className="text-foreground">{` · ${detail.appliedBy}`}</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border px-2 py-3">
              <p className="text-xl font-bold text-foreground">{(detail.items?.length ?? 0).toLocaleString("es-AR")}</p>
              <p className="text-xs text-muted-foreground">Contados</p>
            </div>
            <div className="rounded-xl border border-border px-2 py-3">
              <p className={cn("text-xl font-bold", withDiff > 0 ? "text-warning" : "text-success")}>{withDiff.toLocaleString("es-AR")}</p>
              <p className="text-xs text-muted-foreground">Con diferencia</p>
            </div>
            <div className="rounded-xl border border-border px-2 py-3">
              <p className="text-xl font-bold text-foreground">
                <span className="text-success">{`+${fmt(detail.plus ?? 0)}`}</span>
                {" / "}
                <span className="text-danger">{`−${fmt(detail.minus ?? 0)}`}</span>
              </p>
              <p className="text-xs text-muted-foreground">Unidades ajustadas</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o SKU" aria-label="Buscar" className="h-9 w-56" />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              Sólo con diferencia
            </label>
            <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => void downloadExcel(detail)} disabled={(detail.items?.length ?? 0) === 0}>
              <Download className="h-4 w-4" />
              Exportar a Excel
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2 text-right">Sistema</th>
                  <th className="px-3 py-2 text-right">Contado</th>
                  <th className="px-3 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(pg.start, pg.end).map((i) => {
                  const diff = Math.round((i.counted - i.expected) * 100) / 100;
                  return (
                    <tr key={i.productId} className="border-t border-border">
                      <td className="max-w-[16rem] px-3 py-2">
                        <p className="truncate text-foreground">{i.name}</p>
                        <p className="truncate text-muted-foreground">{i.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{`${fmt(i.expected)} ${i.unit}`}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{`${fmt(i.counted)} ${i.unit}`}</td>
                      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", diff === 0 ? "text-success" : diff > 0 ? "text-warning" : "text-danger")}>
                        {diff === 0 ? "Coincide" : `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No hay productos con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationBar total={items.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="productos" />
          </div>
          <p className="text-xs text-muted-foreground">La diferencia es contado menos lo que decía el sistema cuando se contó cada producto. Los productos que no se contaron no se tocaron.</p>
        </div>
      )}
    </Dialog>
  );
}
