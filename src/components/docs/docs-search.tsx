"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { buildIndex, searchDocs } from "@/lib/docs/search";
import type { DocArticle } from "@/lib/docs/types";
import { docCategories } from "@/lib/docs/categories";
import { planDefinitions } from "@/lib/plan-features";

const PAGE = 8;

/** Buscador de guías: se escribe lo que se quiere hacer ("anular una venta") y salen las guías, ordenadas por parecido. */
export function DocsSearch({ articles, children }: { articles: DocArticle[]; children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const index = useMemo(() => buildIndex(articles), [articles]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchDocs(index, query) : []), [index, query, searching]);
  const categoryTitle = (id: string) => docCategories.find((c) => c.id === id)?.title ?? id;

  return (
    <div>
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="¿Qué querés hacer? Ej: anular una venta, cargar productos, abrir la caja…"
          aria-label="Buscar una guía"
          className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-12 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Borrar la búsqueda"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching ? (
        <section aria-live="polite" className="mt-8">
          {results.length === 0 ? (
            <div className="rounded-card border border-border bg-card p-6">
              <p className="font-semibold text-foreground">No encontramos una guía para eso.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Probá con otras palabras (por ejemplo &quot;cobrar&quot;, &quot;stock&quot; o &quot;caja&quot;) o mirá todas las guías más abajo. Si no
                aparece, escribinos a{" "}
                <a href="mailto:soporte@pesito.com.ar" className="font-medium text-primary hover:underline">
                  soporte@pesito.com.ar
                </a>
                .
              </p>
              <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-primary hover:underline">
                Ver todas las guías
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{`${results.length} ${results.length === 1 ? "guía" : "guías"} para “${query.trim()}”`}</p>
              <ul className="mt-3 space-y-3">
                {results.slice(0, shown).map(({ article }) => (
                  <li key={article.slug}>
                    <Link
                      href={`/ayuda/${article.slug}`}
                      className="block rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{article.title}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{categoryTitle(article.category)}</span>
                        {article.plan && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                            {`Desde el ${planDefinitions[article.plan].name}`}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{article.summary}</span>
                      <span className="mt-1 block text-xs text-muted-foreground/80">{article.where}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {results.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="mt-4 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  {`Mostrar más (${results.length - shown})`}
                </button>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="mt-10">{children}</div>
      )}
    </div>
  );
}
