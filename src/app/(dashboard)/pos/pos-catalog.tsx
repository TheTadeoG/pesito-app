"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { createClient } from "@/lib/supabase/client";
import { PosScreen } from "@/app/(dashboard)/pos/pos-screen";
import { loadCatalogFallback, type CatalogProduct } from "@/app/(dashboard)/pos/actions";
import { POS_CACHE_COOKIE, posCacheCookieValue } from "@/lib/pos-cache-cookie";
import type { ProductLite } from "@/app/(dashboard)/pos/pos-client";

// Catálogo del POS con copia en el navegador (migración 0064). El servidor ya
// no manda todos los productos en cada carga: acá se guarda lo último que se
// bajó y se le pide a la base (directo, sin pasar por Vercel) sólo lo que
// cambió desde entonces, más el stock de todos al día. Un producto que ya no
// figura en la lista de stock (se desactivó o se borró) se saca de la copia.

// Con el stock de la última vez: se muestra al instante y se actualiza en segundo plano.
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

function parseCache(raw: string | null): Cache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Cache;
    return parsed && Array.isArray(parsed.products) && typeof parsed.syncedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readCache(key: string): Cache | null {
  return parseCache(readRaw(key));
}

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function writeCache(key: string, cache: Cache, cookieValue: string) {
  try {
    window.localStorage.setItem(key, JSON.stringify(cache));
    // Avisa al servidor que este navegador ya tiene la copia: la próxima vez la
    // página no manda los productos adentro.
    document.cookie = `${POS_CACHE_COOKIE}=${cookieValue}; path=/pos; max-age=31536000; samesite=lax`;
  } catch {
    // Sin espacio o sin almacenamiento: se baja completo cada vez, como antes.
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

export function PosCatalog({
  orgId,
  branchId,
  initialProducts,
  ...screenProps
}: Omit<ComponentProps<typeof PosScreen>, "products"> & {
  branchId: string | null;
  /** Catálogo que manda el servidor la primera vez en este navegador (sin copia local). */
  initialProducts: ProductLite[] | null;
}) {
  const cacheKey = `pesito-pos-catalog:v1:${orgId}:${branchId ?? "all"}`;
  // Lo que el navegador ya tenía guardado se muestra al instante (el servidor
  // renderiza sin copia y, al hidratar, se pasa a la copia sin esperar a la red).
  const rawCache = useSyncExternalStore(
    subscribeStorage,
    () => readRaw(cacheKey),
    () => null
  );
  const cachedProducts = useMemo(() => parseCache(rawCache)?.products ?? null, [rawCache]);
  // Lo que llegó de la base (o del servidor) en esta visita, con el stock al día.
  const [fresh, setFresh] = useState<ProductLite[] | null>(initialProducts);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const products = fresh ?? cachedProducts;
  const supabase = useMemo(() => createClient(), []);
  const lastSync = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let lastError = "";
    const cookieValue = posCacheCookieValue(orgId, branchId);

    async function fetchCatalog(since: string | null): Promise<CatalogResponse | null> {
      // Si la consulta directa a la base no responde en unos segundos (red,
      // bloqueo del navegador, sesión trabada), se la da por perdida.
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

    function build(base: CachedProduct[], res: CatalogResponse): ProductLite[] | null {
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
      return view;
    }

    type Result = { view: ProductLite[]; syncedAt: string };

    // Camino normal: la base, directo desde el navegador (sólo lo que cambió si hay copia).
    async function viaDatabase(cached: Cache | null): Promise<Result | null> {
      let res = cached
        ? await fetchCatalog(new Date(new Date(cached.syncedAt).getTime() - OVERLAP_MS).toISOString())
        : await fetchCatalog(null);
      let view = res ? build(cached?.products ?? [], res) : null;
      if (res && !view && cached) {
        // La copia quedó incompleta: bajarla entera.
        res = await fetchCatalog(null);
        view = res ? build([], res) : null;
      }
      return res && view ? { view, syncedAt: res.now } : null;
    }

    // Respaldo: el servidor. Sólo si no hay copia y la base tarda o falla.
    async function viaServer(): Promise<Result | null> {
      const fallback = await Promise.race([
        loadCatalogFallback(branchId),
        new Promise<{ products?: CatalogProduct[]; error?: string }>((resolve) =>
          setTimeout(() => resolve({ error: "El servidor tardó demasiado en responder." }), FALLBACK_TIMEOUT_MS)
        ),
      ]);
      if (!fallback.products) {
        lastError = fallback.error ?? lastError;
        return null;
      }
      const view = [...fallback.products].sort(byName);
      // Un minuto de margen por si el reloj de este equipo está adelantado.
      return { view, syncedAt: new Date(Date.now() - 60_000).toISOString() };
    }

    async function sync() {
      if (syncing) return;
      syncing = true;
      try {
        const cached = readCache(cacheKey);
        let result: Result | null;
        if (cached) {
          // Con copia ya se está mostrando: se actualiza en segundo plano y,
          // si la base no responde, se queda lo que había.
          result = await viaDatabase(cached);
        } else {
          // Sin copia (primera vez en este equipo): la base y, si tarda más de
          // 2,5 s, también el servidor; gana el primero que responda.
          result = await new Promise<Result | null>((resolve) => {
            let pending = 2;
            let done = false;
            const finish = (r: Result | null) => {
              if (done) return;
              if (r) {
                done = true;
                resolve(r);
              } else if (--pending === 0) {
                resolve(null);
              }
            };
            void viaDatabase(null).then(finish, () => finish(null));
            setTimeout(() => {
              if (!done) void viaServer().then(finish, () => finish(null));
              else finish(null);
            }, 2_500);
          });
        }
        if (cancelled) return;
        if (result) {
          writeCache(cacheKey, { syncedAt: result.syncedAt, products: result.view }, cookieValue);
          lastSync.current = Date.now();
          setFailure(null);
          setFresh(result.view);
        } else if (!cached) {
          setFailure(lastError || "No pudimos cargar los productos.");
        }
      } catch (e) {
        console.error("Catálogo del POS:", e);
        if (!cancelled && !readCache(cacheKey)) {
          setFailure(e instanceof Error ? e.message : "No pudimos cargar los productos.");
        }
      } finally {
        syncing = false;
      }
    }

    if (initialProducts && !readCache(cacheKey)) {
      // Llegó con la página: se guarda como copia (un minuto de margen por el reloj).
      writeCache(
        cacheKey,
        { syncedAt: new Date(Date.now() - 60_000).toISOString(), products: initialProducts },
        cookieValue
      );
      lastSync.current = Date.now();
    } else {
      void sync();
    }
    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastSync.current > RESYNC_MS) void sync();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, orgId, branchId, cacheKey, attempt, initialProducts]);

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
