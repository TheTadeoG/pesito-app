import { requirePlatformAdmin } from "@/lib/platform-admin";
import { loadAdminData } from "@/lib/admin-data";
import { SEGMENTS, type SegmentId } from "@/lib/admin-shared";
import { NegociosClient } from "@/app/admin/negocios/negocios-client";

export const metadata = { title: "Negocios" };

export default async function AdminNegociosPage({ searchParams }: { searchParams: Promise<{ seg?: string; org?: string }> }) {
  await requirePlatformAdmin();
  const { seg, org } = await searchParams;
  const { orgs } = await loadAdminData();
  const initialSeg: SegmentId = SEGMENTS.some((s) => s.id === seg) ? (seg as SegmentId) : "todos";
  // La hora se fija acá y se pasa al navegador: así el servidor y el navegador escriben lo mismo ("hace 3 horas").
  // eslint-disable-next-line react-hooks/purity -- Server Component: se calcula fresco en cada request.
  const now = Date.now();
  return <NegociosClient initialOrgs={orgs} now={now} initialSeg={initialSeg} initialOrgId={orgs.some((o) => o.id === org) ? (org as string) : null} />;
}
