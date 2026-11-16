"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { useToast } from "@/components/toast/toast-provider";
import { markCatalogDirty } from "@/lib/pos-catalog-store";
import { cn } from "@/lib/utils";
import { applyInventory, cancelInventory, setInventoryCount } from "@/app/(dashboard)/inventario-fisico/actions";

export interface CountProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  /** Stock que dice el sistema en la sucursal. */
  stock: number;
}
export interface CountItem {
  productId: string;
  counted: number;
  /** Lo que decía el sistema cuando se contó. */
  expected: number;
}

type Filter = "todos" | "sin-contar" | "diferencias" | "contados";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "sin-contar", label: "Sin contar" },
  { id: "diferencias", label: "Con diferencia" },
  { id: "contados", label: "Contados" },
];

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

function CountRow({ product, item, onCommit }: { product: CountProduct; item: CountItem | undefined; onCommit: (value: string) => void }) {
  const [text, setText] = useState(item ? String(item.counted) : "");
  const expected = item ? item.expected : product.stock;
  const diff = item ? item.counted - item.expected : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
        <p className="truncate text-xs text-muted-foreground">{[product.sku, product.barcode].filter(Boolean).join(" · ") || "Sin código"}</p>
      </div>
      <div className="w-24 text-right text-sm">
        <p className="text-[11px] text-muted-foreground">Sistema</p>
        <p className="tabular-nums text-foreground">{`${fmt(expected)} ${product.unit}`}</p>
      </div>
      <div className="w-28">
        <Input
          data-count-input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={text}
          placeholder="Contado"
          aria-label={`Contado de ${product.name}`}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onCommit(text)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-count-input]"));
            const next = inputs[inputs.indexOf(e.currentTarget) + 1];
            onCommit(text);
            next?.focus();
          }}
          className="h-9 text-right"
        />
      </div>
      <div className="w-24 text-right text-sm font-semibold tabular-nums">
        {diff === null ? (
          <span className="font-normal text-muted-foreground">—</span>
        ) : diff === 0 ? (
          <span className="text-success">Coincide</span>
        ) : (
          <span className={diff > 0 ? "text-warning" : "text-danger"}>{`${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`}</span>
        )}
      </div>
    </li>
  );
}

