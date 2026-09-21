import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { computeCashOnHand } from "@/lib/caja";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

const roleLabels: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  vendedor: "Vendedor",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, email, organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("id, opening_amount, opened_at")
    .eq("org_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "abierta")
    .maybeSingle();

  let cashRegister = null;
  if (openRegister) {
    const openingAmount = Number(openRegister.opening_amount);
    cashRegister = {
      openedAt: openRegister.opened_at,
      openingAmount,
      cashTotal: await computeCashOnHand(supabase, openRegister.id, openingAmount),
    };
  }

  const memberLabel = `${roleLabels[membership.role] ?? membership.role} · #${organization.id.slice(0, 5)}`;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar orgName={organization.name} memberLabel={memberLabel} cashRegister={cashRegister} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar orgName={organization.name} userLabel={email ?? ""} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
