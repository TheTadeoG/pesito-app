"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/error-reporter";

// Último recurso: se rompió hasta la estructura de la página. Reemplaza al layout, por eso trae su html.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error.message, error.stack, error.digest);
  }, [error]);
  return (
    <html lang="es-AR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, padding: 16, textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>Probá de nuevo. Si sigue pasando, escribinos a soporte@pesito.com.ar.</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#059669", color: "white", fontWeight: 600, cursor: "pointer" }}>
            Probar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
