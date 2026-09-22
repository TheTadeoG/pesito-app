"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { planLabels, planOrder, type Plan } from "@/lib/subscription";
import { updateOrgPlan } from "@/app/admin/actions";

export interface OrgPlanRow {
  id: string;
  name: string;
  plan: Plan;
  proTrialEndsAt: string | null;
}

export function OrgPlanManager({ orgs }: { orgs: OrgPlanRow[] }) {
  const [rows, setRows] = useState(orgs);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(orgId: string, plan: Plan) {
    const previous = rows;
    setRows((current) => current.map((r) => (r.id === orgId ? { ...r, plan } : r)));
    setPendingId(orgId);
    setErrorId(null);
    startTransition(async () => {
      const result = await updateOrgPlan(orgId, plan);
      setPendingId(null);
      if (result.error) {
        setRows(previous);
        setErrorId(orgId);
      }
    });
  }

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin negocios todavía.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((org) => (
        <div key={org.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate text-foreground">{org.name}</p>
            {org.plan === "gratis" && org.proTrialEndsAt && (
              <p className="text-xs text-muted-foreground">
                Prueba Pro hasta {formatDateTime(org.proTrialEndsAt)}
              </p>
            )}
            {errorId === org.id && <p className="text-xs text-danger">No se pudo guardar.</p>}
          </div>
          <Select
            className="w-40 shrink-0"
            value={org.plan}
            disabled={isPending && pendingId === org.id}
            onChange={(e) => handleChange(org.id, e.target.value as Plan)}
          >
            {planOrder.map((plan) => (
              <option key={plan} value={plan}>
                {planLabels[plan]}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
