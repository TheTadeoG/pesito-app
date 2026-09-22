import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { computeCashOnHand } from "@/lib/caja";
import { roleLabels } from "@/lib/roles";
import { capitalizeWords } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { ToastProvider } from "@/components/toast/toast-provider";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, email, firstName, organization, membership } = await requireOrgContext();
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

  const memberLabel = `Empresa #${organization.id.slice(0, 5)} · ${roleLabels[membership.role] ?? membership.role}`;
  const greetingNameRaw =
    firstName || (membership.username ? membership.username.split("#")[0] : null) || null;
  const greetingName = greetingNameRaw ? capitalizeWords(greetingNameRaw) : null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          orgName={organization.name}
          memberLabel={memberLabel}
          role={membership.role}
          cashRegister={cashRegister}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            orgName={organization.name}
            userLabel={membership.username ?? email ?? ""}
            greetingName={greetingName}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
