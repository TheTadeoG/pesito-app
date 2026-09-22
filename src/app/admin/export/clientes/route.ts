import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { planLabels, type Plan } from "@/lib/subscription";
import { businessTypes } from "@/lib/business-types";

const businessTypeLabels: Record<string, string> = Object.fromEntries(
  businessTypes.map((t) => [t.value, t.label])
);

// ; como separador (no ,) porque Excel en configuración regional
// es-AR usa la coma como separador decimal, y detecta ; automáticamente
// al abrir el archivo con doble click.
function csvField(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta todos los negocios de la plataforma a CSV (nombre, contacto,
 * teléfono, plan, fecha de alta) para descargar desde /admin o, más
 * adelante, para automatizar: es un endpoint GET simple, sin parámetros,
 * que devuelve datos estructurados — la base para conectarlo a Zapier/Make
 * u otra automatización el día de mañana (hoy pide sesión de platform
 * admin; una integración externa necesitaría su propio mecanismo de auth,
 * como una API key, que todavía no existe).
 */
export async function GET() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [{ data: orgsRaw }, { data: subscriptionsRaw }, { data: ownerRows }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, phone, business_type, created_at")
      .order("created_at"),
    admin.from("organization_subscriptions").select("org_id, plan"),
    admin.from("memberships").select("org_id, email, username").eq("role", "owner"),
  ]);

  const organizations = orgsRaw ?? [];
  const planByOrgId = new Map((subscriptionsRaw ?? []).map((s) => [s.org_id, s.plan as Plan]));
  const ownerByOrgId = new Map(
    (ownerRows ?? []).map((m) => [m.org_id, { email: m.email, username: m.username }])
  );

  const header = [
    "Negocio",
    "Email",
    "Usuario interno",
    "Teléfono",
    "Tipo de negocio",
    "Plan",
    "Fecha de alta",
  ];

  const rows = organizations.map((org) => {
    const owner = ownerByOrgId.get(org.id);
    const plan = planByOrgId.get(org.id) ?? "gratis";
    return [
      org.name,
      owner?.email ?? "",
      owner?.username ?? "",
      org.phone ?? "",
      businessTypeLabels[org.business_type] ?? org.business_type,
      planLabels[plan] ?? plan,
      new Date(org.created_at).toLocaleDateString("es-AR"),
    ];
  });

  const csvBody = [header, ...rows]
    .map((cols) => cols.map((c) => csvField(String(c))).join(";"))
    .join("\r\n");
  // BOM inicial: para que Excel detecte UTF-8 y no rompa los acentos/eñes.
  const csv = `﻿${csvBody}`;

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pesito-clientes-${today}.csv"`,
    },
  });
}
