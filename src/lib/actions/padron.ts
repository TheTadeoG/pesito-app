"use server";

import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgArca } from "@/lib/arca/client";
import { arcaMessage } from "@/lib/arca/errors";
import { isValidCuit } from "@/lib/arca/csr";
import { getInvoicingConfig } from "@/lib/actions/invoicing";
import { ArcaError } from "facturas";

export interface TaxpayerInfo {
  taxId: string;
  name: string | null;
  address: string | null;
  /** «Monotributo», «Responsable inscripto»… tal como figura en ARCA. */
  condition: string | null;
  active: boolean | null;
}

export interface TaxpayerLookup {
  error?: string;
  taxpayer?: TaxpayerInfo;
}

const conditionLabel: Record<string, string> = {
  responsable_inscripto: "Responsable inscripto",
  monotributo: "Monotributo",
  exento: "IVA exento",
  no_alcanzado: "IVA no alcanzado",
  consumidor_final: "Consumidor final",
};

/** ¿Se puede buscar en ARCA? Sólo con la facturación lista (el Padrón usa el mismo certificado). */
export async function arcaLookupAvailable(): Promise<boolean> {
  const { organization } = await requireOrgContext();
  return (await getInvoicingConfig(organization.id)).enabled;
}

/** Datos de un contribuyente en el Padrón de ARCA, por CUIT/CUIL (11 dígitos) o por DNI (se busca su CUIL). */
export async function lookupArcaTaxpayer(raw: string): Promise<TaxpayerLookup> {
  const { organization } = await requireOrgContext();
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 7 && digits.length !== 8) {
    return { error: "Escribí un CUIT o CUIL de 11 dígitos, o un DNI." };
  }
  if (digits.length === 11 && !isValidCuit(digits)) return { error: "Ese CUIT/CUIL no es válido: revisá los números." };

  const supabase = await createClient();
  const { error: limited } = await supabase.rpc("rate_limit_hit", { p_org_id: organization.id, p_bucket: "arca_padron", p_max: 120, p_window_seconds: 3600 });
  if (limited) return { error: "Hiciste muchas búsquedas seguidas. Probá de nuevo en un rato." };

  const config = await getInvoicingConfig(organization.id);
  if (!config.enabled) return { error: "La búsqueda en ARCA se activa cuando la facturación está lista (Ajustes → Facturación)." };
  const { data: settings } = await createAdminClient().from("arca_settings").select("active_environment").eq("org_id", organization.id).maybeSingle();
  const res = await getOrgArca(organization.id, settings?.active_environment ?? "test");
  if ("error" in res) return { error: res.error };

  try {
    let taxId = digits;
    if (digits.length !== 11) {
      const found = await res.arca.client.padron.getTaxIdByDocument(digits);
      if (!found || found.taxIds.length === 0) return { error: "ARCA no encontró un CUIL para ese DNI." };
      taxId = found.taxIds[0];
    }
    const t = await res.arca.client.padron.getTaxpayerDetails(taxId);
    if (!t) return { error: "ARCA no encontró a esa persona o empresa." };
    const address = [t.address?.street, t.address?.city, t.address?.province].filter(Boolean).join(", ");
    return {
      taxpayer: {
        taxId,
        name: t.name ?? null,
        address: address || null,
        condition: t.condition ? (conditionLabel[t.condition] ?? t.condition) : null,
        active: t.taxes.length > 0 ? t.taxes.some((x) => x.state === "AC") : null,
      },
    };
  } catch (e) {
    if (e instanceof ArcaError && String((e as { code?: string }).code ?? "").includes("AUTHENTICATION")) {
      return {
        error:
          "ARCA no autorizó tu certificado para consultar el Padrón. En ARCA, «Crear autorización a servicio», autorizá el mismo alias para «ws_sr_constancia_inscripcion» y «ws_sr_padron_a13».",
      };
    }
    return { error: arcaMessage(e) };
  }
}
