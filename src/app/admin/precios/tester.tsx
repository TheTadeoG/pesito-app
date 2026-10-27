"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runMarketTest, type StoreTestReport } from "./actions";

export function MarketTester() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ reports: StoreTestReport[]; rowsThisMonth: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
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
