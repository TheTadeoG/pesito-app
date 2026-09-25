import type { ReactNode } from "react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getCashRegisterSummaries, sumCashBreakdown, type PaymentBreakdownRow } from "@/lib/caja";
import { getMemberLabelsById, memberLabelFor } from "@/lib/member-labels";
import { OpenCajaDialog } from "@/app/(dashboard)/caja/open-caja-dialog";
import { ManageCaja } from "@/app/(dashboard)/caja/manage-caja";
import { CajaHistorial, type CajaHistorialRow } from "@/app/(dashboard)/caja/historial";
import {
  TeamCajasOverview,
  DeudasFiadoOverview,
  CuentasPorPagarOverview,
  RecurringDiscrepanciesOverview,
  type OpenRegisterRow,
  type DebtorRow,
  type CreditorRow,
  type RecurringDiscrepancyRow,
} from "@/app/(dashboard)/caja/team-overview";

// Un cierre cuenta como "faltante" recién a partir de esta diferencia, para
// no marcar diferencias chicas de vuelto/redondeo como si fuera un patrón.
const FALTANTE_THRESHOLD = 100;
// De los últimos closes considerados por usuario (ver RECENT_CLOSES_PER_USER
// más abajo), a partir de qué proporción con faltante se avisa al manager.
const FALTANTE_RATIO_ALERT = 0.6;
const RECENT_CLOSES_PER_USER = 5;

export default async function CajaPage() {
  const { userId, email, organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";

  // Todo lo que no depende de otra consulta va en paralelo; después, el
  // efectivo y el desglose de todas las cajas en una sola consulta.
  const [
    { data: register },
    { data: closedRegisters },
    memberLabelsById,
    { data: openRegisters },
    { data: debtorCustomers },
    { data: creditorSuppliers },
    { data: recentClosedRegisters },
  ] = await Promise.all([
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
    getMemberLabelsById(supabase, organization.id),
    isManager
      ? supabase
          .from("cash_registers")
          .select("id, user_id, opening_amount, opened_at")
          .eq("org_id", organization.id)
          .eq("status", "abierta")
      : Promise.resolve({ data: null }),
    isManager
      ? supabase
          .from("customers")
          .select("id, name, balance")
          .eq("org_id", organization.id)
          .gt("balance", 0)
          .order("balance", { ascending: false })
      : Promise.resolve({ data: null }),
    isManager
      ? supabase
          .from("suppliers")
          .select("id, name, balance")
          .eq("org_id", organization.id)
          .gt("balance", 0)
          .order("balance", { ascending: false })
      : Promise.resolve({ data: null }),
    // Más historial que closedRegisters (acotado a 20 para la lista
    // visible): acá hace falta suficiente por usuario para detectar un
    // patrón, no sólo los últimos cierres del equipo en general.
    isManager
      ? supabase
          .from("cash_registers")
          .select("id, user_id, expected_amount, closing_amount, closed_at")
          .eq("org_id", organization.id)
          .eq("status", "cerrada")
          .order("closed_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: null }),
  ]);

  const summaries = await getCashRegisterSummaries(supabase, [
    ...(register ? [register] : []),
    ...(closedRegisters ?? []),
    ...(openRegisters ?? []),
  ].map((r) => ({ id: r.id, openingAmount: Number(r.opening_amount) })));

  function getBreakdown(registerId: string): PaymentBreakdownRow[] {
    return summaries.get(registerId)?.payments ?? [];
  }

  function getCashOnHand(registerId: string, openingAmount: number): number {
    const summary = summaries.get(registerId);
    return summary ? sumCashBreakdown(summary.cash) : openingAmount;
  }

  const closedRows = (closedRegisters ?? []).filter((r) => r.closed_at);

  const historialRows: CajaHistorialRow[] = closedRows.map((r) => {
    const cash = summaries.get(r.id)?.cash;
    return {
      id: r.id,
      userLabel: memberLabelFor(r.user_id, userId, memberLabelsById),
      openedAt: r.opened_at,
      closedAt: r.closed_at as string,
      openingAmount: Number(r.opening_amount),
      expectedAmount: Number(r.expected_amount ?? 0),
      closingAmount: Number(r.closing_amount ?? 0),
      egresosTotal: cash
        ? cash.retirosTotal + cash.cashPurchasesTotal + cash.supplierPaymentsTotal
        : 0,
      paymentBreakdown: getBreakdown(r.id),
    };
  });

  let teamOverview: ReactNode = null;
  if (isManager) {
    const openRegisterRows: OpenRegisterRow[] = (openRegisters ?? []).map((r) => ({
      id: r.id,
      userLabel: memberLabelFor(r.user_id, userId, memberLabelsById),
      openedAt: r.opened_at,
      openingAmount: Number(r.opening_amount),
      cashOnHand: getCashOnHand(r.id, Number(r.opening_amount)),
    }));

    const debtors: DebtorRow[] = (debtorCustomers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      balance: Number(c.balance),
    }));
    const totalDebt = debtors.reduce((acc, d) => acc + d.balance, 0);

    const creditors: CreditorRow[] = (creditorSuppliers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      balance: Number(s.balance),
    }));
    const totalOwed = creditors.reduce((acc, c) => acc + c.balance, 0);

    const closesByUser = new Map<string, { expected: number; closing: number }[]>();
    for (const r of recentClosedRegisters ?? []) {
      const list = closesByUser.get(r.user_id) ?? [];
      if (list.length < RECENT_CLOSES_PER_USER) {
        list.push({ expected: Number(r.expected_amount ?? 0), closing: Number(r.closing_amount ?? 0) });
      }
      closesByUser.set(r.user_id, list);
    }

    const recurringDiscrepancies: RecurringDiscrepancyRow[] = Array.from(closesByUser.entries())
      .map(([userIdKey, closes]) => {
        const faltantes = closes.filter((c) => c.closing - c.expected < -FALTANTE_THRESHOLD);
        const totalFaltante = faltantes.reduce((acc, c) => acc + (c.expected - c.closing), 0);
        return {
          userId: userIdKey,
          userLabel: memberLabelFor(userIdKey, userId, memberLabelsById),
          faltanteCount: faltantes.length,
          consideredCount: closes.length,
          totalFaltante,
        };
      })
      .filter(
        (row) =>
          row.consideredCount >= 3 && row.faltanteCount / row.consideredCount >= FALTANTE_RATIO_ALERT
      )
      .sort((a, b) => b.totalFaltante - a.totalFaltante);

    teamOverview = (
      <>
        <TeamCajasOverview
          rows={openRegisterRows}
          closeTime={organization.cash_close_time ?? null}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <DeudasFiadoOverview totalDebt={totalDebt} debtors={debtors} />
          <CuentasPorPagarOverview totalDebt={totalOwed} creditors={creditors} />
        </div>
        <RecurringDiscrepanciesOverview rows={recurringDiscrepancies} />
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
  const cashOnHand = getCashOnHand(register.id, openingAmount);

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
