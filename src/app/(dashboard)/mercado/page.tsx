import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { canUse, featureMinPlan } from "@/lib/plan-access";
import { businessTypes } from "@/lib/business-types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";

export default async function MercadoPage() {
  const { organization } = await requireOrgContext();
  const supabase = await createClient();
  const subscription = await getSubscription(supabase, organization.id);
  if (!canUse(subscription, "marketAnalysis")) {
    return (
      <ProLockedCard
        title="Análisis de mercado"
        plan={featureMinPlan.marketAnalysis}
        preview="list"
        description="Novedades, precios de referencia y tendencias de tu rubro, preparadas por Pesito."
      />
    );
  }

  const { data, error } = await supabase.rpc("market_insights_for", { p_org_id: organization.id });
  if (error) throw new Error("No pudimos cargar el análisis de mercado.");
  const notes = data ?? [];

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay notas para tu rubro. Las vamos sumando: volvé pronto.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Información de mercado que reúne y revisa Pesito para tu rubro. Es orientativa: no
        reemplaza tus propios números.
      </p>
      {notes.map((n) => (
        <Card key={n.id}>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">{n.title}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {businessTypes.find((b) => b.value === n.business_type)?.label ?? "Todos los rubros"}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(n.published_at)}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-foreground">{n.body}</p>
            {n.source && <p className="text-xs text-muted-foreground">{`Fuente: ${n.source}`}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
