import type { Instrumentation } from "next";

// Los errores del servidor (páginas, rutas y acciones) quedan registrados en app_errors y, si es
// un error nuevo, llega un mail. Ver lib/error-log.ts y /admin/errores.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/error-log");
  await logError({
    source: "server",
    error: err,
    path: request.path,
    context: `${context.routeType}: ${context.routePath}`,
  });
};
