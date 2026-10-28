import { redirect } from "next/navigation";
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
import { PaymentMethodsManager } from "@/app/(dashboard)/configuracion/payment-methods-manager";
import { canUse } from "@/lib/plan-access";
import { getSubscription } from "@/lib/subscription";
import { getBranchContext } from "@/lib/branches";
import { BranchesManager } from "@/app/(dashboard)/configuracion/branches-manager";
import { TwoFactorCard } from "@/app/(dashboard)/configuracion/two-factor-card";
import { describeDevice } from "@/lib/login-events";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPORT_KINDS, EXPORT_MAX_ROWS } from "@/lib/data-export";
import { ConfigTabs, type ConfigSection } from "@/app/(dashboard)/configuracion/config-tabs";
import { AlertSettingsManager } from "@/app/(dashboard)/configuracion/alert-settings-manager";
import { loadAlertSettings } from "@/lib/alert-settings";
import { FacturacionManager, type ArcaStatusView } from "@/app/(dashboard)/configuracion/facturacion/facturacion-manager";
import { ProLockedCard } from "@/components/dashboard/pro-locked-card";
import { encryptionConfigured } from "@/lib/arca/crypto";
import { ALERT_DEFS } from "@/lib/alert-config";
import { featureMinPlan } from "@/lib/plan-access";


export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; preapproval_id?: string }>;
}) {
  const { tab: tabParam, preapproval_id: preapprovalId } = await searchParams;
  const tab = tabParam;
  // Planes tiene su propia página; los links viejos (y la vuelta de Mercado
  // Pago de suscripciones anteriores) redirigen.
  if (tab === "plan") {
    redirect(preapprovalId ? `/planes?preapproval_id=${encodeURIComponent(preapprovalId)}` : "/planes");
  }
  const { userId, email, organization, membership } = await requireOrgContext();
  // Una sección por vez; Avisos es sólo para dueños y administradores.
  const section: ConfigSection =
    tab === "cuenta"
      ? "cuenta"
      : tab === "avisos" && isOrgAdmin(membership.role)
        ? "avisos"
        : tab === "datos" && isOrgAdmin(membership.role)
          ? "datos"
          : tab === "facturacion" && isOrgAdmin(membership.role)
            ? "facturacion"
            : "negocio";
  const supabase = await createClient();

  const businessType = businessTypes.find((b) => b.value === organization.business_type);

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
  // Avisos (Configuración → Avisos): qué está prendido y qué plan desbloquea cada uno.
  const alertSettings = await loadAlertSettings(supabase, organization.id);
  const alertFeatureLocks = Object.fromEntries(
    ALERT_DEFS.map((d) => [d.id, d.feature && !canUse(subscription, d.feature) ? featureMinPlan[d.feature] : null])
  );
  // Facturación electrónica (Configuración → Facturación): estado sin secretos.
  let arcaStatus: ArcaStatusView | null = null;
  let arcaError: string | null = null;
  if (section === "facturacion" && canUse(subscription, "electronicInvoicing")) {
    const { data, error } = await supabase.rpc("arca_status", { p_org_id: organization.id });
    if (error) arcaError = "No pudimos leer la configuración de facturación (¿falta aplicar la migración 0080?).";
    else arcaStatus = data as unknown as ArcaStatusView;
  }
  const memberLabel = (id: string) => {
    if (id === userId) return "Vos";
    const m = (memberships ?? []).find((x) => x.user_id === id);
    return m?.username ?? m?.email ?? "Usuario eliminado";
  };

  return (
    <div className="space-y-6">
      <ConfigTabs active={section} isAdmin={isOrgAdmin(membership.role)} />
      <div className="max-w-2xl space-y-6">
        {section === "negocio" && (
          <>
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
          </>
        )}

        {section === "facturacion" &&
          (!canUse(subscription, "electronicInvoicing") ? (
            <ProLockedCard
              title="Facturación electrónica"
              plan={featureMinPlan.electronicInvoicing}
              preview="list"
              description="Emití facturas con CAE desde Pesito, con tu CUIT y tu certificado de ARCA."
            />
          ) : arcaError ? (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{arcaError}</p>
          ) : !encryptionConfigured() ? (
            <p className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-foreground">
              La facturación todavía no está activada en el servidor. Falta cargar la variable ARCA_ENCRYPTION_KEY.
            </p>
          ) : (
            arcaStatus && <FacturacionManager status={arcaStatus} orgName={organization.name} />
          ))}

        {section === "avisos" && (
          <>
        {isOrgAdmin(membership.role) && (
          <Card id="avisos" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Avisos</CardTitle>
              <CardDescription>Elegí qué avisos querés recibir y con qué umbral, módulo por módulo.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertSettingsManager
                initial={alertSettings}
                canConfigure={canUse(subscription, "alertSettings")}
                featureLocks={alertFeatureLocks}
              />
            </CardContent>
          </Card>
        )}
          </>
        )}

        {section === "datos" && (
          <Card>
            <CardHeader>
              <CardTitle>Tus datos son tuyos</CardTitle>
              <CardDescription>
                Bajá tu información cuando quieras, en archivos que abre Excel. Sirve de copia de seguridad o para llevártela a otro lado.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {EXPORT_KINDS.map((e) => (
                <form key={e.kind} method="get" action="/configuracion/exportar" className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-end sm:justify-between">
                  <input type="hidden" name="tipo" value={e.kind} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{e.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>
                    {e.ranged && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <label className="flex items-center gap-1.5">
                          Desde
                          <input type="date" name="desde" className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground" />
                        </label>
                        <label className="flex items-center gap-1.5">
                          Hasta
                          <input type="date" name="hasta" className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground" />
                        </label>
                        <span>Sin fechas, baja todo.</span>
                      </div>
                    )}
                  </div>
                  <Button type="submit" variant="outline" className="shrink-0">
                    <Download className="h-4 w-4" />
                    Bajar Excel
                  </Button>
                </form>
              ))}
              <p className="pt-4 text-xs text-muted-foreground">
                {`Cada archivo trae hasta ${EXPORT_MAX_ROWS.toLocaleString("es-AR")} filas (las más recientes): si tenés más, acotá con las fechas. Las fechas están en hora de Argentina.`}
              </p>
            </CardContent>
          </Card>
        )}

        {section === "cuenta" && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
