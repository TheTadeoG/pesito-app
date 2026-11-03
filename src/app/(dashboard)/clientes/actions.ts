"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/org";
import { CONSUMER_NEEDS_DNI_MESSAGE, hasIdentification } from "@/lib/invoice-labels";
import { cleanDocument, documentError, type DocumentType } from "@/lib/tax-id";

export interface ActionState {
  error?: string;
}

export interface CustomerFormInput {
  id?: string;
  name: string;
  razonSocial: string;
  phone: string;
  email: string;
  document: string;
  documentType: DocumentType;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  taxCondition: "" | "responsable_inscripto" | "monotributo" | "exento" | "no_alcanzado" | "consumidor_final";
  notes: string;
  invoiceType: "consumidor_final" | "factura_a" | "factura_b" | "factura_c";
}

export async function saveCustomer(input: CustomerFormInput): Promise<ActionState> {
  if (!input.name.trim()) {
    return { error: "El cliente necesita un nombre." };
  }

  const documentType: DocumentType = input.documentType ?? "cuit";
  const document = cleanDocument(input.document, documentType);
  const docError = documentError(document, documentType);
  if (docError) return { error: docError };
  if (input.taxCondition === "consumidor_final" && !hasIdentification(document)) {
    return { error: CONSUMER_NEEDS_DNI_MESSAGE };
  }

  const { organization } = await requireOrgContext();
  const supabase = await createClient();

  const payload = {
    org_id: organization.id,
    name: input.name.trim(),
    razon_social: input.razonSocial.trim() || null,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    document: document || null,
    document_type: document ? documentType : null,
    address: input.address.trim().slice(0, 200) || null,
    city: input.city.trim().slice(0, 100) || null,
    postal_code: input.postalCode.trim().slice(0, 12) || null,
    province: input.province.trim().slice(0, 60) || null,
    tax_condition: input.taxCondition || null,
    notes: input.notes.trim() || null,
    invoice_type: input.invoiceType,
  };

  if (input.id) {
    const { error } = await supabase.from("customers").update(payload).eq("id", input.id);
    if (error) return { error: "No pudimos guardar los cambios." };
  } else {
    const { error } = await supabase.from("customers").insert(payload);
    if (error) return { error: "No pudimos crear el cliente." };
  }

  revalidatePath("/clientes");
  if (input.id) revalidatePath(`/clientes/${input.id}`);
  revalidatePath("/pos");
  return {};
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    return {
      error: "No pudimos borrar el cliente (puede tener ventas asociadas).",
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/pos");
  return {};
}

export async function registerPayment(
  id: string,
  amount: number,
  method: string
): Promise<ActionState> {
  if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };

  const { userId } = await requireOrgContext();
  const supabase = await createClient();

  const { data: register } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  if (!register) {
    return { error: "Abrí tu caja para poder registrar cobros de deuda." };
  }

  const { error } = await supabase.rpc("register_customer_payment", {
    p_customer_id: id,
    p_cash_register_id: register.id,
    p_method: method,
    p_amount: amount,
  });

  if (error) return { error: "No pudimos registrar el pago." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/caja");
  revalidatePath("/pos");
  return {};
}
