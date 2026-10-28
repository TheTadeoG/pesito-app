import { randomUUID } from "node:crypto";
import { ArcaLockTimeoutError, type ArcaStore } from "facturas";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const LOCK_TTL_MS = 120_000;
const LOCK_WAIT_MS = 30_000;
const POLL_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Almacén del SDK en la base de Pesito (tablas arca_store y arca_locks, sólo clave de servicio):
 * guarda las reservas de números (para que un reintento no emita otra factura), los tickets de ARCA
 * (cifrados por el SDK) y coordina la numeración entre procesos con un bloqueo por punto de venta.
 */
export function createSupabaseArcaStore(admin: Admin): ArcaStore {
  return {
    async get(key) {
      const { data, error } = await admin.from("arca_store").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(`arca_store.get: ${error.message}`);
      return data?.value ?? null;
    },
    async set(key, value) {
      const { error } = await admin.from("arca_store").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw new Error(`arca_store.set: ${error.message}`);
    },
    async add(key, value) {
      const { data, error } = await admin.rpc("arca_store_add", { p_key: key, p_value: value });
      if (error) throw new Error(`arca_store.add: ${error.message}`);
      return data === true;
    },
    async delete(key) {
      const { error } = await admin.from("arca_store").delete().eq("key", key);
      if (error) throw new Error(`arca_store.delete: ${error.message}`);
    },
    async withLock(key, fn, options) {
      const owner = randomUUID();
      const deadline = Date.now() + LOCK_WAIT_MS;
      for (;;) {
        if (options?.signal?.aborted) throw new ArcaLockTimeoutError("Se canceló la espera del bloqueo.", { reason: "aborted" });
        const { data, error } = await admin.rpc("arca_lock_acquire", { p_key: key, p_owner: owner, p_ttl_ms: LOCK_TTL_MS });
        if (error) throw new Error(`arca_lock: ${error.message}`);
        if (data === true) break;
        if (Date.now() > deadline) throw new ArcaLockTimeoutError("Otro proceso está emitiendo con este punto de venta.", { reason: "held" });
        await sleep(POLL_MS);
      }
      try {
        return await fn();
      } finally {
        await admin.rpc("arca_lock_release", { p_key: key, p_owner: owner });
      }
    },
  };
}
