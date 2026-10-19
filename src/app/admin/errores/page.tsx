import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorInbox, type ErrorRow } from "@/app/admin/errores/error-inbox";

export default async function ErroresAdminPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const [open, resolved] = await Promise.all([
    admin.from("app_errors").select("*").eq("status", "new").order("last_seen_at", { ascending: false }).limit(200),
    admin.from("app_errors").select("*").eq("status", "resolved").order("last_seen_at", { ascending: false }).limit(50),
  ]);
  const tableMissing = Boolean(open.error);
  const toRow = (e: NonNullable<typeof open.data>[number]): ErrorRow => ({
    id: e.id,
    source: e.source,
    message: e.message,
    stack: e.stack,
    path: e.path,
    context: e.context,
    occurrences: e.occurrences,
    firstSeenAt: e.first_seen_at,
    lastSeenAt: e.last_seen_at,
    status: e.status,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a /admin
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Errores</h1>
        <p className="text-sm text-muted-foreground">
          Lo que se rompe en el servidor y en el navegador, agrupado: un renglón por error distinto, con cuántas veces pasó. Te llega un mail la primera vez que aparece uno (o cuando vuelve uno resuelto).
        </p>
      </div>
      {tableMissing ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Falta aplicar la migración 0076 (<code>app_errors</code>) en Supabase para registrar errores.
        </p>
      ) : (
        <ErrorInbox open={(open.data ?? []).map(toRow)} resolved={(resolved.data ?? []).map(toRow)} />
      )}
    </div>
  );
}
