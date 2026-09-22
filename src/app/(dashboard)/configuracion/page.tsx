import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { businessTypes } from "@/lib/business-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { roleLabels } from "@/lib/roles";
import { OrgNameForm } from "@/app/(dashboard)/configuracion/org-name-form";
import { AutoInvoiceToggle } from "@/app/(dashboard)/configuracion/auto-invoice-toggle";
import { SubscriptionSection } from "@/app/(dashboard)/configuracion/subscription-section";
import { getSubscription, getMonthlySalesCount } from "@/lib/subscription";

export default async function ConfiguracionPage() {
  const { userId, email, organization } = await requireOrgContext();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, user_id, role, email, username, created_at")
    .eq("org_id", organization.id)
    .order("created_at");

  const businessType = businessTypes.find((b) => b.value === organization.business_type);
  const subscription = await getSubscription(supabase, organization.id);
  // Sólo importa contar esto cuando el límite de ventas realmente aplica
  // (plan gratis, sin prueba Pro activa) — evita una query de más al resto.
  const monthlySalesCount = subscription.hasProAccess
    ? null
    : await getMonthlySalesCount(supabase, organization.id);

  return (
    <div className="max-w-2xl space-y-6">
      <SubscriptionSection subscription={subscription} monthlySalesCount={monthlySalesCount} />

      <Card>
        <CardHeader>
          <CardTitle>Tu negocio</CardTitle>
          <CardDescription>Estos datos se usan en todo el sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <OrgNameForm initialName={organization.name} />

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Badge tone="accent">{businessType?.label ?? "Otro"}</Badge>
            <Badge>Moneda: {organization.currency}</Badge>
            <Badge>ID: #{organization.id.slice(0, 5)}</Badge>
          </div>

          <AutoInvoiceToggle initialEnabled={organization.auto_invoice_by_payment} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mi cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>Quiénes tienen acceso a este negocio.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {(memberships ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-foreground">
                  {m.username ?? m.email ?? "Sin email"}
                  {m.user_id === userId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(vos)</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Desde {formatDateTime(m.created_at)}
                  </span>
                  <Badge tone="accent">{roleLabels[m.role] ?? m.role}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