export function CountClient({
  countId,
  name,
  scope,
  branchName,
  products,
  initialItems,
}: {
  countId: string;
  name: string;
  scope: string;
  branchName: string | null;
  products: CountProduct[];
  initialItems: CountItem[];
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [items, setItems] = useState(() => new Map(initialItems.map((i) => [i.productId, i])));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [scan, setScan] = useState("");
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, CountProduct>();
    for (const p of products) {
      if (p.barcode) m.set(p.barcode.trim().toLowerCase(), p);
      if (p.sku) m.set(p.sku.trim().toLowerCase(), p);
    }
    return m;
  }, [products]);

  const stats = useMemo(() => {
    let counted = 0;
    let withDiff = 0;
    let plus = 0;
    let minus = 0;
    for (const i of items.values()) {
      counted += 1;
      const d = i.counted - i.expected;
      if (d !== 0) withDiff += 1;
      if (d > 0) plus += d;
      if (d < 0) minus += -d;
    }
    return { counted, withDiff, plus, minus };
  }, [items]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const item = items.get(p.id);
      if (filter === "sin-contar" && item) return false;
      if (filter === "contados" && !item) return false;
      if (filter === "diferencias" && !(item && item.counted !== item.expected)) return false;
      return q === "" || `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(q);
    });
  }, [products, items, search, filter]);
  const pg = usePagination(shown.length, `${search}|${filter}`, "pesito:inventario:pagesize");

  // Guarda en el servidor; si falla se vuelve a lo anterior y se avisa.
  async function save(product: CountProduct, counted: number | null) {
    const before = items.get(product.id);
    if (before?.counted === counted || (!before && counted === null)) return;
    setError(null);
    setItems((cur) => {
      const next = new Map(cur);
      if (counted === null) next.delete(product.id);
      else next.set(product.id, { productId: product.id, counted, expected: before?.expected ?? product.stock });
      return next;
    });
    const res = await setInventoryCount(countId, product.id, counted);
    if (res.error) {
      setError(res.error);
      setItems((cur) => {
        const next = new Map(cur);
        if (before) next.set(product.id, before);
        else next.delete(product.id);
        return next;
      });
      return;
    }
    if (counted !== null && res.expected !== undefined && res.expected !== null) {
      setItems((cur) => {
        const it = cur.get(product.id);
        if (!it) return cur;
        return new Map(cur).set(product.id, { ...it, expected: res.expected as number });
      });
    }
  }

  function commit(product: CountProduct, text: string) {
    const t = text.trim().replace(",", ".");
    if (t === "") return void save(product, null);
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return setError("Poné una cantidad válida (0 o más).");
    void save(product, n);
  }

  // Escanear (o tipear el código y Enter) suma 1 al contado del producto.
  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim().toLowerCase();
    setScan("");
    if (!code) return;
    const product = byCode.get(code);
    if (!product) return setScanMsg({ ok: false, text: `No encontramos el código ${scan.trim()} en esta lista.` });
    const next = (items.get(product.id)?.counted ?? 0) + 1;
    void save(product, next);
    setScanMsg({ ok: true, text: `${product.name}: ${fmt(next)} contado${next === 1 ? "" : "s"} (el sistema dice ${fmt(items.get(product.id)?.expected ?? product.stock)})` });
    scanRef.current?.focus();
  }

  async function apply() {
    if (stats.counted === 0) return setError("Todavía no contaste ningún producto.");
    if (
      !confirm(
        stats.withDiff === 0
          ? `Contaste ${stats.counted} productos y todos coinciden con el sistema. ¿Cerrar el inventario?`
          : `Se va a ajustar el stock de ${stats.withDiff} producto${stats.withDiff === 1 ? "" : "s"} (+${fmt(stats.plus)} / −${fmt(stats.minus)} unidades). Los ${products.length - stats.counted} sin contar no se tocan. ¿Aplicar?`
      )
    )
      return;
    setBusy(true);
    const res = await applyInventory(countId);
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    markCatalogDirty();
    showSuccess("Inventario aplicado", `${res.adjusted ?? 0} producto${res.adjusted === 1 ? "" : "s"} ajustado${res.adjusted === 1 ? "" : "s"}.`);
    router.refresh();
  }

  async function cancel() {
    if (!confirm("¿Cancelar el inventario? Se descarta lo que contaste y el stock no cambia.")) return;
    setBusy(true);
    const res = await cancelInventory(countId);
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    router.refresh();
  }

  const pct = products.length > 0 ? Math.round((stats.counted / products.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-foreground">{name}</p>
              <p className="text-sm text-muted-foreground">{`${scope}${branchName ? ` · ${branchName}` : ""}`}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => void cancel()} disabled={busy}>
                Cancelar inventario
              </Button>
              <Button type="button" onClick={() => void apply()} disabled={busy || stats.counted === 0}>
                {busy ? "Aplicando…" : "Aplicar ajustes"}
              </Button>
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-foreground">{`Contaste ${stats.counted} de ${products.length} productos (${pct}%)`}</span>
              <span className="text-muted-foreground">
                {stats.withDiff === 0
                  ? "Sin diferencias por ahora"
                  : `${stats.withDiff} con diferencia: +${fmt(stats.plus)} / −${fmt(stats.minus)} unidades`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <form onSubmit={onScan} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Escaneá un código de barras: suma 1 al contado"
              aria-label="Escanear código"
              className="h-9 max-w-md flex-1"
              autoFocus
            />
            <Button type="submit" size="sm" variant="outline">
              Sumar 1
            </Button>
            {scanMsg && <p className={cn("basis-full text-sm", scanMsg.ok ? "text-success" : "text-danger")}>{scanMsg.text}</p>}
          </form>
          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto, SKU o código" aria-label="Buscar" className="h-9 w-64" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay productos con ese filtro.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.slice(pg.start, pg.end).map((p) => {
              const item = items.get(p.id);
              return <CountRow key={`${p.id}:${item?.counted ?? ""}`} product={p} item={item} onCommit={(t) => commit(p, t)} />;
            })}
          </ul>
        )}
        <PaginationBar total={shown.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="productos" />
      </Card>
    </div>
  );
}
