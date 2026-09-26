import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { businessTypes } from "@/lib/business-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { roleLabels } from "@/lib/roles";
import { OrgNameForm } from "@/app/(dashboard)/configuracion/org-name-form";
import { AccountIds } from "@/app/(dashboard)/configuracion/account-ids";
import { AutoInvoiceToggle } from "@/app/(dashboard)/configuracion/auto-invoice-toggle";
import { CashCloseTimeForm } from "@/app/(dashboard)/configuracion/cash-close-time-form";
import { normalizeCloseTime } from "@/lib/cash-reminder";
import { isOrgAdmin } from "@/lib/roles";
import { SubscriptionSection } from "@/app/(dashboard)/configuracion/subscription-section";
import { PaymentMethodsManager } from "@/app/(dashboard)/configuracion/payment-methods-manager";
import { ConfiguracionTabs, type ConfiguracionTab } from "@/app/(dashboard)/configuracion/configuracion-tabs";
import { canUse } from "@/lib/plan-access";
import {
  getSubscription,
  getMonthlySalesCount,
  getPlanHistory,
  hasMonthlySalesLimit,
} from "@/lib/subscription";
import { getBranchContext } from "@/lib/branches";
import { BranchesManager } from "@/app/(dashboard)/configuracion/branches-manager";
import { TwoFactorCard } from "@/app/(dashboard)/configuracion/two-factor-card";
import { syncReturnedPreapproval } from "@/app/(dashboard)/configuracion/billing-actions";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { describeDevice } from "@/lib/login-events";

function parseTab(value: string | undefined): ConfiguracionTab {
  return value === "plan" ? "plan" : "negocio";
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; preapproval_id?: string }>;
}) {
  const { tab: tabParam, preapproval_id: preapprovalId } = await searchParams;
  const tab = parseTab(tabParam);
  const { userId, email, organization, membership } = await requireOrgContext();
  const supabase = await createClient();

  const businessType = businessTypes.find((b) => b.value === organization.business_type);

  if (tab === "plan") {
    // Vuelta de Mercado Pago: se aplica la suscripción sin esperar el aviso.
    if (preapprovalId) await syncReturnedPreapproval(organization.id, preapprovalId);
    const subscription = await getSubscription(supabase, organization.id);
    // Sólo importa contar esto cuando el límite de ventas realmente aplica
    // (plan gratis, sin prueba Pro activa) — evita una query de más al resto.
    const monthlySalesCount = hasMonthlySalesLimit(subscription)
      ? await getMonthlySalesCount(supabase, organization.id)
      : null;
    const planHistory = await getPlanHistory(supabase, organization.id);

    return (
      <div className="space-y-6">
        <ConfiguracionTabs active={tab} />
        <SubscriptionSection
          subscription={subscription}
          monthlySalesCount={monthlySalesCount}
          planHistory={planHistory}
          canManage={isOrgAdmin(membership.role)}
          paymentsEnabled={mercadoPagoConfigured()}
          defaultEmail={email && !email.endsWith("@vendedores.pesito.app") ? email : ""}
        />
      </div>
    );
  }

  const [
    { data: memberships },
    { data: paymentMethods },
    branchContext,
    subscription,
    { data: loginEvents },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, email, username, created_at")
      .eq("org_id", organization.id)
      .order("created_at"),
    supabase
      .from("payment_methods")
      .select("id, name")
      .eq("org_id", organization.id)
      .order("created_at"),
    getBranchContext(),
    getSubscription(supabase, organization.id),
    // Administradores: los del equipo; el resto, los propios (RLS, 0046).
    supabase
      .from("login_events")
      .select("id, user_id, user_agent, new_device, created_at")
      .eq("org_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const memberLabel = (id: string) => {
    if (id === userId) return "Vos";
    const m = (memberships ?? []).find((x) => x.user_id === id);
    return m?.username ?? m?.email ?? "Usuario eliminado";
  };

  return (
    <div className="space-y-6">
      <ConfiguracionTabs active={tab} />

      <div className="max-w-2xl space-y-6">
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
              <Badge>#{organization.org_code}</Badge>
            </div>

            <AutoInvoiceToggle initialEnabled={organization.auto_invoice_by_payment} />
          </CardContent>
        </Card>

        {isOrgAdmin(membership.role) && (
          <Card>
            <CardHeader>
              <CardTitle>Cierre de caja</CardTitle>
            </CardHeader>
            <CardContent>
              <CashCloseTimeForm
                initialTime={normalizeCloseTime(organization.cash_close_time)}
              />
            </CardContent>
          </Card>
        )}

        {isOrgAdmin(membership.role) && branchContext.current && (
          <Card>
            <CardHeader>
              <CardTitle>Sucursales</CardTitle>
              <CardDescription>Tus locales, cada uno con su stock y sus cajas.</CardDescription>
            </CardHeader>
            <CardContent>
              <BranchesManager
                branches={branchContext.branches}
                canAddBranches={canUse(subscription, "branches")}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Medios de pago</CardTitle>
            <CardDescription>
              Agregá los que uses además de los de siempre (ej: Mercado Pago, Talo).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodsManager methods={paymentMethods ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mi cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">{email}</p>
            <AccountIds orgCode={organization.org_code} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <TwoFactorCard />
            {loginEvents && loginEvents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground">Últimos ingresos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isOrgAdmin(membership.role)
                    ? "Los de todo el equipo. Si ves un dispositivo nuevo que no reconocés, cambiá la contraseña de esa persona."
                    : "Los tuyos. Si ves un dispositivo nuevo que no reconocés, cambiá tu contraseña."}
                </p>
                <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {loginEvents.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="text-foreground">
                        {`${memberLabel(e.user_id)} · ${describeDevice(e.user_agent)}`}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {e.new_device && <Badge tone="warning">Dispositivo nuevo</Badge>}
                        {formatDateTime(e.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
    </div>
  );
}
