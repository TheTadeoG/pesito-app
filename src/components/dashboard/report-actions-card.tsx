import Link from "next/link";
import { CheckCircle2, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanLockNote } from "@/components/dashboard/pro-locked-card";
import { cn } from "@/lib/utils";
import type { ReportAction, ActionTone } from "@/lib/report-actions";
import type { Plan } from "@/lib/subscription";

const DOT: Record<ActionTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-muted-foreground/60",
  success: "bg-success",
};

function Group({ title, items }: { title: string; items: ReportAction[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[a.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.detail}</p>
              <Link href={a.href} prefetch={false} className="mt-0.5 inline-block text-sm font-medium text-primary hover:underline">
                {a.cta}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Qué hacer": las pocas acciones que más plata mueven hoy, separadas en sumar y revisar o sacar. */
export function ReportActionsCard({ actions, lockedIdle }: { actions: ReportAction[]; lockedIdle: Plan | null }) {
  const sumar = actions.filter((a) => a.group === "sumar");
  const revisar = actions.filter((a) => a.group === "revisar");
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Qué hacer ahora</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Nada urgente: stock, fiado, precios y caja están en orden.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Group title="Sumá" items={sumar} />
              <Group title="Revisá o sacá" items={revisar} />
            </div>
          )}
        </CardContent>
      </Card>
      {lockedIdle && (
        <PlanLockNote plan={lockedIdle}>
          Con este plan Pesito también te dice qué productos llevan semanas sin venderse y cuánta plata tenés parada en
          ellos, para que los liquides o dejes de reponerlos.
        </PlanLockNote>
      )}
    </>
  );
}
