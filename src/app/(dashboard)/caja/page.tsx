import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import type { ReactNode } from "react";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getCashRegisterSummaries, sumCashBreakdown, type PaymentBreakdownRow } from "@/lib/caja";
import { getMemberLabelsById, memberLabelFor } from "@/lib/member-labels";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { OpenCajaDialog } from "@/app/(dashboard)/caja/open-caja-dialog";
import { ManageCaja, type TurnoMovement } from "@/app/(dashboard)/caja/manage-caja";
import { CajaHistorial, type CajaHistorialRow } from "@/app/(dashboard)/caja/historial";
import {
  CajaResumen,
  FaltantesAviso,
  type OpenRegisterRow,
  type RecurringDiscrepancyRow,
} from "@/app/(dashboard)/caja/team-overview";
import { BranchFilter } from "@/app/(dashboard)/caja/branch-filter";
import { countOverdueSuppliers } from "@/lib/supplier-overview";
import { getBranchContext } from "@/lib/branches";

// Un cierre cuenta como "faltante" recién a partir de esta diferencia, para
// no marcar diferencias chicas de vuelto/redondeo como si fuera un patrón.
const FALTANTE_THRESHOLD = 100;
// De los últimos closes considerados por usuario (ver RECENT_CLOSES_PER_USER
// más abajo), a partir de qué proporción con faltante se avisa al manager.
const FALTANTE_RATIO_ALERT = 0.6;
const RECENT_CLOSES_PER_USER = 5;
// Sin historial completo de caja (Plan Pro) se ven sólo los últimos cierres.
const LIMITED_HISTORY = 5;

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string }>;
}) {
  const { userId, email, organization, membership } = await requireOrgContext();
  const supabase = await createClient();
  const isManager = membership.role === "owner" || membership.role === "admin";
  // Con más de una sucursal, dueños y administradores pueden filtrar lo de
  // abajo (equipo, faltantes e historial) por sucursal.
  const branchContext = await getBranchContext();
  const params = await searchParams;
  const canFilterBranch = isManager && branchContext.branches.length > 1;
  const filterBranchId =
    canFilterBranch && branchContext.branches.some((b) => b.id === params.sucursal)
      ? (params.sucursal as string)
      : null;
  const branchMatch = filterBranchId ? { branch_id: filterBranchId } : {};
  const subscription = await getSubscription(supabase, organization.id);
  const fullHistory = canUse(subscription, "cashHistory");
  const canTeam = canUse(subscription, "teamReports");
  const canSupplierAccounts = canUse(subscription, "supplierAccounts");

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
      .select("id, opening_amount, opened_at, branch_id")
      .eq("org_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "abierta")
      .maybeSingle(),
    supabase
      .from("cash_registers")
      .select("id, user_id, opened_at, closed_at, opening_amount, expected_amount, closing_amount, branch_id")
      .eq("org_id", organization.id)
      .eq("status", "cerrada")
      .match(branchMatch)
      .order("closed_at", { ascending: false })
      .limit(fullHistory ? 20 : LIMITED_HISTORY),
    getMemberLabelsById(supabase, organization.id),
    isManager
      ? supabase
          .from("cash_registers")
          .select("id, user_id, opening_amount, opened_at, branch_id")
          .eq("org_id", organization.id)
          .eq("status", "abierta")
          .match(branchMatch)
      : Promise.resolve({ data: null }),
    isManager
      ? supabase
          .from("customers")
          .select("id, name, balance")
          .eq("org_id", organization.id)
          .gt("balance", 0)
          .order("balance", { ascending: false })
      : Promise.resolve({ data: null }),
    isManager && canSupplierAccounts
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
    isManager && canTeam
      ? supabase
          .from("cash_registers")
          .select("id, user_id, expected_amount, closing_amount, closed_at")
          .eq("org_id", organization.id)
          .eq("status", "cerrada")
          .match(branchMatch)
          .order("closed_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: null }),
  ]);

  // Con más de una sucursal, cada caja dice de cuál es.
  const branchNames =
    branchContext.branches.length > 1
      ? new Map(branchContext.branches.map((b) => [b.id, b.name]))
      : new Map<string, string>();
  const branchNameOf = (id: string | null) => (id ? (branchNames.get(id) ?? null) : null);

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
      branchName: branchNameOf(r.branch_id),
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
      branchName: branchNameOf(r.branch_id),
    }));

    const totalDebt = (debtorCustomers ?? []).reduce((acc, c) => acc + Number(c.balance), 0);
    const totalOwed = (creditorSuppliers ?? []).reduce((acc, c) => acc + Number(c.balance), 0);
    const overdueSuppliers = canSupplierAccounts
      ? await countOverdueSuppliers(supabase, organization.id)
      : 0;

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
        {canFilterBranch && (
          <BranchFilter
            branches={branchContext.branches.map((b) => ({ id: b.id, name: b.name }))}
            value={filterBranchId}
          />
        )}
        <CajaResumen
          ownOpen={Boolean(register)}
          filteredBranchName={filterBranchId ? (branchNames.get(filterBranchId) ?? null) : null}
          others={openRegisterRows.filter((r) => r.id !== register?.id)}
          closeTime={organization.cash_close_time ?? null}
          fiado={{ total: totalDebt, count: (debtorCustomers ?? []).length }}
          proveedores={
            canSupplierAccounts
              ? { total: totalOwed, count: (creditorSuppliers ?? []).length, overdueSuppliers }
              : null
          }
          supplierPlan={featureMinPlan.supplierAccounts}
        />
        {canTeam ? (
          <FaltantesAviso rows={recurringDiscrepancies} />
        ) : (
          <PlanLockNote plan={featureMinPlan.teamReports}>
            Con el Plan Esencial ves las diferencias de caja de cada empleado: quién cierra con
            faltantes seguido y cuánto suma.
          </PlanLockNote>
        )}
      </>
    );
  }

  if (!register) {
    return (
      <div className="space-y-6">
        <OpenCajaDialog />
        {teamOverview}
        <CajaHistorial rows={historialRows} limitedTo={fullHistory ? undefined : LIMITED_HISTORY} />
      </div>
    );
  }

  const openingAmount = Number(register.opening_amount);
  const cashOnHand = getCashOnHand(register.id, openingAmount);
  const ownCash = summaries.get(register.id)?.cash;

  // Movimientos del turno: los sueltos (ingresos, retiros, pagos a proveedores)
  // uno por uno, y lo que son muchos (ventas, cobros de fiado, compras) en una
  // sola fila cada uno, así la lista no se llena.
  const [{ data: movementsRaw }, { data: supplierPaymentsRaw }, { count: salesCount }] =
    await Promise.all([
      supabase
        .from("cash_movements")
        .select("id, type, amount, reason, created_at")
        .eq("cash_register_id", register.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("supplier_payments")
        .select("id, supplier_id, amount, created_at")
        .eq("cash_register_id", register.id)
        .eq("method", "efectivo")
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("cash_register_id", register.id)
        .eq("status", "completada"),
    ]);
  const supplierIds = Array.from(new Set((supplierPaymentsRaw ?? []).map((p) => p.supplier_id)));
  const { data: supplierNames } =
    supplierIds.length > 0
      ? await supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : { data: [] as { id: string; name: string }[] };
  const nameBySupplier = new Map((supplierNames ?? []).map((x) => [x.id, x.name]));

  const individual: TurnoMovement[] = [
    ...(movementsRaw ?? []).map((m) => ({
      id: `m-${m.id}`,
      kind: m.type === "ingreso" ? ("ingreso" as const) : ("retiro" as const),
      title: m.type === "ingreso" ? "Ingreso de efectivo" : "Retiro de efectivo",
      note: m.reason ?? null,
      at: m.created_at,
      amount: m.type === "ingreso" ? Number(m.amount) : -Number(m.amount),
    })),
    ...(supplierPaymentsRaw ?? []).map((p) => ({
      id: `p-${p.id}`,
      kind: "proveedor" as const,
      title: `Pago a ${nameBySupplier.get(p.supplier_id) ?? "proveedor"}`,
      note: "proveedor · efectivo",
      at: p.created_at,
      amount: -Number(p.amount),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const grouped: TurnoMovement[] = [];
  if (ownCash && ownCash.salesCashTotal > 0) {
    grouped.push({
      id: "g-ventas",
      kind: "ventas",
      title: "Ventas en efectivo",
      note: `${salesCount ?? 0} ${salesCount === 1 ? "venta" : "ventas"} en este turno`,
      at: null,
      amount: ownCash.salesCashTotal,
    });
  }
  if (ownCash && ownCash.debtPaymentsTotal > 0) {
    grouped.push({
      id: "g-fiado",
      kind: "fiado",
      title: "Cobros de fiado",
      note: "en efectivo",
      at: null,
      amount: ownCash.debtPaymentsTotal,
    });
  }
  if (ownCash && ownCash.cashPurchasesTotal > 0) {
    grouped.push({
      id: "g-compras",
      kind: "compras",
      title: "Compras pagadas en efectivo",
      note: null,
      at: null,
      amount: -ownCash.cashPurchasesTotal,
    });
  }
  const turnoMovements: TurnoMovement[] = [
    ...individual,
    ...grouped,
    {
      id: "apertura",
      kind: "apertura",
      title: "Apertura de caja",
      note: null,
      at: register.opened_at,
      amount: openingAmount,
    },
  ];

  return (
    <div className="space-y-6">
      <ManageCaja
        cashRegisterId={register.id}
        openingAmount={openingAmount}
        cashOnHand={cashOnHand}
        openedAt={register.opened_at}
        openedByLabel={membership.username ?? email ?? "Vos"}
        paymentBreakdown={getBreakdown(register.id)}
        movements={turnoMovements}
        branchName={branchNameOf(register.branch_id)}
        cash={
          summaries.get(register.id)?.cash ?? {
            openingAmount,
            salesCashTotal: 0,
            debtPaymentsTotal: 0,
            ingresosTotal: 0,
            retirosTotal: 0,
            supplierPaymentsTotal: 0,
            cashPurchasesTotal: 0,
          }
        }
      />
      {teamOverview}
      <CajaHistorial rows={historialRows} limitedTo={fullHistory ? undefined : LIMITED_HISTORY} />
    </div>
  );
}
