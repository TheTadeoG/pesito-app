import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse } from "@/lib/plan-access";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { loadSupplierOverview } from "@/lib/supplier-overview";
import { addDays, calendarEvents, weekdayIndex } from "@/lib/supplier-debt";
import { CalendarioClient } from "@/app/(dashboard)/proveedores/calendario/calendario-client";

function monthShift(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarioProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);

  if (!canUse(subscription, "supplierAccounts")) {
    return (
      <PlanLockNote plan="esencial">
        Con el Plan Esencial ves en un calendario cuándo vence cada compra a cuenta y cuándo entrega
        cada proveedor.
      </PlanLockNote>
    );
  }

  const [overview, { data: customPaymentMethods }] = await Promise.all([
    loadSupplierOverview(supabase, organization.id),
    supabase.from("payment_methods").select("name").eq("org_id", organization.id).order("created_at"),
  ]);

  const currentMonth = overview.todayKey.slice(0, 7);
  const monthKey = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonth;
  const first = `${monthKey}-01`;
  const last = addDays(`${monthShift(monthKey, 1)}-01`, -1);
  // Semanas completas (lunes a domingo) que cubren el mes.
  const gridStart = addDays(first, -weekdayIndex(first));
  const gridEnd = addDays(last, 6 - weekdayIndex(last));

  const events = calendarEvents(
    overview.rows.map((r) => ({
      id: r.id,
      name: r.name,
      deliveryDays: r.delivery_days ?? [],
      items: r.items,
    })),
    gridStart,
    gridEnd
  );

  const debts = overview.rows.flatMap((r) =>
    r.items.map((i) => ({
      ...i,
      supplierName: r.name,
      termsDays: r.payment_terms_days && r.payment_terms_days > 0 ? r.payment_terms_days : null,
    }))
  );
  const overdueTotal = overview.rows
    .flatMap((r) => r.items)
    .filter((i) => i.status === "vencida")
    .reduce((acc, i) => acc + i.amount, 0);

  return (
    <CalendarioClient
      todayKey={overview.todayKey}
      monthKey={monthKey}
      currentMonth={currentMonth}
      prevMonth={monthShift(monthKey, -1)}
      nextMonth={monthShift(monthKey, 1)}
      gridStart={gridStart}
      gridEnd={gridEnd}
      events={events}
      debts={debts}
      overdueTotal={overdueTotal}
      suppliers={overview.rows}
      customPaymentMethods={(customPaymentMethods ?? []).map((m) => m.name)}
    />
  );
}
