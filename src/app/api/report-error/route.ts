import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/error-log";
import { checkIpRateLimit } from "@/lib/ip-rate-limit";

// Errores que pasan en el navegador (un clic que falla, una pantalla que se rompe). Sólo
// personas con sesión (el middleware pide login), del mismo sitio, con tamaño y ritmo acotados.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse(null, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > 8000) return new NextResponse(null, { status: 413 });
  if (await checkIpRateLimit("error-report", 40, 3600)) return new NextResponse(null, { status: 429 });

  let body: { message?: unknown; stack?: unknown; path?: unknown; digest?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof body.message !== "string" || body.message.length === 0) return new NextResponse(null, { status: 400 });

  await logError({
    source: "client",
    error: { message: body.message.slice(0, 600), stack: typeof body.stack === "string" ? body.stack.slice(0, 3000) : undefined, digest: typeof body.digest === "string" ? body.digest : undefined },
    path: typeof body.path === "string" ? body.path : null,
    context: "navegador",
  });
  return new NextResponse(null, { status: 204 });
}
