"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { normalizeText } from "@/lib/product-import";
import { SUPPLIER_IMPORT_MAX_ROWS, type SupplierImportRow } from "@/lib/supplier-import";

export interface SupplierImportResult {
  error?: string;
  created: number;
  /** Ya existían con ese nombre (no se tocan). */
  skipped: number;
  problems: { line: number; message: string }[];
}

// Carga proveedores nuevos desde la planilla (leída en el navegador). Los que ya existen por nombre se dejan como están.
export async function importSuppliers(rows: SupplierImportRow[]): Promise<SupplierImportResult> {
  const result: SupplierImportResult = { created: 0, skipped: 0, problems: [] };
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { ...result, error: "Sólo quien administra el negocio puede cargar proveedores de forma masiva." };
  if (!Array.isArray(rows) || rows.length === 0) return result;
  if (rows.length > SUPPLIER_IMPORT_MAX_ROWS) return { ...result, error: "La planilla tiene demasiados proveedores. Dividila en varios archivos." };

  const supabase = await createClient();
  const existing = await fetchAll((from, to) =>
    supabase.from("suppliers").select("id, name").eq("org_id", organization.id).order("id").range(from, to)
  );
  const known = new Set(existing.map((s) => normalizeText(s.name)));

  const fresh: { line: number; payload: { org_id: string; name: string; phone: string | null; email: string | null; notes: string | null; lead_time_days?: number } }[] = [];
  for (const raw of rows) {
    const name = String(raw.name ?? "").trim();
    const line = Number(raw.line) || 0;
    if (!name || name.length > 120) {
      result.problems.push({ line, message: "Los datos de esta fila no son válidos." });
      continue;
    }
    const key = normalizeText(name);
    if (known.has(key)) {
      result.skipped++;
      continue;
    }
    known.add(key);
    const lead = raw.leadTimeDays === null || raw.leadTimeDays === undefined ? null : Number(raw.leadTimeDays);
    fresh.push({
      line,
      payload: {
        org_id: organization.id,
        name,
        phone: String(raw.phone ?? "").trim().slice(0, 40) || null,
        email: String(raw.email ?? "").trim().slice(0, 200) || null,
        notes: String(raw.notes ?? "").trim().slice(0, 500) || null,
        // Sólo se manda con un valor (sin la migración 0052 guardar sigue andando).
        ...(lead !== null && Number.isInteger(lead) && lead >= 0 && lead <= 90 ? { lead_time_days: lead } : {}),
      },
    });
  }

  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const { error } = await supabase.from("suppliers").insert(chunk.map((c) => c.payload));
    if (!error) {
      result.created += chunk.length;
      continue;
    }
    // Alguna fila falló: una por una para saber cuál y guardar el resto.
    for (const c of chunk) {
      const { error: rowError } = await supabase.from("suppliers").insert(c.payload);
      if (rowError) result.problems.push({ line: c.line, message: `“${c.payload.name}”: no pudimos guardarlo.` });
      else result.created++;
    }
  }

  revalidatePath("/proveedores");
  revalidatePath("/productos");
  return result;
}

export interface SupplierExportRow {
  name: string;
  phone: string;
  email: string;
  notes: string;
  leadTimeDays: number | null;
  paymentTermsDays: number | null;
  minOrderAmount: number | null;
  deliveryDays: number[];
}

// Todos los proveedores del negocio para bajarlos a Excel (se piden recién al tocar el botón).
export async function getSuppliersForExport(): Promise<{ rows?: SupplierExportRow[]; error?: string }> {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  try {
    const rows = await fetchAll((from, to) =>
      supabase.from("suppliers").select("*").eq("org_id", organization.id).order("name").order("id").range(from, to)
    );
    return {
      rows: rows.map((r) => ({
        name: r.name,
        phone: r.phone ?? "",
        email: r.email ?? "",
        notes: r.notes ?? "",
        leadTimeDays: r.lead_time_days ?? null,
        paymentTermsDays: r.payment_terms_days ?? null,
        minOrderAmount: r.min_order_amount === null || r.min_order_amount === undefined ? null : Number(r.min_order_amount),
        deliveryDays: r.delivery_days ?? [],
      })),
    };
  } catch {
    return { error: "No pudimos cargar los proveedores. Probá de nuevo." };
  }
}
