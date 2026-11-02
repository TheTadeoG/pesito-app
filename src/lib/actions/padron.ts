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
  /** Domicilio fiscal por partes, para completar la ficha del cliente. */
  street: string | null;
  city: string | null;
  postalCode: string | null;
  province: string | null;
  /** «Monotributo», «Responsable inscripto»… tal como figura en ARCA. */
  condition: string | null;
  /** Código para guardarlo en el cliente (responsable_inscripto, monotributo…). */
  conditionCode: "responsable_inscripto" | "monotributo" | "exento" | "no_alcanzado" | "consumidor_final" | null;
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

/**
 * Negocio de Pesito cuyo certificado de producción hace las consultas del Padrón para todos (ARCA_PADRON_ORG_ID):
 * así cualquier negocio, con o sin facturación, completa un cliente con sólo escribir el CUIT, sin cargar
 * certificados. El Padrón sólo lee: no emite nada ni toca la cuenta de quien consulta.
 */
const PROVIDER_ORG_ID = process.env.ARCA_PADRON_ORG_ID?.trim() || null;

/** ¿Se puede buscar en ARCA? Con el certificado compartido de Pesito, siempre; si no, con la facturación del negocio lista. */
export async function arcaLookupAvailable(): Promise<boolean> {
  const { organization } = await requireOrgContext();
  if (PROVIDER_ORG_ID) return true;
  return (await getInvoicingConfig(organization.id)).enabled;
}

/** Lo que necesita la ficha del cliente: si puede buscar en ARCA y cómo factura el negocio (para ofrecer sólo comprobantes válidos). */
export async function getCustomerFormContext(): Promise<{ lookup: boolean; issuerCondition: "monotributo" | "responsable_inscripto" | "exento" | null }> {
  const { organization } = await requireOrgContext();
  const lookup = PROVIDER_ORG_ID ? true : (await getInvoicingConfig(organization.id)).enabled;
  const { data } = await createAdminClient().from("arca_settings").select("issuer_condition").eq("org_id", organization.id).maybeSingle();
  return { lookup, issuerCondition: data?.issuer_condition ?? null };
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

  let environment: "test" | "production";
  let res: Awaited<ReturnType<typeof getOrgArca>>;
  if (PROVIDER_ORG_ID) {
    // Certificado compartido de Pesito: no se le pide nada al negocio que consulta.
    environment = "production";
    res = await getOrgArca(PROVIDER_ORG_ID, "production");
    if ("error" in res) {
      console.error("padron: el certificado compartido no está disponible:", res.error);
      return { error: "La búsqueda en ARCA no está disponible en este momento. Cargá los datos a mano." };
    }
  } else {
    const config = await getInvoicingConfig(organization.id);
    if (!config.enabled) return { error: "La búsqueda en ARCA se activa cuando la facturación está lista (Ajustes → Facturación)." };
    // El Padrón sólo lee (no emite nada): si ya hay certificado de producción se usa ese aunque la facturación esté
    // en pruebas, porque el padrón de pruebas de ARCA casi no tiene datos reales.
    const admin = createAdminClient();
    const [{ data: settings }, { data: prod }] = await Promise.all([
      admin.from("arca_settings").select("active_environment").eq("org_id", organization.id).maybeSingle(),
      admin.from("arca_credentials").select("certificate_pem, key_enc").eq("org_id", organization.id).eq("environment", "production").maybeSingle(),
    ]);
    environment = prod?.certificate_pem && prod.key_enc ? "production" : (settings?.active_environment ?? "test");
    res = await getOrgArca(organization.id, environment);
    if ("error" in res) return { error: res.error };
  }

  try {
    let taxId = digits;
    if (digits.length !== 11) {
      const found = await res.arca.client.padron.getTaxIdByDocument(digits);
      if (!found || found.taxIds.length === 0) {
        return { error: environment === "test" ? "ARCA (entorno de pruebas) no encontró un CUIL para ese DNI: el padrón de pruebas tiene muy pocos datos." : "ARCA no encontró un CUIL para ese DNI." };
      }
      taxId = found.taxIds[0];
    }
    const t = await res.arca.client.padron.getTaxpayerDetails(taxId);
    if (!t) {
      return {
        error:
          environment === "test"
            ? "ARCA (entorno de pruebas) no encontró a esa persona o empresa. El padrón de pruebas tiene muy pocos datos: en producción busca en el padrón real."
            : "ARCA no encontró a esa persona o empresa.",
      };
    }
    const address = [t.address?.street, t.address?.city, t.address?.province].filter(Boolean).join(", ");
    return {
      taxpayer: {
        taxId,
        name: t.name ?? null,
        address: address || null,
        street: t.address?.street ?? null,
        city: t.address?.city ?? null,
        postalCode: t.address?.postalCode ?? null,
        province: t.address?.province ?? null,
        condition: t.condition ? (conditionLabel[t.condition] ?? t.condition) : null,
        conditionCode: t.condition ?? null,
        active: t.taxes.length > 0 ? t.taxes.some((x) => x.state === "AC") : null,
      },
    };
  } catch (e) {
    if (e instanceof ArcaError && String((e as { code?: string }).code ?? "").includes("AUTHENTICATION")) {
      if (PROVIDER_ORG_ID) {
        console.error("padron: el certificado compartido no está autorizado para el Padrón");
        return { error: "La búsqueda en ARCA no está disponible en este momento. Cargá los datos a mano." };
      }
      return {
        error:
          environment === "production"
            ? "ARCA no autorizó tu certificado de producción para consultar el Padrón. En ARCA, Administrador de Relaciones → Nueva relación, autorizá el mismo alias para los servicios «ws_sr_constancia_inscripcion» y «ws_sr_padron_a13». Puede tardar unos minutos."
            : "ARCA no autorizó tu certificado de pruebas para consultar el Padrón. En WSASS, «Crear autorización a servicio», autorizá el mismo alias para «ws_sr_constancia_inscripcion» y «ws_sr_padron_a13».",
      };
    }
    return { error: arcaMessage(e) };
  }
}
