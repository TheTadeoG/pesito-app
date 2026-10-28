"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureLockedMessage } from "@/lib/plan-access";
import { checkCertificate, cleanSubjectText, createCsr, isValidCuit } from "@/lib/arca/csr";
import { decryptSecret, encryptionConfigured, encryptSecret } from "@/lib/arca/crypto";
import { getOrgArca } from "@/lib/arca/client";
import { ArcaError, toArcaSafeErrorMetadata, type ArcaEnvironment } from "facturas";

export interface ArcaResult {
  error?: string;
  ok?: boolean;
}

type Env = ArcaEnvironment;
const isEnv = (v: unknown): v is Env => v === "test" || v === "production";

/** Quién puede tocar la facturación: dueño o administrador, con el plan que la incluye. */
async function guard(bucket: string, max: number) {
  const { userId, organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) return { error: "Sólo el dueño o un administrador puede configurar la facturación." } as const;
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "electronicInvoicing")) return { error: featureLockedMessage("electronicInvoicing") } as const;
  if (!encryptionConfigured()) return { error: "La facturación todavía no está activada en el servidor (falta ARCA_ENCRYPTION_KEY)." } as const;
  const { error } = await supabase.rpc("rate_limit_hit", { p_org_id: organization.id, p_bucket: bucket, p_max: max, p_window_seconds: 3600 });
  if (error) return { error: "Hiciste muchos intentos seguidos. Probá de nuevo en un rato." } as const;
  return { userId, org: organization, admin: createAdminClient() } as const;
}

/** Mensaje para la persona; el detalle técnico va al registro del servidor, sin secretos. */
function arcaMessage(e: unknown): string {
  if (e instanceof ArcaError) {
    console.error("arca", JSON.stringify(toArcaSafeErrorMetadata(e)));
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("AUTHENTICATION")) {
      return "ARCA no aceptó el certificado. Revisá que lo hayas autorizado para el servicio «Facturación Electrónica» y que sea del entorno elegido.";
    }
    if (code.includes("TRANSPORT")) return "No pudimos comunicarnos con ARCA. Probá de nuevo en un rato.";
    return `ARCA respondió con un error (${code || "desconocido"}). ${e.message}`.slice(0, 300);
  }
  console.error("arca", e instanceof Error ? e.message : e);
  return "No pudimos completar la operación con ARCA. Probá de nuevo.";
}

export interface ArcaProfileInput {
  issuerCondition: string;
  legalName: string;
  address: string;
  grossIncome: string;
  activityStart: string;
}

