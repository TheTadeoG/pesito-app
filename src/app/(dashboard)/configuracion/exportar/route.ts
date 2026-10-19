import { NextResponse, type NextRequest } from "next/server";
import { requireOrgContext } from "@/lib/org";
import { isOrgAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { EXPORT_KINDS, buildExport, exportFileName, parseRange, type ExportKind } from "@/lib/data-export";

// Descarga de los datos del negocio en CSV (Configuración → Tus datos). Sólo dueño o
// administrador, con límite de ritmo por negocio porque lee mucho.
export async function GET(request: NextRequest) {
  const { organization, membership } = await requireOrgContext();
  if (!isOrgAdmin(membership.role)) {
    return NextResponse.json({ error: "Sólo el dueño o un administrador puede bajar los datos." }, { status: 403 });
  }
  const params = request.nextUrl.searchParams;
  const kind = EXPORT_KINDS.find((k) => k.kind === params.get("tipo"))?.kind as ExportKind | undefined;
  if (!kind) return NextResponse.json({ error: "Tipo de datos inválido." }, { status: 400 });

  const supabase = await createClient();
  const { error: limitError } = await supabase.rpc("rate_limit_hit", {
    p_org_id: organization.id,
    p_bucket: "export",
    p_max: 20,
    p_window_seconds: 3600,
  });
  if (limitError) {
    return NextResponse.json({ error: "Bajaste muchos archivos seguidos. Probá de nuevo en un rato." }, { status: 429 });
  }

  const range = parseRange(params.get("desde"), params.get("hasta"));
  const { csv } = await buildExport(supabase, organization.id, kind, range);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(kind)}"`,
      "Cache-Control": "no-store",
    },
  });
}
