"use client";

import { useEffect } from "react";

/** Manda al servidor un error del navegador (una sola vez por mensaje y máximo 5 por visita). */
export function reportClientError(message: string, stack?: string, digest?: string) {
  const w = window as unknown as { __pesitoErrors?: Set<string> };
  const seen = (w.__pesitoErrors ??= new Set());
  if (seen.size >= 5 || seen.has(message)) return;
  seen.add(message);
  try {
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack, digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // reportar no puede romper nada
  }
}

/** Escucha los errores sueltos del navegador (los de un clic no los atrapa ninguna pantalla de error). */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.message, e.error instanceof Error ? e.error.stack : undefined);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      reportClientError(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
