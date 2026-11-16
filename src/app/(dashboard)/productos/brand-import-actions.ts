"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { normalizeText } from "@/lib/product-import";
import { BRAND_IMPORT_MAX_ROWS, type BrandImportRow } from "@/lib/brand-import";

export interface BrandImportResult {
  error?: string;
  created: number;
  /** Ya existían con ese nombre (no se tocan). */
  skipped: number;
  problems: { line: number; message: string }[];
}

// Carga marcas nuevas desde la planilla (leída en el navegador). Las que ya existen se dejan como están.
export async function importBrands(rows: BrandImportRow[]): Promise<BrandImportResult> {
  const result: BrandImportResult = { created: 0, skipped: 0, problems: [] };
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { ...result, error: "Sólo quien administra el negocio puede cargar marcas de forma masiva." };
  if (!Array.isArray(rows) || rows.length === 0) return result;
  if (rows.length > BRAND_IMPORT_MAX_ROWS) return { ...result, error: "La planilla tiene demasiadas marcas. Dividila en varios archivos." };

  const supabase = await createClient();
  const existing = await fetchAll((from, to) =>
    supabase.from("brands").select("id, name").eq("org_id", organization.id).order("id").range(from, to)
  );
  const known = new Set(existing.map((b) => normalizeText(b.name)));

  const fresh: { line: number; name: string }[] = [];
  for (const raw of rows) {
    const name = String(raw.name ?? "").trim();
    const line = Number(raw.line) || 0;
    if (!name || name.length > 80) {
      result.problems.push({ line, message: "Los datos de esta fila no son válidos." });
      continue;
    }
    const key = normalizeText(name);
    if (known.has(key)) {
      result.skipped++;
      continue;
    }
    known.add(key);
    fresh.push({ line, name });
  }

  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const { error } = await supabase.from("brands").insert(chunk.map((c) => ({ org_id: organization.id, name: c.name })));
    if (!error) {
      result.created += chunk.length;
      continue;
    }
    for (const c of chunk) {
      const { error: rowError } = await supabase.from("brands").insert({ org_id: organization.id, name: c.name });
      if (rowError) result.problems.push({ line: c.line, message: `“${c.name}”: no pudimos guardarla.` });
      else result.created++;
    }
  }

  revalidatePath("/productos");
  return result;
}
