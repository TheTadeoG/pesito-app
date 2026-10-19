"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/error-reporter";

// Cuando una pantalla del panel se rompe: se avisa a Pesito (queda en /admin/errores) y la
// persona ve algo claro en vez de una pantalla en blanco.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error.message, error.stack, error.digest);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-foreground">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        Ya le avisamos a Pesito. Probá de nuevo; si sigue pasando, escribinos desde el botón de ayuda y contanos qué estabas haciendo.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Probar de nuevo</Button>
        <Link href="/pos">
          <Button variant="outline">Ir al punto de venta</Button>
        </Link>
      </div>
    </div>
  );
}
