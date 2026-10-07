"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { createClient } from "@/lib/supabase/client";
import { PosScreen } from "@/app/(dashboard)/pos/pos-screen";
import { loadCatalogFallback, type CatalogProduct } from "@/app/(dashboard)/pos/actions";
import type { ProductLite } from "@/app/(dashboard)/pos/pos-client";

// Catálogo del POS con copia en el navegador (migración 0064). El servidor ya
// no manda todos los productos en cada carga: acá se guarda lo último que se
// bajó y se le pide a la base (directo, sin pasar por Vercel) sólo lo que
// cambió desde entonces, más el stock de todos al día. Un producto que ya no
// figura en la lista de stock (se desactivó o se borró) se saca de la copia.

// Con el stock de la última vez: sólo se muestra si no hay conexión con la base.
type CachedProduct = ProductLite;

interface Cache {
  syncedAt: string;
  products: CachedProduct[];
}

interface CatalogResponse {
  now: string;
  changed: (Omit<CachedProduct, "stock" | "price" | "min_stock"> & {
    active: boolean;
    price: number | string;
    min_stock: number | string;
  })[];
  stock: [string, number | string][];
}

const RESYNC_MS = 2 * 60_000;
// Tiempo máximo de espera de la consulta directa y del respaldo del servidor.
const RPC_TIMEOUT_MS = 6_000;
const FALLBACK_TIMEOUT_MS = 25_000;
// Margen para no perder productos modificados mientras corría la consulta anterior.
const OVERLAP_MS = 10_000;

function readCache(key: string): Cache | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    return parsed && Array.isArray(parsed.products) && typeof parsed.syncedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, cache: Cache) {
  try {
    window.localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Sin espacio o sin almacenamiento: se baja completo cada vez, como antes.
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

export function PosCatalog({
  orgId,
  branchId,
  ...screenProps
}: Omit<ComponentProps<typeof PosScreen>, "products"> & { branchId: string | null }) {
  const [products, setProducts] = useState<ProductLite[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const lastSync = useRef(0);
  const cacheKey = `pesito-pos-catalog:v1:${orgId}:${branchId ?? "all"}`;

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let lastError = "";

    async function fetchCatalog(since: string | null): Promise<CatalogResponse | null> {
      // Si la consulta directa a la base no responde en unos segundos (red,
      // bloqueo del navegador, sesión trabada), se sigue por el respaldo del
      // servidor en vez de quedar esperando.
      const answer = await Promise.race([
        supabase.rpc("pos_catalog", {
          p_org_id: orgId,
          p_branch_id: branchId,
          p_since: since,
        }),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), RPC_TIMEOUT_MS)),
      ]);
      if (answer === "timeout") {
        console.error("pos_catalog: sin respuesta en", RPC_TIMEOUT_MS, "ms");
        lastError = "la base no respondió a tiempo";
        return null;
      }
      const { data, error } = answer;
      if (error || !data) {
        console.error("pos_catalog falló:", error?.message ?? "sin datos");
        lastError = error?.message ?? "sin datos";
        return null;
      }
      const res = data as unknown as CatalogResponse;
      if (!Array.isArray(res.stock) || !Array.isArray(res.changed)) {
        console.error("pos_catalog devolvió un formato inesperado");
        lastError = "formato inesperado";
        return null;
      }
      return res;
    }

    function build(base: CachedProduct[], res: CatalogResponse): { cache: CachedProduct[]; view: ProductLite[] } | null {
      const details = new Map(base.map((p) => [p.id, p]));
      for (const c of res.changed) {
        if (!c.active) {
          details.delete(c.id);
          continue;
        }
        details.set(c.id, {
          id: c.id,
          name: c.name,
          barcode: c.barcode,
          sku: c.sku,
          price: Number(c.price),
          min_stock: Number(c.min_stock),
          unit: c.unit,
          image_url: c.image_url,
          stock: details.get(c.id)?.stock ?? 0,
        });
      }
      const view: ProductLite[] = [];
      for (const [id, stock] of res.stock) {
        const d = details.get(id);
        // Un producto activo del que no hay datos en la copia: copia incompleta.
        if (!d) return null;
        view.push({ ...d, stock: Number(stock) });
      }
      view.sort(byName);
      return { cache: view, view };
    }

    async function sync() {
      if (syncing) return;
      syncing = true;
      try {
        const cached = readCache(cacheKey);
        let res = cached
          ? await fetchCatalog(new Date(new Date(cached.syncedAt).getTime() - OVERLAP_MS).toISOString())
          : await fetchCatalog(null);
        let built = res ? build(cached?.products ?? [], res) : null;
        if (res && !built && cached) {
          // La copia quedó incompleta: bajarla entera.
          res = await fetchCatalog(null);
          built = res ? build([], res) : null;
        }
        if (cancelled) return;
        if (res && built) {
          writeCache(cacheKey, { syncedAt: res.now, products: built.cache });
          lastSync.current = Date.now();
          setFailure(null);
          setProducts(built.view);
          return;
        }
        // Sin conexión con la base: se usa la copia (con el stock de la última vez).
        if (cached) {
          setProducts((current) => current ?? cached.products);
          return;
        }
        // Sin copia y sin respuesta de pos_catalog: se baja por el servidor.
        const fallback = await Promise.race([
          loadCatalogFallback(branchId),
          new Promise<{ products?: CatalogProduct[]; error?: string }>((resolve) =>
            setTimeout(() => resolve({ error: "El servidor tardó demasiado en responder." }), FALLBACK_TIMEOUT_MS)
          ),
        ]);
        if (cancelled) return;
        if (fallback.products) {
          setFailure(null);
          setProducts(fallback.products);
        } else {
          setFailure(fallback.error ?? lastError ?? "No pudimos cargar los productos.");
        }
      } catch (e) {
        console.error("Catálogo del POS:", e);
        if (!cancelled) setFailure(e instanceof Error ? e.message : "No pudimos cargar los productos.");
      } finally {
        syncing = false;
      }
    }

    void sync();
    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastSync.current > RESYNC_MS) void sync();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, orgId, branchId, cacheKey, attempt]);

  if (!products && failure) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-6 text-center" role="alert">
        <p className="text-sm font-medium text-foreground">No pudimos cargar los productos.</p>
        <p className="text-xs text-muted-foreground">{failure}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => {
            setFailure(null);
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!products) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
        <p className="text-center text-sm text-muted-foreground">Cargando productos…</p>
      </div>
    );
  }

  return <PosScreen orgId={orgId} products={products} {...screenProps} />;
}
