import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandFilter } from "@/lib/market-brands";
import { crawlStore, scanEans } from "@/lib/market-crawl";
import { MARKET_STORES } from "@/lib/market-prices";

// Precios de supermercados por EAN (migración 0078). La llama un cron los días 1 a 10 de cada mes
// (vercel.json) con "Authorization: Bearer $CRON_SECRET"; cada pasada completa un tramo de los EAN que
// todavía no tienen el precio del mes en todos los súper (así no se golpea a un súper con ráfagas) y,
// cuando ya están todos, no hace nada. Apagada hasta poner MARKET_SCAN_ENABLED=true en Vercel.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EANS_PER_RUN = 120;
const EAN_DEADLINE_MS = 110_000; // los EAN de los negocios usan hasta acá; el resto del tiempo es del recorrido de catálogos
const CRAWL_DEADLINE_MS = 270_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  if (process.env.MARKET_SCAN_ENABLED !== "true") return NextResponse.json({ enabled: false });

  const started = Date.now();
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  // 0) Limpieza: se guardan los últimos 3 meses (con 2 alcanza para mostrar y comparar); lo viejo se borra.
  const keepFrom = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  await admin.from("market_prices").delete().lt("month", keepFrom);
  await admin.from("market_crawl").delete().lt("month", keepFrom);

  // 1) Primero lo que más importa: los códigos de barras de los productos de los negocios.
  const eanPass = await scanEans(admin, month, EANS_PER_RUN, started + EAN_DEADLINE_MS);
  if (eanPass.error) return NextResponse.json({ error: "no se pudo leer la lista" }, { status: 500 });

  // 2) Catálogos completos (buscador). Apagado hasta MARKET_CATALOG_ENABLED=true.
  let crawl: Record<string, { pages: number; items: number; categories: number; errors: number }> | null = null;
  if (process.env.MARKET_CATALOG_ENABLED === "true") {
    const until = started + CRAWL_DEADLINE_MS;
    const results = await Promise.all(MARKET_STORES.map((store) => crawlStore(admin, store, month, until, brandFilter(process.env.MARKET_BRANDS))));
    crawl = Object.fromEntries(MARKET_STORES.map((store, i) => [store.id, results[i]]));
  }

  return NextResponse.json({ enabled: true, month, eans: eanPass, crawl });
}
