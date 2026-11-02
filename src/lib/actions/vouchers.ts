"use server";

import type { VoucherDocument } from "facturas";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export interface VoucherView {
  id: string;
  kind: "invoice" | "credit_note" | "debit_note";
  environment: "test" | "production";
  cae: string | null;
  caeExpiry: string | null;
  qr: string | null;
  /** Lo que se imprime (guardado al emitir). null: el comprobante existe, pero sin datos para dibujarlo. */
  document: VoucherDocument | null;
  /** Por qué no hay documento (falta un dato del negocio, importes que no cierran…). */
  documentError: string | null;
}

/** Una sola lectura de una fila: ver o reimprimir un comprobante no calcula ni pide nada a ARCA. */
export async function getVoucherView(voucherId: string): Promise<{ error?: string; voucher?: VoucherView }> {
  await requireOrgContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("arca_vouchers")
    .select("id, kind, environment, cae, cae_expiry, qr, detail, status")
    .eq("id", voucherId)
    .maybeSingle();
  if (!data || data.status !== "authorized") return { error: "No encontramos ese comprobante." };
  const detail = (data.detail ?? {}) as { document?: VoucherDocument; documentError?: string };
  return {
    voucher: {
      id: data.id,
      kind: data.kind,
      environment: data.environment,
      cae: data.cae,
      caeExpiry: data.cae_expiry,
      qr: data.qr,
      document: detail.document ?? null,
      documentError: detail.documentError ?? null,
    },
  };
}
