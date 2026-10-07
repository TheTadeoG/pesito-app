"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { createClient } from "@/lib/supabase/client";
import { PosScreen } from "@/app/(dashboard)/pos/pos-screen";
import { loadCatalogFallback } from "@/app/(dashboard)/pos/actions";
import { posCacheCookieValue } from "@/lib/pos-cache-cookie";
import {
  mergeDelta,
  mergeFull,
  type CatalogItem,
  type ChangedRow,
  type StockPairs,
} from "@/lib/pos-catalog-merge";
import {
  COPY_VERSION,
  loadCopy,
  parseCopy,
  readLocalRaw,
  readMeta,
  saveCopy,
  touchChecked,
  type CatalogCopy,
} from "@/lib/pos-catalog-store";

// Catálogo del POS con copia en el navegador (migraciones 0064 y 0066).
//
//   * La copia se muestra al instante (localStorage; si el catálogo es muy grande
//     y no entra, IndexedDB) y se actualiza en segundo plano.
//   * Con copia: se pide a la base sólo lo que cambió (pos_catalog_delta) y se
//     mezcla. Una vez por día, o ante cualquier duda, se baja completo
//     (pos_catalog). Si nada de eso responde, se queda lo que había.
//   * Sin copia (primera vez en este navegador): los productos vienen con la
//     página; si no vinieron, base y servidor en paralelo.
//   * No se vuelve a preguntar si la última consulta fue hace menos de un minuto.
//   * Ante cualquier error el camino es siempre el de antes: bajar todo.
// La mezcla está en pos-catalog-merge.ts (con pruebas); guardar, en pos-catalog-store.ts.

type Result = { view: CatalogItem[]; syncedAt: string; full: boolean; changed: boolean };

interface FullResponse {
  now: string;
  changed: ChangedRow[];
  stock: StockPairs;
}
interface DeltaResponse extends FullResponse {
  mode: "delta";
  active_count: number;
}

// Tiempo máximo de espera de la consulta directa y del respaldo del servidor.
const RPC_TIMEOUT_MS = 6_000;
const FALLBACK_TIMEOUT_MS = 25_000;
// Superposición al pedir cambios: cubre transacciones que terminaron justo después.
const OVERLAP_MS = 60_000;
// Cada cuánto se baja el catálogo completo aunque el delta funcione.
const FULL_REFRESH_MS = 24 * 60 * 60_000;
// No se vuelve a consultar si la última consulta fue hace menos de esto.
const MIN_RECHECK_MS = 60_000;
// Al volver a la pestaña, se actualiza si pasó más de esto.
const RESYNC_MS = 2 * 60_000;

const collator = new Intl.Collator("es");

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

const isArray = Array.isArray;

