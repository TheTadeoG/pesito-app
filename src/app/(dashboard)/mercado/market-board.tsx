"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar, usePagination, usePageSize } from "@/components/dashboard/pagination-bar";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import type { PricePosition } from "@/lib/market-prices";
import type { Plan } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { searchMarket, type MarketSearchResult } from "./actions";
import { MarketCard, type MarketCardData } from "./market-card";

export interface BoardRow extends MarketCardData {
  /** Para los filtros. */
  position: PricePosition | null;
  hasPrices: boolean;
}

type Tab = "mis" | "super";
type Filter = "todos" | "caro" | "en-rango" | "barato";

const isHigh = (p: PricePosition | null) => p === "caro" || p === "muy-caro";
const isLow = (p: PricePosition | null) => p === "barato" || p === "muy-barato";

export function MarketBoard({
  rows,
  insights,
  initialFilter,
  internalCount,
  loadError,
  totalProducts,
  lastMonth,
  locked,
}: {
  rows: BoardRow[];
  insights: boolean;
  initialFilter: Filter;
  /** Productos que quedan afuera por tener código propio (200-299). */
  internalCount: number;
  /** Mensaje de la base si no se pudieron leer los precios. */
  loadError: string | null;
  totalProducts: number;
  lastMonth: string | null;
  locked: { plan: Plan; high: number; low: number } | null;
}) {
  const [tab, setTab] = useState<Tab>("mis");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);

  const counts = useMemo(
    () => ({
      todos: rows.length,
      caro: rows.filter((r) => isHigh(r.position)).length,
      "en-rango": rows.filter((r) => r.position === "en-rango").length,
      barato: rows.filter((r) => isLow(r.position)).length,
    }),
    [rows]
  );
  const month = lastMonth ? new Date(`${lastMonth}T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {`Precios de Carrefour, Jumbo, Disco y Vea, actualizados una vez por mes${month ? ` (último dato: ${month})` : ""}. Son los de la tienda online: orientativos.`}
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tab === "mis" ? "Buscar en tus productos (nombre, marca o código)…" : "Buscar en los supermercados: ej. coca cola zero 1,75"}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["mis", `Mis productos (${rows.length})`],
            ["super", "Todo el súper"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
        {tab === "mis" && insights && (
          <span className="ml-auto flex flex-wrap gap-1.5">
            {(
              [
                ["todos", "Todos"],
                ["caro", "Más caros"],
                ["en-rango", "En rango"],
                ["barato", "Más baratos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {`${label} ${counts[id]}`}
              </button>
            ))}
          </span>
        )}
      </div>

      {loadError && (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-xs text-danger">{`No pudimos leer los precios de los supermercados: ${loadError}`}</p>
      )}

      {tab === "mis" && (
        <MyProducts
          rows={rows}
          text={text}
          filter={insights ? filter : "todos"}
          locked={locked}
          internalCount={internalCount}
          totalProducts={totalProducts}
        />
      )}
      {tab === "super" && <SuperSearch text={text} />}
    </div>
  );
}

function MyProducts({
  rows,
  text,
  filter,
  locked,
  internalCount,
  totalProducts,
}: {
  rows: BoardRow[];
  text: string;
  filter: Filter;
  locked: { plan: Plan; high: number; low: number } | null;
  internalCount: number;
  totalProducts: number;
}) {
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "caro" && !isHigh(r.position)) return false;
        if (filter === "barato" && !isLow(r.position)) return false;
        if (filter === "en-rango" && r.position !== "en-rango") return false;
        return !q || `${r.name} ${r.brand ?? ""} ${r.ean}`.toLowerCase().includes(q);
      })
      // Primero los que ya tienen precio de súper.
      .sort((a, b) => Number(b.hasPrices) - Number(a.hasPrices));
  }, [rows, text, filter]);
  const pager = usePagination(shown.length, `${text}|${filter}`, "pesito-mercado-page-size");
  const page = shown.slice(pager.start, pager.end);
  const withPrices = rows.filter((r) => r.hasPrices).length;

  return (
    <div className="space-y-3">
      {locked && withPrices > 0 && (
        <PlanLockNote plan={locked.plan} cta="Ver el Plan IA">
          {locked.high + locked.low > 0
            ? `${locked.high > 0 ? `${locked.high} de tus productos están más caros que los supermercados` : ""}${locked.high > 0 && locked.low > 0 ? " y " : ""}${locked.low > 0 ? `${locked.low} más baratos` : ""}. Con el Plan IA ves cuáles, el precio sugerido y recibís avisos.`
            : "Con el Plan IA ves si estás caro o barato frente a los supermercados, el precio sugerido y recibís avisos."}
        </PlanLockNote>
      )}
      {rows.length > 0 && withPrices === 0 && (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Todavía no juntamos precios de los supermercados para tus productos. Se van sumando durante el mes; mientras tanto podés buscar en «Todo el súper».
        </p>
      )}

      <Card>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {`Ninguno de tus ${totalProducts} productos tiene un código de barras real. Cargalo (el del envase) en cada producto y acá vas a ver cuánto cuesta en los supermercados.`}
            </p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nada coincide con la búsqueda.</p>
          ) : (
            <div className="divide-y divide-border">
              {page.map((r) => (
                <MarketCard key={r.key} data={r} />
              ))}
            </div>
          )}
          <PaginationBar
            total={shown.length}
            page={pager.page}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        </CardContent>
      </Card>

      {internalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {`${internalCount} ${internalCount === 1 ? "producto no aparece" : "productos no aparecen"} porque ${internalCount === 1 ? "tiene" : "tienen"} un código propio (empieza con 2, lo generó Pesito o tu negocio) y esos códigos no existen en los supermercados. Si cargás el código del envase, aparecen.`}
        </p>
      )}
    </div>
  );
}

function SuperSearch({ text }: { text: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize("pesito-mercado-search-size", 25);
  const [state, setState] = useState<{ key: string; result: MarketSearchResult } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(text.trim());
      setPage(0);
    }, 400);
    return () => window.clearTimeout(t);
  }, [text]);

  const key = `${query}|${page}|${pageSize}`;
  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    searchMarket(query, page, pageSize)
      .then((result) => {
        if (!cancelled) setState({ key, result });
      })
      .catch(() => {
        if (!cancelled) setState({ key, result: { error: "No pudimos buscar ahora.", total: 0, items: [] } });
      });
    return () => {
      cancelled = true;
    };
  }, [key, query, page, pageSize]);

  const active = query.length >= 2;
  const loading = active && state?.key !== key;
  const result = active && state ? state.result : null;

  if (!active) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Escribí arriba el nombre de cualquier producto y mirá cuánto sale en cada súper, del más barato al más caro.
        </CardContent>
      </Card>
    );
  }

  const cards: MarketCardData[] = (result?.items ?? []).map((it) => ({
    key: it.ean,
    name: it.name,
    brand: it.brand,
    ean: it.ean,
    imageUrl: it.imageUrl,
    stores: it.stores,
    mine: it.mine ? { price: it.mine.price, position: it.mine.position, diff: it.mine.diff, suggested: null, reason: null } : null,
  }));

  return (
    <Card>
      <CardContent className="space-y-3">
        {loading && !result && <p className="py-6 text-center text-sm text-muted-foreground">Buscando…</p>}
        {result?.error && <p className="py-6 text-center text-sm text-danger">{result.error}</p>}
        {result && !result.error && cards.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No encontramos productos con eso. Puede que sea de una marca que no juntamos o que todavía no hayamos bajado los catálogos del mes.
          </p>
        )}
        <div className={cn("divide-y divide-border", loading && "opacity-60")}>
          {cards.map((c) => (
            <MarketCard key={c.key} data={c} />
          ))}
        </div>
        {result && result.total > 0 && (
          <PaginationBar
            total={result.total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
