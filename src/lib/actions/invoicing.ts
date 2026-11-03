"use server";

import { revalidatePath } from "next/cache";
import { isOrgAdmin } from "@/lib/roles";
import { getInvoiceUsage } from "@/lib/invoice-usage";
import { formatCount } from "@/lib/invoice-packs";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { getOrgArca } from "@/lib/arca/client";
import { arcaMessage } from "@/lib/arca/errors";
import { buildStoredDocument } from "@/lib/arca/voucher-doc";
import { invoiceLines, receiverFromDocument, saleConditionLabel } from "@/lib/arca/sale-invoice";
import { autoInvoiceMethodIds } from "@/lib/arca/auto-invoice";
import type { Json } from "@/lib/database.types";
import type { IssuedVoucher } from "facturas";
import { voucherBadge } from "@/lib/sale-vouchers";

export interface InvoiceResult {
  error?: string;
  /** authorized: ya está emitida (puede ser de antes). pending: ARCA no confirmó, se reintenta sin duplicar. */
  status?: "authorized" | "pending";
  voucherId?: string;
  /** «Factura C» (o «Factura C (prueba)»): lo que rotulan las listas. */
  badge?: string;
  /** Se acabó el cupo de facturas del mes: la venta sigue como comprobante X (no fiscal). */
  outOfQuota?: boolean;
}

/** Lo que necesita el POS para decidir si factura solo: sólo el servidor emite. */
export interface InvoicingConfig {
  enabled: boolean;
  autoMethods: string[];
}

/** Configuración de facturación para el POS (una fila chica; sin secretos). */
export async function getInvoicingConfig(orgId: string): Promise<InvoicingConfig> {
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, orgId);
  if (!canUse(subscription, "electronicInvoicing")) return { enabled: false, autoMethods: [] };
  const admin = createAdminClient();
  const { data: settings } = await admin.from("arca_settings").select("enabled, active_environment, auto_invoice_methods").eq("org_id", orgId).maybeSingle();
  if (!settings?.enabled) return { enabled: false, autoMethods: [] };
  const { data: cred } = await admin
    .from("arca_credentials")
    .select("verified_at")
    .eq("org_id", orgId)
    .eq("environment", settings.active_environment)
    .maybeSingle();
  if (!cred?.verified_at) return { enabled: false, autoMethods: [] };
  return { enabled: true, autoMethods: (settings.auto_invoice_methods ?? []).filter((m) => autoInvoiceMethodIds.includes(m)) };
}

/**
 * Emite (o recupera) la factura de una venta. Es segura de repetir: una venta nunca genera dos facturas.
 *  - ya hay una autorizada → la devuelve;
 *  - un intento anterior quedó sin respuesta de ARCA (indeterminado) → se le pregunta a ARCA por esa reserva
 *    (`recover`) antes de emitir nada nuevo;
 *  - un intento anterior fue rechazado → se emite de nuevo con otra clave (después de corregir lo que fallaba).
 * La venta ya está cobrada: si ARCA falla, la venta sigue y queda pendiente de facturar.
 */
