import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { planLabels, type Plan } from "@/lib/subscription";

/**
 * Card que reemplaza a una función cuando el plan del negocio no la incluye.
 * El plan mínimo sale de featureMinPlan (lib/plan-access.ts).
 */
export function ProLockedCard({
  title,
  plan = "pro",
  description,
}: {
  title: string;
  plan?: Plan;
  description?: string;
}) {
  const planName = planLabels[plan];
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            <Badge tone="accent">{planName}</Badge>
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description ?? `Disponible desde el Plan ${planName}.`}
          </p>
        </div>
        <Link
          href="/configuracion?tab=plan"
          prefetch={false}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver planes
        </Link>
      </CardContent>
    </Card>
  );
}
