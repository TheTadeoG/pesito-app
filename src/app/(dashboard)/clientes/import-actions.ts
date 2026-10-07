"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { getSubscription } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/rate-limit";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { normalizeText } from "@/lib/product-import";
import {
  CUSTOMER_IMPORT_CHUNK_SIZE,
  CUSTOMER_UPDATE_FIELDS,
  buildCustomerIndex,
  matchCustomer,
  normalizeInvoiceType,
  type CustomerImportRow,
  type CustomerUpdateField,
} from "@/lib/customer-import";

export interface CustomerImportOptions {
  /** Si el cliente ya existe: qué datos se actualizan con los de la planilla. Vacío = se deja como está. */
  updateFields: CustomerUpdateField[];
  /** Última tanda del archivo: recién ahí se refresca la pantalla. */
  last: boolean;
}

export interface CustomerImportResult {
  error?: string;
  created: number;
  updated: number;
  /** Ya existían y no se tocaron. */
  skipped: number;
  problems: { line: number; message: string }[];
}

type CustomerPatch = Database["public"]["Tables"]["customers"]["Update"];

// Una tanda de la carga masiva de clientes. Se revalida todo acá (el
// navegador no es de fiar). Nunca se escribe el saldo (customers.balance):
// el fiado sólo cambia con ventas a fiado y cobros.
export async function importCustomersChunk(
  rows: CustomerImportRow[],
  options: CustomerImportOptions
): Promise<CustomerImportResult> {
  const result: CustomerImportResult = { created: 0, updated: 0, skipped: 0, problems: [] };
  const { organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  if (!isOrgAdmin(membership.role)) {
    return { ...result, error: "Sólo quien administra el negocio puede cargar clientes de forma masiva." };
  }
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "customerImport")) {
    return { ...result, error: featureLockedMessage("customerImport") };
  }
  if (!Array.isArray(rows) || rows.length === 0) return result;
  // Un archivo de 20.000 filas son ~40 tandas: 120 por hora deja varias cargas seguidas.
  const rateError = await checkRateLimit(supabase, organization.id, "import_clientes", 120, 3600);
  if (rateError) return { ...result, error: rateError };
  if (rows.length > CUSTOMER_IMPORT_CHUNK_SIZE) {
    return { ...result, error: "Llegaron demasiados clientes juntos. Probá de nuevo." };
  }

  const existing = await fetchAll((from, to) =>
    supabase
      .from("customers")
      .select("id, name, document, email, phone")
      .eq("org_id", organization.id)
      .order("id")
      .range(from, to)
  );
  const index = buildCustomerIndex(existing);
  const fields = new Set(
    (Array.isArray(options.updateFields) ? options.updateFields : []).filter((f) =>
      CUSTOMER_UPDATE_FIELDS.some((u) => u.field === f)
    )
  );

  const toCreate: { line: number; payload: Database["public"]["Tables"]["customers"]["Insert"] }[] = [];
  const toUpdate: { line: number; id: string; patch: CustomerPatch }[] = [];
  const touched = new Set<string>();

  for (const raw of rows) {
    const line = Number(raw.line) || 0;
    const name = String(raw.name ?? "").trim();
    const razonSocial = String(raw.razonSocial ?? "").trim();
    const phone = String(raw.phone ?? "").trim();
    const email = String(raw.email ?? "").trim();
    const document = String(raw.document ?? "").trim();
    const notes = String(raw.notes ?? "").trim();
    const invoice = raw.invoiceType ? normalizeInvoiceType(raw.invoiceType.replace("_", " ")) : null;

    if (
      !name ||
      name.length > 200 ||
      razonSocial.length > 200 ||
      phone.length > 60 ||
      email.length > 200 ||
      document.length > 60 ||
      notes.length > 1000 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      invoice === "invalid"
    ) {
      result.problems.push({ line, message: "Los datos de esta fila no son válidos." });
      continue;
    }

    const probe = { id: String(raw.id ?? ""), name, document, email, phone };
    const matchId = matchCustomer(probe, index);
    const nameKey = normalizeText(name);
    const ambiguousName = index.byName.has(nameKey) && index.byName.get(nameKey) === null;

    if (!matchId && ambiguousName && !probe.id && !document && !email && !phone) {
      result.skipped++;
      result.problems.push({
        line,
        message: `“${name}”: hay más de un cliente con ese nombre. Usá el ID, el documento, el mail o el teléfono para indicar cuál.`,
      });
      continue;
    }

    if (matchId) {
      // Repetido dentro del mismo archivo (o un cliente nuevo de esta misma tanda): el primero gana.
      if (touched.has(matchId) || matchId.startsWith("new:")) {
        result.skipped++;
        continue;
      }
      touched.add(matchId);
      if (fields.size === 0) {
        result.skipped++;
        continue;
      }
      const patch: CustomerPatch = {};
      if (fields.has("name")) patch.name = name;
      if (fields.has("razonSocial") && razonSocial) patch.razon_social = razonSocial;
      if (fields.has("phone") && phone) patch.phone = phone;
      if (fields.has("email") && email) patch.email = email;
      if (fields.has("document") && document) patch.document = document;
      if (fields.has("notes") && notes) patch.notes = notes;
      if (fields.has("invoiceType") && invoice) patch.invoice_type = invoice;
      if (Object.keys(patch).length === 0) {
        result.skipped++;
        continue;
      }
      toUpdate.push({ line, id: matchId, patch });
      continue;
    }

    // Cliente nuevo. Se anota en el índice para detectar repetidos del mismo archivo.
    const tempId = `new:${line}`;
    index.byId.add(tempId);
    if (document.replace(/\D/g, "").length >= 6) index.byDocument.set(document.replace(/\D/g, ""), tempId);
    if (email) index.byEmail.set(email.toLowerCase(), tempId);
    if (phone.replace(/\D/g, "").length >= 8) index.byPhone.set(phone.replace(/\D/g, "").slice(-10), tempId);
    index.byName.set(nameKey, index.byName.has(nameKey) ? null : tempId);

    toCreate.push({
      line,
      payload: {
        org_id: organization.id,
        name,
        razon_social: razonSocial || null,
        phone: phone || null,
        email: email || null,
        document: document || null,
        notes: notes || null,
        invoice_type: invoice ?? "consumidor_final",
      },
    });
  }

  if (toCreate.length > 0) {
    const { error } = await supabase.from("customers").insert(toCreate.map((c) => c.payload));
    if (!error) {
      result.created = toCreate.length;
    } else {
      // Alguna fila falló: una por una para saber cuál (y guardar el resto).
      for (const c of toCreate) {
        const { error: rowError } = await supabase.from("customers").insert(c.payload);
        if (rowError) {
          result.problems.push({ line: c.line, message: `“${c.payload.name}”: no pudimos guardarlo.` });
        } else {
          result.created++;
        }
      }
    }
  }

  for (let i = 0; i < toUpdate.length; i += 10) {
    await Promise.all(
      toUpdate.slice(i, i + 10).map(async ({ line, id, patch }) => {
        const { error } = await supabase
          .from("customers")
          .update(patch)
          .eq("id", id)
          .eq("org_id", organization.id);
        if (error) result.problems.push({ line, message: "No pudimos actualizar un cliente que ya existía." });
        else result.updated++;
      })
    );
  }

  if (options.last) {
    revalidatePath("/clientes");
    revalidatePath("/pos");
  }

  return result;
}
