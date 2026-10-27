import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { fetchStorePrice, MARKET_STORES } from "@/lib/market-prices";

// Precios de supermercados por EAN (migración 0078). La llama un cron los días 1 a 10 de cada mes
// (vercel.json) con "Authorization: Bearer $CRON_SECRET"; cada pasada completa un tramo de los EAN que
// todavía no tienen el precio del mes en todos los súper (así no se golpea a un súper con ráfagas) y,
// cuando ya están todos, no hace nada. Apagada hasta poner MARKET_SCAN_ENABLED=true en Vercel.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EANS_PER_RUN = 120;
const PAUSE_MS = 250;
const DEADLINE_MS = 270_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  if (process.env.MARKET_SCAN_ENABLED !== "true") return NextResponse.json({ enabled: false });

  const started = Date.now();
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  const { data: pending, error } = await admin.rpc("market_pending_eans", {
    p_month: month,
    p_stores: MARKET_STORES.length,
    p_limit: EANS_PER_RUN,
  });
  if (error) {
    console.error("market-prices pending", error.message);
    return NextResponse.json({ error: "no se pudo leer la lista" }, { status: 500 });
  }

  const eans = (pending ?? []).map((r: { ean: string }) => r.ean);
  let found = 0;
  let missing = 0;
  let failed = 0;
  let done = 0;

  for (const ean of eans) {
    if (Date.now() - started > DEADLINE_MS) break;
    // Se saltea lo que ya está este mes (si una pasada anterior quedó a medias).
    const { data: have } = await admin.from("market_prices").select("store").eq("ean", ean).eq("month", month);
    const haveStores = new Set((have ?? []).map((r) => r.store));
    for (const store of MARKET_STORES) {
      if (haveStores.has(store.id)) continue;
      try {
        const p = await fetchStorePrice(store, ean);
        const row: Database["public"]["Tables"]["market_prices"]["Insert"] = p
          ? { ean, store: store.id, month, found: true, price: p.price, list_price: p.listPrice, name: p.name, brand: p.brand, url: p.url, image_url: p.imageUrl, available: p.available }
          : { ean, store: store.id, month, found: false, price: null };
        const { error: upErr } = await admin.from("market_prices").upsert(row, { onConflict: "ean,store,month" });
        if (upErr) throw new Error(upErr.message);
        if (p) found++;
        else missing++;
      } catch (e) {
        failed++;
        console.error("market-prices", store.id, ean, e instanceof Error ? e.message : e);
      }
      await sleep(PAUSE_MS);
    }
    done++;
  }

  return NextResponse.json({ enabled: true, month, considered: eans.length, done, found, missing, failed });
}
