import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getCachedCashOnHand } from "@/lib/caja";
import { roleLabels } from "@/lib/roles";
import { capitalizeWords } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { CommercialDatesBanner } from "@/components/dashboard/commercial-dates-banner";
import { ProTrialBanner } from "@/components/dashboard/pro-trial-banner";
import { ToastProvider } from "@/components/toast/toast-provider";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { RefreshAfterSale } from "@/components/dashboard/refresh-after-sale";
import { CashCloseReminder } from "@/components/dashboard/cash-close-reminder";
import { getUpcomingCommercialDates } from "@/lib/commercial-dates";
import { argDateString } from "@/lib/timezone";
import { getSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, email, firstName, organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  // Independientes entre sí (ninguna depende del resultado de la otra):
  // van en paralelo en vez de una atrás de la otra.
  const [subscription, { data: openRegister }] = await Promise.all([
    getSubscription(supabase, organization.id),
    supabase
      .from("cash_registers")
      .select("id, opening_amount, opened_at")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
  ]);

  let cashRegister = null;
  if (openRegister) {
    const openingAmount = Number(openRegister.opening_amount);
    cashRegister = {
      openedAt: openRegister.opened_at,
      openingAmount,
      cashTotal: await getCachedCashOnHand(openRegister.id, openingAmount),
    };
  }

  const [todayY, todayM, todayD] = argDateString().split("-").map(Number);
  const commercialDates = getUpcomingCommercialDates(
    new Date(todayY, todayM - 1, todayD),
    14
  ).map((d) => ({
    id: d.id,
    name: d.name,
    suggestion: d.suggestion,
    approximate: d.approximate,
    // "YYYY-MM-DD" simple (no instante UTC): evita que formatearla en el
    // cliente la corra un día por conversión de huso horario.
    dateIso: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(
      d.date.getDate()
    ).padStart(2, "0")}`,
    daysUntil: d.daysUntil,
  }));

  const greetingNameRaw =
    firstName || (membership.username ? membership.username.split("#")[0] : null) || null;
  const greetingName = greetingNameRaw ? capitalizeWords(greetingNameRaw) : null;
  const roleLabel = roleLabels[membership.role] ?? membership.role;
  const memberName = greetingName || membership.username || email || "";

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <WelcomeModal />
      </Suspense>
      <RefreshAfterSale />
      <div className="flex min-h-screen bg-background">
        <Sidebar
          orgName={organization.name}
          memberName={memberName}
          roleLabel={roleLabel}
          role={membership.role}
          cashRegister={cashRegister}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            orgName={organization.name}
            userLabel={membership.username ?? email ?? ""}
            greetingName={greetingName}
          />
          <CommercialDatesBanner dates={commercialDates} />
          {openRegister && (
            <CashCloseReminder
              registerId={openRegister.id}
              openedAt={openRegister.opened_at}
              closeTime={organization.cash_close_time ?? null}
            />
          )}
          {subscription.plan === "gratis" && subscription.proTrialEndsAt && (
            <ProTrialBanner proTrialEndsAt={subscription.proTrialEndsAt} />
          )}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
