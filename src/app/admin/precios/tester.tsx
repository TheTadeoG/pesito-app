"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { probeProduct, runCrawlChunk, runMarketTest, type CrawlChunkReport, type ProbeReport, type StoreTestReport } from "./actions";

export function MarketTester() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ reports: StoreTestReport[]; rowsThisMonth: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [code, setCode] = useState("7790895068096");
  const [text, setText] = useState("coca cola zero 2.25");
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<ProbeReport[] | null>(null);
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

  async function runProbe() {
    setProbing(true);
    setError(null);
    try {
      setProbe(await probeProduct(code, text));
    } catch {
      setError("La consulta falló. Probá de nuevo.");
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground">Probar un producto en vivo</p>
        <p className="text-sm text-muted-foreground">
          Pregunta a los 4 súper por un código de barras y por un texto, y muestra con qué código tiene ese producto cada uno. No guarda nada.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de barras" className="w-56" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto (ej. coca cola zero 2.25)" className="min-w-56 flex-1" />
          <Button onClick={() => void runProbe()} disabled={probing}>
            {probing ? "Consultando…" : "Consultar"}
          </Button>
        </div>
        {probe && (
          <div className="space-y-3 pt-2 text-sm">
            {probe.map((r) => (
              <div key={r.store} className="space-y-0.5">
                <p className="font-semibold text-foreground">{r.store}</p>
                <p className="text-muted-foreground">{`Por código: ${r.byCode}`}</p>
                {r.byText.map((line, i) => (
                  <p key={i} className="text-muted-foreground">{`· ${line}`}</p>
                ))}
                {r.error && <p className="text-danger">{r.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

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