export async function saveArcaProfile(input: ArcaProfileInput): Promise<ArcaResult> {
  const g = await guard("arca_setup", 60);
  if ("error" in g) return { error: g.error };
  const cond = input.issuerCondition;
  if (cond !== "monotributo" && cond !== "responsable_inscripto" && cond !== "exento") return { error: "Elegí tu condición frente al IVA." };
  const legalName = input.legalName.trim().slice(0, 120);
  const address = input.address.trim().slice(0, 200);
  if (legalName.length < 3) return { error: "Escribí la razón social o tu nombre completo." };
  if (address.length < 5) return { error: "Escribí el domicilio comercial." };
  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.activityStart) ? input.activityStart : null;
  const { error } = await g.admin.from("arca_settings").upsert(
    {
      org_id: g.org.id,
      issuer_condition: cond,
      legal_name: legalName,
      address,
      gross_income: input.grossIncome.trim().slice(0, 30) || null,
      activity_start: start,
      updated_at: new Date().toISOString(),
      updated_by: g.userId,
    },
    { onConflict: "org_id" }
  );
  if (error) return { error: "No pudimos guardar los datos." };
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Genera la clave y la solicitud de certificado (CSR) del entorno; la clave queda cifrada en el servidor. */
export async function generateArcaCsr(input: { environment: string; taxId: string; salesPoint: number }): Promise<ArcaResult & { csr?: string }> {
  const g = await guard("arca_setup", 60);
  if ("error" in g) return { error: g.error };
  if (!isEnv(input.environment)) return { error: "Entorno inválido." };
  const taxId = input.taxId.replace(/\D/g, "");
  if (!isValidCuit(taxId)) return { error: "El CUIT no es válido (11 dígitos)." };
  const salesPoint = Math.floor(Number(input.salesPoint));
  if (!Number.isInteger(salesPoint) || salesPoint < 1 || salesPoint > 99999) return { error: "El punto de venta tiene que ser un número entre 1 y 99999." };
  const { data: profile } = await g.admin.from("arca_settings").select("legal_name").eq("org_id", g.org.id).maybeSingle();
  const { privateKeyPem, csrPem } = createCsr({
    taxId,
    organization: cleanSubjectText(profile?.legal_name ?? g.org.name),
    commonName: `pesito${input.environment === "test" ? "test" : ""}`,
  });
  const { error } = await g.admin.from("arca_credentials").upsert(
    {
      org_id: g.org.id,
      environment: input.environment,
      tax_id: taxId,
      sales_point: salesPoint,
      key_enc: encryptSecret(privateKeyPem),
      csr_pem: csrPem,
      certificate_pem: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,environment" }
  );
  if (error) return { error: "No pudimos guardar la solicitud." };
  await g.admin.from("arca_settings").update({ enabled: false }).eq("org_id", g.org.id).eq("active_environment", input.environment);
  revalidatePath("/configuracion");
  return { ok: true, csr: csrPem };
}

export async function saveArcaCertificate(input: { environment: string; certificate: string }): Promise<ArcaResult> {
  const g = await guard("arca_setup", 60);
  if ("error" in g) return { error: g.error };
  if (!isEnv(input.environment)) return { error: "Entorno inválido." };
  if (input.certificate.length > 20_000) return { error: "Eso es demasiado largo para ser un certificado." };
  const { data: cred } = await g.admin.from("arca_credentials").select("tax_id, key_enc").eq("org_id", g.org.id).eq("environment", input.environment).maybeSingle();
  if (!cred?.key_enc || !cred.tax_id) return { error: "Primero generá la solicitud de certificado." };
  let key: string;
  try {
    key = decryptSecret(cred.key_enc);
  } catch {
    return { error: "No pudimos leer la clave guardada. Generá la solicitud de nuevo." };
  }
  const check = checkCertificate({ certificatePem: input.certificate, privateKeyPem: key, taxId: cred.tax_id });
  if (!check.ok) return { error: check.error };
  const { error } = await g.admin
    .from("arca_credentials")
    .update({ certificate_pem: input.certificate.trim(), verified_at: null, updated_at: new Date().toISOString() })
    .eq("org_id", g.org.id)
    .eq("environment", input.environment);
  if (error) return { error: "No pudimos guardar el certificado." };
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Inicia sesión en ARCA con el certificado y pide los puntos de venta habilitados: prueba toda la cadena. */
export async function testArcaConnection(environment: string): Promise<ArcaResult & { salesPoints?: { number: number; type: string; blocked: boolean }[] }> {
  const g = await guard("arca_test", 20);
  if ("error" in g) return { error: g.error };
  if (!isEnv(environment)) return { error: "Entorno inválido." };
  const res = await getOrgArca(g.org.id, environment);
  if ("error" in res) return { error: res.error };
  try {
    const points = await res.arca.client.wsfe.getSalesPoints();
    const list = (Array.isArray(points) ? points : (points as { salesPoints?: unknown[] }).salesPoints ?? []) as {
      number?: number;
      type?: string;
      blocked?: boolean;
    }[];
    const salesPoints = list.map((p) => ({ number: Number(p.number), type: String(p.type ?? ""), blocked: Boolean(p.blocked) }));
    if (res.arca.salesPoint && !salesPoints.some((p) => p.number === res.arca.salesPoint && !p.blocked)) {
      return {
        error: `Pudimos entrar a ARCA, pero el punto de venta ${res.arca.salesPoint} no está habilitado para Web Services en este entorno. Los habilitados son: ${salesPoints.filter((p) => !p.blocked).map((p) => p.number).join(", ") || "ninguno"}.`,
        salesPoints,
      };
    }
    await g.admin.from("arca_credentials").update({ verified_at: new Date().toISOString() }).eq("org_id", g.org.id).eq("environment", environment);
    revalidatePath("/configuracion");
    return { ok: true, salesPoints };
  } catch (e) {
    return { error: arcaMessage(e) };
  }
}

/** Prende o apaga la facturación y elige con qué entorno se factura. Sólo con la conexión probada. */
export async function setArcaEnabled(input: { enabled: boolean; environment: string }): Promise<ArcaResult> {
  const g = await guard("arca_setup", 60);
  if ("error" in g) return { error: g.error };
  if (!isEnv(input.environment)) return { error: "Entorno inválido." };
  if (input.enabled) {
    const { data: cred } = await g.admin.from("arca_credentials").select("verified_at").eq("org_id", g.org.id).eq("environment", input.environment).maybeSingle();
    if (!cred?.verified_at) return { error: "Antes probá la conexión con ARCA en este entorno." };
    const { data: s } = await g.admin.from("arca_settings").select("issuer_condition, legal_name").eq("org_id", g.org.id).maybeSingle();
    if (!s?.issuer_condition || !s.legal_name) return { error: "Completá los datos del negocio." };
  }
  const { error } = await g.admin.from("arca_settings").upsert(
    { org_id: g.org.id, enabled: input.enabled, active_environment: input.environment, updated_at: new Date().toISOString(), updated_by: g.userId },
    { onConflict: "org_id" }
  );
  if (error) return { error: "No pudimos guardar el cambio." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export interface TestVoucherResult extends ArcaResult {
  voucher?: { number: number; salesPoint: number; voucherType: number; cae: string; caeExpiry: string };
}

/** Emite un comprobante de prueba por $1 a Consumidor Final en HOMOLOGACIÓN (no vale fiscalmente). */
export async function issueArcaTestVoucher(): Promise<TestVoucherResult> {
  const g = await guard("arca_test", 20);
  if ("error" in g) return { error: g.error };
  const res = await getOrgArca(g.org.id, "test");
  if ("error" in res) return { error: res.error };
  const { arca } = res;
  if (!arca.issuerCondition || !arca.salesPoint) return { error: "Completá los datos del negocio y el punto de venta." };
  const key = `test-${g.org.id}-${Date.now()}`;
  try {
    const outcome = await arca.client.issue({
      issuer: arca.issuerCondition,
      salesPoint: arca.salesPoint,
      to: { condition: "consumidor_final" },
      items: arca.issuerCondition === "responsable_inscripto" ? [{ gross: 100, vat: 21, description: "Prueba de Pesito" }] : [{ amount: 100, description: "Prueba de Pesito" }],
      idempotencyKey: key,
    } as Parameters<typeof arca.client.issue>[0]);
    if (outcome.kind !== "authorized") {
      await g.admin.from("arca_vouchers").insert({ org_id: g.org.id, environment: "test", status: outcome.kind, idempotency_key: key, total_cents: 100, created_by: g.userId, detail: JSON.parse(JSON.stringify({ kind: outcome.kind })) });
      if (outcome.kind === "rejected") {
        const reasons = outcome.issues.map((i) => i.message ?? i.code).filter(Boolean).join("; ");
        return { error: `ARCA rechazó el comprobante de prueba: ${reasons || "sin detalle"}` };
      }
      return { error: `No pudimos confirmar el comprobante de prueba (${outcome.kind}). Probá de nuevo.` };
    }
    const v = outcome.voucher;
    await g.admin.from("arca_vouchers").insert({
      org_id: g.org.id,
      environment: "test",
      status: "authorized",
      idempotency_key: key,
      sales_point: v.salesPoint,
      voucher_type: v.voucherType,
      voucher_class: v.voucherClass,
      number: v.number,
      cae: v.cae,
      cae_expiry: v.caeExpiry,
      qr: v.qr ?? null,
      total_cents: 100,
      created_by: g.userId,
    });
    return { ok: true, voucher: { number: v.number, salesPoint: v.salesPoint, voucherType: v.voucherType, cae: v.cae, caeExpiry: v.caeExpiry } };
  } catch (e) {
    return { error: arcaMessage(e) };
  }
}
