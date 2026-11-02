import { buildVoucherDocument, type VoucherDocument } from "facturas";

type DocInput = Parameters<typeof buildVoucherDocument>[0];

export interface IssuerProfile {
  legalName: string | null;
  address: string | null;
  grossIncome: string | null;
  activityStart: string | null;
  condition: "monotributo" | "responsable_inscripto" | "exento";
  taxId: string;
}

/**
 * Lo que lleva impreso un comprobante, ya derivado y chequeado por el SDK (puro, sin red ni PDF). Se guarda
 * junto al comprobante: ver o reimprimir después es leer una fila y dibujarla en el navegador.
 * Con `error` si falta algún dato obligatorio del emisor o no cierran los importes; el comprobante igual existe en ARCA.
 */
export function buildStoredDocument(input: {
  voucher: DocInput["voucher"];
  items: DocInput["items"];
  issuer: IssuerProfile;
  receiver?: DocInput["receiver"];
  saleConditions?: string;
  observations?: DocInput["observations"];
}): { document: VoucherDocument } | { error: string } {
  const { issuer } = input;
  if (!issuer.legalName || !issuer.address) return { error: "Faltan la razón social o el domicilio del negocio (Ajustes → Facturación)." };
  try {
    return { document: buildVoucherDocument({
      voucher: input.voucher,
      items: input.items,
      observations: input.observations,
      receiver: input.receiver,
      saleConditions: input.saleConditions ?? "Contado",
      issuer: {
        legalName: issuer.legalName,
        address: issuer.address,
        taxId: issuer.taxId,
        condition: issuer.condition,
        grossIncome: issuer.grossIncome || "No alcanzado",
        activitiesStartDate: issuer.activityStart,
      },
    }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 200) : "No pudimos armar el comprobante." };
  }
}
