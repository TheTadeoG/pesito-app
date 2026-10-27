"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar, usePageSize } from "@/components/dashboard/pagination-bar";
import { positionLabels, storeLabel } from "@/lib/market-prices";
import { cn, formatCurrency } from "@/lib/utils";
import { searchMarket, type MarketSearchResult } from "./actions";

/** Buscador de productos en los supermercados (por nombre, marca o código). */
export function MarketSearch({ insights }: { insights: boolean }) {
  const [text, setText] = useState("");
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

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Buscar en los supermercados</h2>
        <p className="text-sm text-muted-foreground">
          Escribí el nombre de cualquier producto y mirá cuánto sale en Carrefour, Jumbo, Disco y Vea. Ordenado del más barato al más caro.
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej: coca cola zero 1,75" className="pl-9" />
      </div>

      {active && (
        <Card>
          <CardContent className="space-y-3">
            {loading && !result && <p className="py-6 text-center text-sm text-muted-foreground">Buscando…</p>}
            {result?.error && <p className="py-6 text-center text-sm text-danger">{result.error}</p>}
            {result && !result.error && result.items.length === 0 && !loading && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No encontramos productos con eso. Puede que todavía no hayamos juntado los catálogos del mes.
              </p>
            )}
            <div className={cn("divide-y divide-border", loading && "opacity-60")}>
              {result?.items.map((it) => (
                <div key={it.ean} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border border-border bg-white object-contain" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{it.name}</p>
                      <p className="text-xs text-muted-foreground">{`${it.brand ? `${it.brand} · ` : ""}${it.ean}`}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {it.stores.map((s, i) => {
                        const chip = (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                              i === 0 ? "border-success/40 bg-success-bg font-semibold text-success" : "border-border text-muted-foreground",
                              !s.available && "line-through opacity-60"
                            )}
                          >
                            {`${storeLabel(s.store)} ${formatCurrency(s.price)}`}
                          </span>
                        );
                        return s.url ? (
                          <a key={s.store} href={s.url} target="_blank" rel="noopener noreferrer nofollow" title="Ver en la tienda">
                            {chip}
                          </a>
                        ) : (
                          <span key={s.store}>{chip}</span>
                        );
                      })}
                    </div>
                    {it.mine && (
                      <p className="text-xs text-muted-foreground">
                        {`Lo tenés cargado a ${formatCurrency(it.mine.price)}`}
                        {insights && it.mine.position && it.mine.diff !== null
                          ? ` · ${positionLabels[it.mine.position]} (${it.mine.diff > 0 ? "+" : ""}${it.mine.diff}%)`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>
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
                noun="productos"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
