"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runCrawlChunk, runMarketTest, type CrawlChunkReport, type StoreTestReport } from "./actions";

export function MarketTester() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ reports: StoreTestReport[]; rowsThisMonth: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [chunk, setChunk] = useState<CrawlChunkReport | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      setResult(await runMarketTest());
    } catch {
      setError("La prueba falló o tardó demasiado. Probá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function crawl() {
    setCrawling(true);
    setError(null);
    try {
      setChunk(await runCrawlChunk());
    } catch {
      setError("El recorrido se cortó (tardó demasiado). Lo que alcanzó a guardar queda guardado: apretá de nuevo para seguir.");
    } finally {
      setCrawling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground">Recorrido de catálogos (marcas principales)</p>
        <p className="text-sm text-muted-foreground">
          Baja los catálogos de los 4 súper por categorías durante unos 4 minutos y guarda lo que sirve; antes busca los códigos de barras de los productos de los negocios. Apretalo de nuevo para
          seguir donde quedó, hasta que no queden categorías pendientes. Necesita MARKET_SCAN_ENABLED y MARKET_CATALOG_ENABLED en el cron; acá corre siempre.
        </p>
        <Button onClick={() => void crawl()} disabled={crawling || pending}>
          {crawling ? "Recorriendo… no cierres esta página (hasta 4 minutos)" : "Correr el recorrido ahora"}
        </Button>
        {chunk && (
          <div className="space-y-1 pt-2 text-sm text-muted-foreground">
            <p>{`Precios guardados este mes en total: ${chunk.rowsThisMonth ?? "?"}.`}</p>
            <p>{`Códigos de barras de los negocios: ${chunk.eans.done} de ${chunk.eans.considered} revisados: ${chunk.eans.internal} con código propio (se ignoran), ${chunk.eans.found} precios encontrados en los súper, ${chunk.eans.missing} consultas sin resultado${chunk.eans.failed > 0 ? `, ${chunk.eans.failed} errores` : ""}. Si «revisados» da 0, ya están todos.`}</p>
            {chunk.stores.map((s) => (
              <p key={s.store}>
                {`${s.store}: ${s.pages} páginas, ${s.items} productos guardados, ${s.categoriesDone} categorías terminadas, ${s.pending ?? "?"} pendientes${s.errors > 0 ? `, ${s.errors} errores` : ""}.`}
              </p>
            ))}
          </div>
        )}
      </div>
      <Button onClick={() => void run()} disabled={pending}>
        {pending ? "Probando los súper… (puede tardar un minuto)" : "Hacer una prueba chica ahora"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {`Precios guardados este mes en total: ${result.rowsThisMonth ?? "?"}.`}
          </p>
          {result.reports.map((r) => (
            <Card key={r.store}>
              <CardContent className="space-y-1.5 py-4 text-sm">
                <p className="font-semibold text-foreground">{`${r.store}: ${r.ok ? "anduvo" : "revisar"}`}</p>
                <p className="text-muted-foreground">
                  {`Categorías: ${r.categories} · páginas bajadas: ${r.pages} · productos leídos: ${r.parsed} · de marcas principales: ${r.kept} · guardados: ${r.saved}`}
                </p>
                <p className="text-muted-foreground">{`Consulta por código de barras (Coca-Cola): ${r.eanLookup}`}</p>
                {r.samples.length > 0 && <p className="text-muted-foreground">{`Ejemplos: ${r.samples.join(" · ")}`}</p>}
                {r.errors.map((e, i) => (
                  <p key={i} className="text-danger">{e}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
