"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { generateInternalCode } from "@/lib/barcode";

const MAX_PER_CALL = 500;

/** Todos los códigos de barras que ya usa el negocio (productos activos o no). */
async function takenCodes(orgId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const rows = await fetchAll((from, to) =>
    supabase.from("products").select("id, barcode").eq("org_id", orgId).order("id").range(from, to)
  );
  const taken = new Set<string>();
  for (const row of rows) {
    if (row.barcode) taken.add(row.barcode.trim());
  }
  return taken;
}

/** Un código nuevo y libre para cargar en el formulario de un producto (no lo guarda). */
export async function generateBarcode(): Promise<{ error?: string; code?: string }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "barcodeLabels")) {
    return { error: featureLockedMessage("barcodeLabels") };
  }
  return { code: generateInternalCode(await takenCodes(organization.id)) };
}

/**
 * Les pone un código de barras propio (empieza con 200, no se repite) a los
 * productos indicados que todavía no tienen uno. Los que ya tienen código no
 * se tocan. Devuelve el código de cada producto que quedó con uno nuevo.
 */
export async function assignBarcodes(
  productIds: string[]
): Promise<{ error?: string; codes?: Record<string, string> }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "barcodeLabels")) {
    return { error: featureLockedMessage("barcodeLabels") };
  }
  const ids = [...new Set(productIds)].slice(0, MAX_PER_CALL);
  if (ids.length === 0) return { codes: {} };

  const taken = await takenCodes(organization.id);
  const { data: targets, error } = await supabase
    .from("products")
    .select("id, barcode")
    .eq("org_id", organization.id)
    .in("id", ids.slice(0, 100));
  // El .in() se hace en tandas para no pasarse del largo de la URL.
  const rows = [...(targets ?? [])];
  for (let i = 100; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("products")
      .select("id, barcode")
      .eq("org_id", organization.id)
      .in("id", ids.slice(i, i + 100));
    rows.push(...(data ?? []));
  }
  if (error) return { error: "No pudimos leer los productos." };

  const missing = rows.filter((r) => !r.barcode || !r.barcode.trim());
  const codes: Record<string, string> = {};
  for (const row of missing) {
    const code = generateInternalCode(taken);
    taken.add(code);
    codes[row.id] = code;
  }

  const entries = Object.entries(codes);
  let failed = 0;
  for (let i = 0; i < entries.length; i += 20) {
    await Promise.all(
      entries.slice(i, i + 20).map(async ([id, code]) => {
        const { error: updateError } = await supabase
          .from("products")
          .update({ barcode: code })
          .eq("id", id)
          .eq("org_id", organization.id);
        if (updateError) {
          failed++;
          delete codes[id];
        }
      })
    );
  }

  revalidatePath("/productos");
  revalidatePath("/pos");
  if (failed > 0) {
    return { error: `No pudimos guardar el código de ${failed} producto${failed === 1 ? "" : "s"}.`, codes };
  }
  return { codes };
}