export async function issueSaleInvoice(saleId: string): Promise<InvoiceResult> {
  const { userId, organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "electronicInvoicing")) return { error: featureLockedMessage("electronicInvoicing") };

  const { error: limited } = await supabase.rpc("rate_limit_hit", { p_org_id: organization.id, p_bucket: "arca_issue", p_max: 600, p_window_seconds: 3600 });
  if (limited) return { error: "Hiciste muchos intentos seguidos. Probá de nuevo en un rato." };

  const { data: sale } = await supabase
    .from("sales")
    .select("id, org_id, status, total, payment_method, customer_id, created_at")
    .eq("id", saleId)
    .eq("org_id", organization.id)
    .maybeSingle();
  if (!sale) return { error: "No encontramos la venta." };
  if (sale.status !== "completada") return { error: "La venta está anulada: no se puede facturar." };

  const admin = createAdminClient();
  const { data: settings } = await admin.from("arca_settings").select("enabled, active_environment, issuer_condition, legal_name, address, gross_income, activity_start").eq("org_id", organization.id).maybeSingle();
  if (!settings?.enabled) return { error: "La facturación está apagada. Activala en Ajustes → Facturación." };
  const environment = settings.active_environment;
  if (!settings.issuer_condition) return { error: "Falta tu condición frente al IVA en Ajustes → Facturación." };
  if (settings.issuer_condition === "responsable_inscripto") {
    return { error: "Las facturas A y B (Responsable Inscripto) todavía no están disponibles: necesitan el IVA de cada producto. Por ahora se factura como Monotributista o IVA exento (Factura C)." };
  }

  // Intentos anteriores de esta venta.
  const { data: previous } = await admin
    .from("arca_vouchers")
    .select("id, kind, status, idempotency_key, voucher_class")
    .eq("org_id", organization.id)
    .eq("sale_id", saleId)
    .eq("kind", "invoice")
    .eq("environment", environment)
    .order("created_at");
  const authorized = (previous ?? []).find((v) => v.status === "authorized");
  if (authorized) return { status: "authorized", voucherId: authorized.id, badge: voucherBadge(authorized.voucher_class, environment) };
  const open = (previous ?? []).find((v) => v.status === "indeterminate" || v.status === "conflict");

  // Cupo mensual de facturas (paquete). Sin cupo la venta sigue igual, como comprobante X: sólo no se emite la factura.
  if (!open && environment === "production") {
    const usage = await getInvoiceUsage(organization.id, subscription);
    if (usage.reached) {
      return {
        outOfQuota: true,
        error: usage.quota === 0
          ? "Tu plan no tiene un paquete de facturas: esta venta queda como comprobante X (no fiscal). Sumá un paquete en Planes para facturar."
          : `Usaste las ${formatCount(usage.quota)} facturas de este mes (las notas de crédito cuentan): esta venta queda como comprobante X (no fiscal). Sumá un paquete en Planes para seguir facturando; la podés facturar después.`,
      };
    }
  }

  const res = await getOrgArca(organization.id, environment);
  if ("error" in res) return { error: res.error };
  const { arca } = res;
  if (!arca.salesPoint) return { error: "Falta el punto de venta en Ajustes → Facturación." };

  const [{ data: items }, customerRes] = await Promise.all([
    supabase.from("sale_items").select("product_name, quantity, subtotal").eq("sale_id", saleId).order("id"),
    sale.customer_id ? supabase.from("customers").select("name, razon_social, document, document_type, address, city, postal_code, province").eq("id", sale.customer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const lines = invoiceLines((items ?? []).map((i) => ({ name: i.product_name, quantity: Number(i.quantity), subtotal: Number(i.subtotal) })), Number(sale.total));
  if (lines.length === 0) return { error: "La venta no tiene importe para facturar." };
  const customer = customerRes.data;
  const receiver = receiverFromDocument(customer?.document_type === "pasaporte" ? null : customer?.document);
  const sdkItems = lines.map((l) => ({ amount: l.amount, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }));

  // Misma venta, misma clave: el SDK no duplica. Un rechazo anterior (ya corregido) usa una clave nueva.
  const attempt = (previous ?? []).filter((v) => v.status === "rejected" || v.status === "error").length;
  const key = open?.idempotency_key ?? (attempt === 0 ? `sale-${saleId}` : `sale-${saleId}-r${attempt}`);

  try {
    const outcome = open
      ? await arca.client.recover(key)
      : await arca.client.issue(
          {
            issuer: arca.issuerCondition ?? settings.issuer_condition,
            salesPoint: arca.salesPoint,
            to: { condition: "consumidor_final", ...receiver },
            items: sdkItems,
          } as Parameters<typeof arca.client.issue>[0],
          { idempotencyKey: key }
        );

    const base = {
      org_id: organization.id,
      sale_id: saleId,
      environment,
      kind: "invoice" as const,
      idempotency_key: key,
      total_cents: Math.round(Number(sale.total) * 100),
      receiver: JSON.parse(JSON.stringify({ name: customer?.razon_social ?? customer?.name ?? null, ...receiver })) as Json,
      items: JSON.parse(JSON.stringify(lines)) as Json,
      created_by: userId,
    };

    if (outcome.kind !== "authorized") {
      const row = { ...base, status: outcome.kind === "rejected" ? ("rejected" as const) : ("indeterminate" as const), detail: JSON.parse(JSON.stringify({ kind: outcome.kind })) as Json };
      if (open) await admin.from("arca_vouchers").update({ detail: row.detail }).eq("id", open.id);
      else await admin.from("arca_vouchers").insert(row);
      if (outcome.kind === "rejected") {
        const reasons = outcome.issues.map((i) => i.message ?? i.code).filter(Boolean).join("; ");
        return { error: `ARCA rechazó la factura: ${reasons || "sin detalle"}` };
      }
      return { status: "pending", error: "ARCA todavía no confirmó la factura. La venta quedó cobrada; reintentá en un momento (no se duplica)." };
    }

    const v = outcome.voucher as IssuedVoucher;
    const built = buildStoredDocument({
      voucher: v,
      items: sdkItems as Parameters<typeof buildStoredDocument>[0]["items"],
      issuer: {
        legalName: settings.legal_name,
        address: settings.address,
        grossIncome: settings.gross_income,
        activityStart: settings.activity_start,
        condition: settings.issuer_condition,
        taxId: arca.taxId,
      },
      receiver: customer
        ? {
            name: customer.razon_social ?? customer.name,
            ...(customer.address ? { address: [customer.address, customer.city, customer.postal_code, customer.province].filter(Boolean).join(", ") } : {}),
          }
        : undefined,
      saleConditions: saleConditionLabel[sale.payment_method] ?? "Contado",
      observations: "observations" in outcome ? (outcome as { observations?: { code?: string | number }[] }).observations : undefined,
    });
    const fields = {
      status: "authorized" as const,
      sales_point: v.salesPoint,
      voucher_type: v.voucherType,
      voucher_class: v.voucherClass,
      number: v.number,
      cae: v.cae,
      cae_expiry: v.caeExpiry,
      qr: v.qr ?? null,
      detail: JSON.parse(JSON.stringify("document" in built ? { document: built.document } : { documentError: built.error })) as Json,
    };
    const saved = open
      ? await admin.from("arca_vouchers").update(fields).eq("id", open.id).select("id").single()
      : await admin.from("arca_vouchers").insert({ ...base, ...fields }).select("id").single();
    return { status: "authorized", voucherId: saved.data?.id, badge: voucherBadge(v.voucherClass, environment) };
  } catch (e) {
    return { error: arcaMessage(e) };
  }
}

export interface VoidInvoicedResult {
  error?: string;
}

/**
 * Anula una venta con factura electrónica: primero emite la nota de crédito por el total en ARCA y, recién
 * cuando ARCA la autoriza, anula la venta (stock, caja y cuenta del cliente) con su motivo. Es segura de repetir:
 *  - si la nota ya está autorizada, sólo falta anular la venta;
 *  - si ARCA no confirmó (indeterminado), se le pregunta por esa reserva antes de emitir otra.
 * Sólo dueño o administrador.
 */
export async function voidInvoicedSale(saleId: string, reason: string): Promise<VoidInvoicedResult> {
  const { userId, organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede anular ventas." };
  const cleanReason = reason.trim().slice(0, 300);
  if (cleanReason.length < 3) return { error: "Escribí el motivo de la anulación." };

  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "electronicInvoicing")) return { error: featureLockedMessage("electronicInvoicing") };
  const { error: limited } = await supabase.rpc("rate_limit_hit", { p_org_id: organization.id, p_bucket: "arca_issue", p_max: 600, p_window_seconds: 3600 });
  if (limited) return { error: "Hiciste muchos intentos seguidos. Probá de nuevo en un rato." };

  const { data: sale } = await supabase.from("sales").select("id, status, total").eq("id", saleId).eq("org_id", organization.id).maybeSingle();
  if (!sale) return { error: "No encontramos la venta." };
  if (sale.status === "anulada") return { error: "La venta ya está anulada." };

  const admin = createAdminClient();
  const { data: vouchers } = await admin
    .from("arca_vouchers")
    .select("id, kind, status, idempotency_key, environment, sales_point, voucher_type, voucher_class, number, items, receiver, detail, created_at")
    .eq("org_id", organization.id)
    .eq("sale_id", saleId)
    .order("created_at");
  const invoice = (vouchers ?? []).find((v) => v.kind === "invoice" && v.status === "authorized");
  const notes = (vouchers ?? []).filter((v) => v.kind === "credit_note");
  const noteAuthorized = notes.some((v) => v.status === "authorized");

  if (invoice && !noteAuthorized) {
    if (invoice.sales_point == null || invoice.voucher_type == null || invoice.number == null) return { error: "La factura de esta venta no tiene sus datos completos." };
    const res = await getOrgArca(organization.id, invoice.environment);
    if ("error" in res) return { error: res.error };
    const { arca } = res;
    const { data: settings } = await admin.from("arca_settings").select("issuer_condition, legal_name, address, gross_income, activity_start").eq("org_id", organization.id).maybeSingle();

    const open = notes.find((v) => v.status === "indeterminate" || v.status === "conflict");
    const attempt = notes.filter((v) => v.status === "rejected" || v.status === "error").length;
    const key = open?.idempotency_key ?? (attempt === 0 ? `nc-${saleId}` : `nc-${saleId}-r${attempt}`);

    try {
      const outcome = open
        ? await arca.client.recover(key)
        : await arca.client.issueCreditNote(
            { for: { salesPoint: invoice.sales_point, voucherType: invoice.voucher_type, number: invoice.number }, all: true } as Parameters<typeof arca.client.issueCreditNote>[0],
            { idempotencyKey: key }
          );
      const base = {
        org_id: organization.id,
        sale_id: saleId,
        environment: invoice.environment,
        kind: "credit_note" as const,
        idempotency_key: key,
        total_cents: Math.round(Number(sale.total) * 100),
        receiver: invoice.receiver as Json,
        items: invoice.items as Json,
        created_by: userId,
      };
      if (outcome.kind !== "authorized") {
        const detail = JSON.parse(JSON.stringify({ kind: outcome.kind })) as Json;
        const status = outcome.kind === "rejected" ? ("rejected" as const) : ("indeterminate" as const);
        if (open) await admin.from("arca_vouchers").update({ detail }).eq("id", open.id);
        else await admin.from("arca_vouchers").insert({ ...base, status, detail });
        if (outcome.kind === "rejected") {
          const reasons = outcome.issues.map((i) => i.message ?? i.code).filter(Boolean).join("; ");
          return { error: `ARCA rechazó la nota de crédito: ${reasons || "sin detalle"}. La venta no se anuló.` };
        }
        return { error: "ARCA todavía no confirmó la nota de crédito. La venta no se anuló; reintentá en un momento (no se duplica)." };
      }

      const v = outcome.voucher as IssuedVoucher;
      const storedItems = Array.isArray(invoice.items) ? (invoice.items as { description: string; quantity: number; amount: number; unitPrice: string }[]) : [];
      const built = buildStoredDocument({
        voucher: v,
        items: storedItems.map((l) => ({ amount: l.amount, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })) as Parameters<typeof buildStoredDocument>[0]["items"],
        issuer: {
          legalName: settings?.legal_name ?? null,
          address: settings?.address ?? null,
          grossIncome: settings?.gross_income ?? null,
          activityStart: settings?.activity_start ?? null,
          condition: settings?.issuer_condition === "exento" ? "exento" : "monotributo",
          taxId: arca.taxId,
        },
        receiver: (invoice.receiver as { name?: string | null } | null)?.name ? { name: (invoice.receiver as { name: string }).name } : undefined,
        saleConditions: "Contado",
      });
      // A qué factura corresponde la nota de crédito: sale impreso en la nota y en el detalle de la venta.
      const invoiceDoc = (invoice.detail as { document?: { issueDate?: string } } | null)?.document;
      const associated = {
        label: `Factura${invoice.voucher_class ? ` ${invoice.voucher_class}` : ""}`,
        number: `${String(invoice.sales_point).padStart(5, "0")}-${String(invoice.number).padStart(8, "0")}`,
        date: invoiceDoc?.issueDate ?? invoice.created_at.slice(0, 10),
      };
      const fields = {
        status: "authorized" as const,
        sales_point: v.salesPoint,
        voucher_type: v.voucherType,
        voucher_class: v.voucherClass,
        number: v.number,
        cae: v.cae,
        cae_expiry: v.caeExpiry,
        qr: v.qr ?? null,
        detail: JSON.parse(JSON.stringify({ ...("document" in built ? { document: built.document } : { documentError: built.error }), associated })) as Json,
      };
      if (open) await admin.from("arca_vouchers").update(fields).eq("id", open.id);
      else await admin.from("arca_vouchers").insert({ ...base, ...fields });
    } catch (e) {
      return { error: `${arcaMessage(e)} La venta no se anuló.` };
    }
  }

  // Con la nota de crédito autorizada (o una venta sin factura) la base deja anular. Si esto falla, la nota ya
  // está emitida: reintentar sólo anula la venta.
  const { error } = await supabase.rpc("void_sale_audited", { p_sale_id: saleId, p_reason: cleanReason });
  if (error) {
    return { error: `${invoice && !noteAuthorized ? "La nota de crédito se emitió, pero " : ""}no pudimos anular la venta: ${error.message}. Probá de nuevo: no se emite otra nota.` };
  }
  for (const path of ["/ventas", "/reportes", "/productos", "/pos", "/clientes", "/caja"]) revalidatePath(path);
  return {};
}
