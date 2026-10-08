import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeedbackInbox, type FeedbackRow } from "@/app/admin/mensajes/feedback-inbox";

export default async function MensajesAdminPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("feedback")
    .select("id, org_id, contact_email, kind, message, page, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const orgIds = [...new Set((data ?? []).map((r) => r.org_id))];
  const names = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds.slice(0, 200));
    for (const o of orgs ?? []) names.set(o.id, o.name);
  }

  const rows: FeedbackRow[] = (data ?? []).map((r) => ({
    id: r.id,
    orgName: names.get(r.org_id) ?? "Negocio borrado",
    email: r.contact_email,
    kind: r.kind,
    message: r.message,
    page: r.page,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a /admin
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">Sugerencias y problemas</h1>
        <p className="text-sm text-muted-foreground">
          Lo que mandan los negocios desde el menú de ayuda (?). Se muestran los últimos 300.
        </p>
      </div>
      <FeedbackInbox rows={rows} />
    </div>
  );
}
