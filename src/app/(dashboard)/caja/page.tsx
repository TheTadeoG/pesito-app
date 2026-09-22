import type { ReactNode } from "react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { computeCashOnHand, type PaymentBreakdownRow } from "@/lib/caja";
import { getMemberLabelsById, memberLabelFor } from "@/lib/member-labels";
import { OpenCajaDialog } from "@/app/(dashboard)/caja/open-caja-dialog";
import { ManageCaja } from "@/app/(dashboard)/caja/manage-caja";
import { CajaHistorial, type CajaHistorialRow } from "@/app/(dashboard)/caja/historial";
import {
  TeamCajasOverview,
  DeudasFiadoOverview,
  type OpenRegisterRow,
  type DebtorRow,
} from "@/app/(dashboard)/caja/team-overview";

export default async function CajaPage() {
  const { userId, email, organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";

  const [{ data: register }, { data: closedRegisters }] = await Promise.all([
    supabase
      .from("cash_registers")
      .select("id, opening_amount, opened_at")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
    supabase
      .from("cash_registers")
      .select("id, user_id, opened_at, closed_at, opening_amount, expected_amount, closing_amount")
      .eq("org_id", organization.id)
      .eq("status", "cerrada")
      .order("closed_at", { ascending: false })
      .limit(20),
  ]);

  const allRegisterIds = [
    ...(register ? [register.id] : []),
    ...(closedRegisters ?? []).map((r) => r.id),
  ];

  const memberLabelsById = await getMemberLabelsById(supabase, organization.id);

  const { data: salesForBreakdown } =
    allRegisterIds.length > 0
      ? await supabase
          .from("sales")
          .select("cash_register_id, payment_method, total")
          .in("cash_register_id", allRegisterIds)
          .eq("status", "completada")
      : { data: [] };

  const breakdownByRegister = new Map<string, Map<string, number>>();
  for (const sale of salesForBreakdown ?? []) {
    const registerId = sale.cash_register_id;
    if (!registerId) continue;
    const methodTotals = breakdownByRegister.get(registerId) ?? new Map<string, number>();
    methodTotals.set(
      sale.payment_method,
      (methodTotals.get(sale.payment_method) ?? 0) + Number(sale.total)
    );
    breakdownByRegister.set(registerId, methodTotals);
  }

  function getBreakdown(registerId: string): PaymentBreakdownRow[] {
    const methodTotals = breakdownByRegister.get(registerId);
    if (!methodTotals) return [];
    return Array.from(methodTotals.entries())
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
  }

  const historialRows: CajaHistorialRow[] = (closedRegisters ?? [])
    .filter((r) => r.closed_at)
    .map((r) => ({
      id: r.id,
      userLabel: memberLabelFor(r.user_id, userId, memberLabelsById),
      openedAt: r.opened_at,
      closedAt: r.closed_at as string,
      openingAmount: Number(r.opening_amount),
      expectedAmount: Number(r.expected_amount ?? 0),
      closingAmount: Number(r.closing_amount ?? 0),
      paymentBreakdown: getBreakdown(r.id),
    }));

  let teamOverview: ReactNode = null;
  if (isManager) {
    const [{ data: openRegisters }, { data: debtorCustomers }] = await Promise.all([
      supabase
        .from("cash_registers")
        .select("id, user_id, opening_amount, opened_at")
        .eq("org_id", organization.id)
        .eq("status", "abierta"),
      supabase
        .from("customers")
        .select("id, name, balance")
        .eq("org_id", organization.id)
        .gt("balance", 0)
        .order("balance", { ascending: false }),
    ]);

    const openRegisterRows: OpenRegisterRow[] = await Promise.all(
      (openRegisters ?? []).map(async (r) => ({
        id: r.id,
        userLabel: memberLabelFor(r.user_id, userId, memberLabelsById),
        openedAt: r.opened_at,
        openingAmount: Number(r.opening_amount),
        cashOnHand: await computeCashOnHand(supabase, r.id, Number(r.opening_amount)),
      }))
    );

    const debtors: DebtorRow[] = (debtorCustomers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      balance: Number(c.balance),
    }));
    const totalDebt = debtors.reduce((acc, d) => acc + d.balance, 0);

    teamOverview = (
      <>
        <TeamCajasOverview rows={openRegisterRows} />
        <DeudasFiadoOverview totalDebt={totalDebt} debtors={debtors} />
      </>
    );
  }

  if (!register) {
    return (
      <div className="space-y-6">
        <OpenCajaDialog />
        {teamOverview}
        <CajaHistorial rows={historialRows} />
      </div>
    );
  }

  const openingAmount = Number(register.opening_amount);
  const cashOnHand = await computeCashOnHand(supabase, register.id, openingAmount);

  return (
    <div className="space-y-6">
      <ManageCaja
        cashRegisterId={register.id}
        openingAmount={openingAmount}
        cashOnHand={cashOnHand}
        openedAt={register.opened_at}
        openedByLabel={membership.username ?? email ?? "Vos"}
        paymentBreakdown={getBreakdown(register.id)}
      />
      {teamOverview}
      <CajaHistorial rows={historialRows} />
    </div>
  );
}
