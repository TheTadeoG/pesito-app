import type { CatalogItem } from "@/lib/pos-catalog-merge";
import { POS_CACHE_COOKIE } from "@/lib/pos-cache-cookie";

// Copia local del catálogo del POS (sólo navegador).
//   * La copia grande va en localStorage si entra (lectura instantánea) y, si no
//     entra (catálogos de miles de productos), en IndexedDB.
//   * Un resumen chico ("meta") siempre va en localStorage: dice cuándo se
//     sincronizó, cuándo se bajó completa y dónde está la copia.
//   * La cookie que le avisa al servidor "ya tengo copia" se pone SÓLO después
//     de comprobar que se guardó. Si guardar falla, el servidor sigue mandando
//     los productos con la página, como antes de la copia local.
// Nada de acá puede romper el POS: todo devuelve null / false si falla.

export const COPY_VERSION = 2;

export interface CatalogCopy {
  v: number;
  /** Hora del servidor de la última sincronización (para pedir sólo lo nuevo). */
  syncedAt: string;
  /** Última vez que se bajó el catálogo completo. */
  fullAt: string;
  products: CatalogItem[];
}

export interface CopyMeta {
  v: number;
  syncedAt: string;
  fullAt: string;
  /** Última vez que se consultó a la base con éxito (hora de este equipo). */
  checkedAt: number;
  where: "ls" | "idb";
}

const metaKey = (key: string) => `${key}:meta`;
const DB_NAME = "pesito-pos";
const STORE = "catalogo";

export function readMeta(key: string): CopyMeta | null {
  try {
    const raw = window.localStorage.getItem(metaKey(key));
    if (!raw) return null;
    const meta = JSON.parse(raw) as CopyMeta;
    return meta && meta.v === COPY_VERSION && typeof meta.syncedAt === "string" ? meta : null;
  } catch {
    return null;
  }
}

function writeMeta(key: string, meta: CopyMeta): boolean {
  try {
    window.localStorage.setItem(metaKey(key), JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

/** Marca que la consulta salió bien (sin reescribir la copia). */
export function touchChecked(key: string) {
  const meta = readMeta(key);
  if (meta) writeMeta(key, { ...meta, checkedAt: Date.now() });
}

export function parseCopy(raw: string | null): CatalogCopy | null {
  if (!raw) return null;
  try {
    const copy = JSON.parse(raw) as CatalogCopy;
    return copy && copy.v === COPY_VERSION && Array.isArray(copy.products) && typeof copy.syncedAt === "string"
      ? copy
      : null;
  } catch {
    return null;
  }
}

export function readLocalRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => {
        db.close();
        resolve(request.result ?? null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      // Se da por guardado recién cuando la transacción termina.
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/** Lee la copia: primero localStorage, después IndexedDB. null si no hay o está dañada. */
export async function loadCopy(key: string): Promise<CatalogCopy | null> {
  const meta = readMeta(key);
  if (!meta) return null;
  const copy = meta.where === "idb" ? await idbGet(key) : parseCopy(readLocalRaw(key));
  const valid = copy && typeof copy === "object" ? (copy as CatalogCopy) : null;
  if (!valid || valid.v !== COPY_VERSION || !Array.isArray(valid.products)) return null;
  return valid;
}

/**
 * Guarda la copia (localStorage si entra, si no IndexedDB). Sólo si se guardó de
 * verdad pone la cookie que avisa al servidor. Devuelve si se pudo guardar.
 */
export async function saveCopy(key: string, copy: CatalogCopy, cookieValue: string): Promise<boolean> {
  let where: "ls" | "idb" | null = null;
  try {
    window.localStorage.setItem(key, JSON.stringify(copy));
    where = "ls";
  } catch {
    // No entra en localStorage (catálogo grande): se prueba IndexedDB.
    if (await idbSet(key, copy)) {
      where = "idb";
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }
  if (!where) return false;
  const saved = writeMeta(key, {
    v: COPY_VERSION,
    syncedAt: copy.syncedAt,
    fullAt: copy.fullAt,
    checkedAt: Date.now(),
    where,
  });
  if (!saved) return false;
  try {
    document.cookie = `${POS_CACHE_COOKIE}=${cookieValue}; path=/pos; max-age=31536000; samesite=lax`;
  } catch {
    // ignore
  }
  return true;
}
