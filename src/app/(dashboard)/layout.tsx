import type { Metadata } from "next";
import Link from "next/link";
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
import { getSubscription, planLabels } from "@/lib/subscription";
import { canUse, featureMinPlan, type PlanFeature } from "@/lib/plan-access";
import { getBranchContext } from "@/lib/branches";
import { cookies } from "next/headers";
import { isOrgAdmin } from "@/lib/roles";
import { DEVICE_COOKIE, describeDevice } from "@/lib/login-events";
import { formatDateTime } from "@/lib/utils";
import { NewDeviceAlert, type NewDeviceLogin } from "@/components/dashboard/new-device-alert";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, email, firstName, organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  // Independientes entre sí (ninguna depende del resultado de la otra):
  // van en paralelo en vez de una atrás de la otra.
  const cookieStore = await cookies();
  const thisDevice = cookieStore.get(DEVICE_COOKIE)?.value ?? "";
  const [subscription, { data: openRegister }, branchContext, { data: newDeviceRows }] = await Promise.all([
    getSubscription(supabase, organization.id),
    supabase
      .from("cash_registers")
      .select("id, opening_amount, opened_at")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
    getBranchContext(),
    // Dueños/administradores: ingresos desde dispositivos nuevos (48 h),
    // sin contar este mismo dispositivo.
    isOrgAdmin(membership.role)
      ? supabase
          .from("login_events")
          .select("id, user_id, user_agent, device_id, created_at")
          .eq("org_id", organization.id)
          .eq("new_device", true)
          // eslint-disable-next-line react-hooks/purity
          .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
  ]);
  const branch = branchContext.current
    ? {
        branches: branchContext.branches.map((b) => ({ id: b.id, name: b.name })),
        currentId: branchContext.current.id,
        canSwitch: branchContext.canSwitch,
      }
    : null;

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
  const newDeviceLogins: NewDeviceLogin[] = [];
  if (newDeviceRows && newDeviceRows.length > 0) {
    const others = newDeviceRows.filter((r) => r.device_id !== thisDevice);
    const ids = Array.from(new Set(others.map((r) => r.user_id)));
    const { data: people } = ids.length
      ? await supabase.from("memberships").select("user_id, username, email").eq("org_id", organization.id).in("user_id", ids)
      : { data: [] };
    for (const r of others) {
      const person = (people ?? []).find((p) => p.user_id === r.user_id);
      newDeviceLogins.push({
        id: r.id,
        who: r.user_id === userId ? "vos" : person?.username ?? person?.email ?? "alguien del equipo",
        device: describeDevice(r.user_agent),
        at: formatDateTime(r.created_at),
      });
    }
  }
  const lockedFeatures = Object.fromEntries(
    (Object.keys(featureMinPlan) as PlanFeature[])
      .filter((f) => !canUse(subscription, f))
      .map((f) => [f, planLabels[featureMinPlan[f]]])
  );
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
          planLabel={
            subscription.trialActive ? "Prueba Pro" : `Plan ${planLabels[subscription.plan]}`
          }
          role={membership.role}
          cashRegister={cashRegister}
          branch={branch}
          lockedFeatures={lockedFeatures}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            orgName={organization.name}
            userLabel={membership.username ?? email ?? ""}
            greetingName={greetingName}
            branch={branch}
          />
          <CommercialDatesBanner dates={commercialDates} />
          {openRegister && (
            <CashCloseReminder
              registerId={openRegister.id}
              openedAt={openRegister.opened_at}
              closeTime={organization.cash_close_time ?? null}
            />
          )}
          <NewDeviceAlert logins={newDeviceLogins} />
          {isOrgAdmin(membership.role) && subscription.billing?.status === "past_due" && (
            <div className="mx-4 mt-4 rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-foreground sm:mx-6 lg:mx-8">
              {`No pudimos cobrar tu plan con Mercado Pago${
                subscription.billing.graceUntil
                  ? `: si no se paga antes del ${formatDateTime(subscription.billing.graceUntil)}, el negocio pasa al Plan Gratis`
                  : ""
              }. `}
              <Link href="/configuracion?tab=plan" prefetch={false} className="font-medium text-primary hover:underline">
                Actualizar medio de pago
              </Link>
            </div>
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