export function PosCatalog({
  orgId,
  branchId,
  initialProducts,
  ...screenProps
}: Omit<ComponentProps<typeof PosScreen>, "products"> & {
  branchId: string | null;
  /** Catálogo que manda el servidor la primera vez en este navegador (sin copia local). */
  initialProducts: CatalogItem[] | null;
}) {
  const cacheKey = `pesito-pos-catalog:v${COPY_VERSION}:${orgId}:${branchId ?? "all"}`;
  // La copia de localStorage se muestra al instante (el servidor renderiza sin
  // copia y, al hidratar, se pasa a la copia sin esperar a la red).
  const rawCopy = useSyncExternalStore(
    subscribeStorage,
    () => readLocalRaw(cacheKey),
    () => null
  );
  const localProducts = useMemo(() => parseCopy(rawCopy)?.products ?? null, [rawCopy]);
  // Lo que llegó en esta visita (con la página, de IndexedDB o de la base).
  const [loaded, setLoaded] = useState<CatalogItem[] | null>(initialProducts);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const products = loaded ?? localProducts;
  const supabase = useMemo(() => createClient(), []);
  const lastSync = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let lastError = "";
    const cookieValue = posCacheCookieValue(orgId, branchId);

    // Copia de la versión anterior (v1): ya no se usa.
    try {
      window.localStorage.removeItem(`pesito-pos-catalog:v1:${orgId}:${branchId ?? "all"}`);
    } catch {
      // ignore
    }

    async function rpc(name: "pos_catalog" | "pos_catalog_delta", since: string | null): Promise<unknown> {
      const call =
        name === "pos_catalog"
          ? supabase.rpc("pos_catalog", { p_org_id: orgId, p_branch_id: branchId, p_since: since })
          : supabase.rpc("pos_catalog_delta", { p_org_id: orgId, p_branch_id: branchId, p_since: since as string });
      const answer = await Promise.race([
        call,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), RPC_TIMEOUT_MS)),
      ]);
      if (answer === "timeout") {
        console.error(`${name}: sin respuesta en ${RPC_TIMEOUT_MS} ms`);
        lastError = "la base no respondió a tiempo";
        return null;
      }
      if (answer.error || !answer.data) {
        console.error(`${name} falló:`, answer.error?.message ?? "sin datos");
        lastError = answer.error?.message ?? "sin datos";
        return null;
      }
      return answer.data;
    }

    // Catálogo completo desde la base (pos_catalog).
    async function fullFromDatabase(base: CatalogItem[]): Promise<Result | null> {
      const data = (await rpc("pos_catalog", null)) as FullResponse | null;
      if (!data || !isArray(data.changed) || !isArray(data.stock) || typeof data.now !== "string") return null;
      const view = mergeFull(base, data.changed, data.stock);
      return view ? { view, syncedAt: data.now, full: true, changed: true } : null;
    }

    // Sólo lo que cambió desde la última sincronización (pos_catalog_delta).
    async function deltaFromDatabase(copy: CatalogCopy): Promise<Result | null> {
      const since = new Date(new Date(copy.syncedAt).getTime() - OVERLAP_MS).toISOString();
      const data = (await rpc("pos_catalog_delta", since)) as DeltaResponse | null;
      if (
        !data ||
        data.mode !== "delta" ||
        !isArray(data.changed) ||
        !isArray(data.stock) ||
        typeof data.now !== "string" ||
        typeof data.active_count !== "number"
      ) {
        return null;
      }
      // Sin cambios: la copia sigue igual.
      if (data.changed.length === 0 && data.stock.length === 0 && data.active_count === copy.products.length) {
        return { view: copy.products, syncedAt: copy.syncedAt, full: false, changed: false };
      }
      const view = mergeDelta(copy.products, data.changed, data.stock, data.active_count);
      return view ? { view, syncedAt: data.now, full: false, changed: true } : null;
    }

    // Respaldo: el servidor (catálogo completo, como antes de la copia local).
    async function viaServer(): Promise<Result | null> {
      const fallback = await Promise.race([
        loadCatalogFallback(branchId),
        new Promise<{ products?: CatalogItem[]; error?: string }>((resolve) =>
          setTimeout(() => resolve({ error: "El servidor tardó demasiado en responder." }), FALLBACK_TIMEOUT_MS)
        ),
      ]);
      if (!fallback.products) {
        lastError = fallback.error ?? lastError;
        return null;
      }
      const view = [...fallback.products].sort((a, b) => collator.compare(a.name, b.name));
      // Un minuto de margen por si el reloj de este equipo está adelantado.
      return { view, syncedAt: new Date(Date.now() - 60_000).toISOString(), full: true, changed: true };
    }

    async function sync() {
      if (syncing) return;
      syncing = true;
      try {
        const copy = await loadCopy(cacheKey);
        if (cancelled) return;
        if (copy) {
          // Si la copia estaba en IndexedDB, se muestra ya.
          setLoaded((current) => current ?? copy.products);
          const meta = readMeta(cacheKey);
          if (meta && Date.now() - meta.checkedAt < MIN_RECHECK_MS) return; // se acaba de consultar
        }

        let result: Result | null;
        if (copy) {
          const fullDue = Date.now() - new Date(copy.fullAt).getTime() > FULL_REFRESH_MS;
          result = fullDue ? null : await deltaFromDatabase(copy);
          // Algo no cuadró (o toca el completo del día): se baja todo.
          if (!result) result = await fullFromDatabase(copy.products);
        } else {
          // Sin copia: la base y, si tarda más de 2,5 s, también el servidor.
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
            void fullFromDatabase([]).then(finish, () => finish(null));
            setTimeout(() => {
              if (!done) void viaServer().then(finish, () => finish(null));
              else finish(null);
            }, 2_500);
          });
        }
        if (cancelled) return;
        if (result) {
          lastSync.current = Date.now();
          setFailure(null);
          if (result.changed) {
            setLoaded(result.view);
            await saveCopy(
              cacheKey,
              {
                v: COPY_VERSION,
                syncedAt: result.syncedAt,
                fullAt: result.full || !copy ? new Date().toISOString() : copy.fullAt,
                products: result.view,
              },
              cookieValue
            );
          } else {
            touchChecked(cacheKey);
          }
        } else if (!copy) {
          setFailure(lastError || "No pudimos cargar los productos.");
        }
        // Con copia y sin respuesta: se queda lo que había, sin avisar.
      } catch (e) {
        console.error("Catálogo del POS:", e);
        if (!cancelled && !readMeta(cacheKey)) {
          setFailure(e instanceof Error ? e.message : "No pudimos cargar los productos.");
        }
      } finally {
        syncing = false;
      }
    }

    if (initialProducts && !readMeta(cacheKey)) {
      // Primera vez en este navegador: los productos llegaron con la página.
      // Se guardan como copia (un minuto de margen por el reloj de este equipo).
      void saveCopy(
        cacheKey,
        {
          v: COPY_VERSION,
          syncedAt: new Date(Date.now() - 60_000).toISOString(),
          fullAt: new Date().toISOString(),
          products: initialProducts,
        },
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
