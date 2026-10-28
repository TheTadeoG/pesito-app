import { createArcaClient, type ArcaClient, type ArcaEnvironment } from "facturas";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptionConfigured } from "@/lib/arca/crypto";
import { createSupabaseArcaStore } from "@/lib/arca/store";

export interface OrgArca {
  client: ArcaClient;
  environment: ArcaEnvironment;
  taxId: string;
  salesPoint: number | null;
  issuerCondition: "monotributo" | "responsable_inscripto" | "exento" | null;
}

/**
 * Cliente de ARCA de un negocio, con SU CUIT, SU certificado y SU clave (descifrada sólo en memoria,
 * sólo en el servidor). `null` + motivo si falta algo.
 */
export async function getOrgArca(orgId: string, environment: ArcaEnvironment): Promise<{ arca: OrgArca } | { error: string }> {
  if (!encryptionConfigured()) return { error: "Falta configurar la clave de cifrado de facturación en el servidor (ARCA_ENCRYPTION_KEY)." };
  const admin = createAdminClient();
  const [{ data: settings }, { data: cred }] = await Promise.all([
    admin.from("arca_settings").select("issuer_condition").eq("org_id", orgId).maybeSingle(),
    admin.from("arca_credentials").select("tax_id, sales_point, key_enc, certificate_pem").eq("org_id", orgId).eq("environment", environment).maybeSingle(),
  ]);
  if (!cred?.tax_id || !cred.key_enc || !cred.certificate_pem) {
    return { error: environment === "test" ? "Todavía no cargaste el certificado de pruebas." : "Todavía no cargaste el certificado de producción." };
  }
  let privateKeyPem: string;
  try {
    privateKeyPem = decryptSecret(cred.key_enc);
  } catch {
    return { error: "No pudimos leer la clave guardada. Generá la solicitud de certificado de nuevo." };
  }
  const client = createArcaClient({
    taxId: cred.tax_id,
    certificatePem: cred.certificate_pem,
    privateKeyPem,
    environment,
    store: createSupabaseArcaStore(admin),
    timeout: 25_000,
    retries: 1,
  });
  return { arca: { client, environment, taxId: cred.tax_id, salesPoint: cred.sales_point, issuerCondition: settings?.issuer_condition ?? null } };
}
