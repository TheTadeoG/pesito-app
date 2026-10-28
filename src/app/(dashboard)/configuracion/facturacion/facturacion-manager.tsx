"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  generateArcaCsr,
  issueArcaTestVoucher,
  saveArcaCertificate,
  saveArcaProfile,
  setArcaEnabled,
  testArcaConnection,
  type TestVoucherResult,
} from "./actions";

export interface ArcaStatusView {
  settings: {
    issuer_condition: "monotributo" | "responsable_inscripto" | "exento" | null;
    legal_name: string | null;
    address: string | null;
    gross_income: string | null;
    activity_start: string | null;
    active_environment: "test" | "production";
    enabled: boolean;
  } | null;
  credentials: Partial<
    Record<
      "test" | "production",
      { tax_id: string | null; sales_point: number | null; has_key: boolean; csr_pem: string | null; has_certificate: boolean; verified_at: string | null }
    >
  >;
}

type Env = "test" | "production";

const stepTitle = "text-sm font-semibold text-foreground";

function Message({ text, tone }: { text: string | null; tone: "error" | "ok" }) {
  if (!text) return null;
  return (
    <p className={cn("rounded-xl px-3 py-2 text-sm", tone === "error" ? "bg-danger-bg text-danger" : "bg-success-bg text-success")}>{text}</p>
  );
}

export function FacturacionManager({ status, orgName }: { status: ArcaStatusView; orgName: string }) {
  const s = status.settings;
  const [env, setEnv] = useState<Env>(s?.active_environment ?? "test");
  const cred = status.credentials[env];

  // Paso 1: datos del negocio
  const [cond, setCond] = useState(s?.issuer_condition ?? "");
  const [legalName, setLegalName] = useState(s?.legal_name ?? orgName);
  const [address, setAddress] = useState(s?.address ?? "");
  const [iibb, setIibb] = useState(s?.gross_income ?? "");
  const [start, setStart] = useState(s?.activity_start ?? "");
  // Paso 2: CUIT, punto de venta y solicitud
  const [taxId, setTaxId] = useState(cred?.tax_id ?? status.credentials.test?.tax_id ?? status.credentials.production?.tax_id ?? "");
  const [salesPoint, setSalesPoint] = useState(String(cred?.sales_point ?? ""));
  const [csr, setCsr] = useState<string | null>(cred?.csr_pem ?? null);
  const [certificate, setCertificate] = useState("");

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [points, setPoints] = useState<{ number: number; type: string; blocked: boolean }[] | null>(null);
  const [voucher, setVoucher] = useState<TestVoucherResult["voucher"] | null>(null);
  const [copied, setCopied] = useState(false);

  function run<T extends { error?: string }>(fn: () => Promise<T>, okText: string, after?: (r: T) => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ text: r.error, tone: "error" });
      else {
        setMsg({ text: okText, tone: "ok" });
        after?.(r);
      }
    });
  }

  function switchEnv(next: Env) {
    setEnv(next);
    const c = status.credentials[next];
    setSalesPoint(String(c?.sales_point ?? ""));
    setCsr(c?.csr_pem ?? null);
    setCertificate("");
    setMsg(null);
    setPoints(null);
    setVoucher(null);
  }

  const profileDone = Boolean(s?.issuer_condition && s.legal_name && s.address);
  const hasCsr = Boolean(cred?.has_key && csr);
  const hasCert = Boolean(cred?.has_certificate);
  const verified = Boolean(cred?.verified_at);
  const active = Boolean(s?.enabled && s.active_environment === env);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Facturación electrónica (ARCA)</CardTitle>
          <CardDescription>
            Pesito se conecta a ARCA (ex AFIP) con TU CUIT y TU certificado. La clave privada se guarda cifrada y no sale del servidor. Primero probás en el
            entorno de pruebas (homologación); después repetís los pasos en producción.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
            {(["test", "production"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => switchEnv(e)}
                className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors", env === e ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {e === "test" ? "Pruebas (homologación)" : "Producción"}
              </button>
            ))}
          </div>
          {active && (
            <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {`La facturación está activa en ${env === "test" ? "pruebas: los comprobantes no tienen validez fiscal" : "producción"}.`}
            </p>
          )}
          <Message text={msg?.text ?? null} tone={msg?.tone ?? "ok"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Datos del negocio</CardTitle>
          <CardDescription>Salen impresos en cada comprobante.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="arca-cond">Condición frente al IVA</Label>
              <Select id="arca-cond" value={cond} onChange={(e) => setCond(e.target.value as typeof cond)}>
                <option value="">Elegí…</option>
                <option value="monotributo">Monotributista (Factura C)</option>
                <option value="responsable_inscripto">Responsable inscripto (Factura A / B)</option>
                <option value="exento">IVA exento (Factura C)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="arca-name">Razón social o nombre</Label>
              <Input id="arca-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="arca-address">Domicilio comercial</Label>
              <Input id="arca-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, localidad" />
            </div>
            <div>
              <Label htmlFor="arca-iibb">Ingresos Brutos (opcional)</Label>
              <Input id="arca-iibb" value={iibb} onChange={(e) => setIibb(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="arca-start">Inicio de actividades (opcional)</Label>
              <Input id="arca-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>
          <Button
            disabled={pending}
            onClick={() => run(() => saveArcaProfile({ issuerCondition: cond, legalName, address, grossIncome: iibb, activityStart: start }), "Datos guardados.")}
          >
            Guardar datos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{`2. Pedir el certificado a ARCA (${env === "test" ? "pruebas" : "producción"})`}</CardTitle>
          <CardDescription>
            Con tu CUIT y el punto de venta generamos una solicitud (CSR). Se la entregás a ARCA y ARCA te devuelve el certificado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="arca-cuit">CUIT (sin guiones)</Label>
              <Input id="arca-cuit" inputMode="numeric" maxLength={11} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label htmlFor="arca-pv">Punto de venta</Label>
              <Input id="arca-pv" inputMode="numeric" value={salesPoint} onChange={(e) => setSalesPoint(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 3" />
            </div>
          </div>
          <Button
            disabled={pending || !profileDone}
            title={profileDone ? undefined : "Guardá primero los datos del negocio"}
            onClick={() =>
              run(() => generateArcaCsr({ environment: env, taxId, salesPoint: Number(salesPoint) }), "Solicitud generada. Copiala y seguí los pasos de abajo.", (r) => {
                setCsr(r.csr ?? null);
              })
            }
          >
            {hasCsr ? "Generar una solicitud nueva" : "Generar solicitud"}
          </Button>
          {hasCsr && csr && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={stepTitle}>Tu solicitud (CSR)</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    void navigator.clipboard.writeText(csr).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copiada" : "Copiar"}
                </button>
              </div>
              <textarea readOnly value={csr} rows={6} className="w-full rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground" />
              {env === "test" ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Entrá a ARCA con tu clave fiscal (persona física, nivel 2 o más) y abrí el servicio <b>WSASS - Autogestión Certificados Homologación</b>. Si no aparece, agregalo desde Administrador de Relaciones.</li>
                  <li>En «Nuevo Certificado» ponés un alias, pegás esta solicitud y tocás «Crear DN y Obtener Certificado». El certificado aparece en pantalla: copialo entero.</li>
                  <li>En «Crear autorización a servicio» elegís ese alias, tu CUIT y el servicio <b>wsfe - Facturación Electrónica</b>.</li>
                  <li>Dá de alta un punto de venta de homologación en «Administración de Puntos de Venta y Domicilios» (sistema para Web Services).</li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Entrá a ARCA con tu clave fiscal y abrí <b>Administración de Certificados Digitales</b>. Si no aparece, agregalo desde Administrador de Relaciones.</li>
                  <li>«Agregar alias»: ponés un nombre y subís esta solicitud (guardala como archivo .csr). Después, en la lista, descargá el certificado (.crt) y abrilo con un editor de texto para copiar su contenido.</li>
                  <li>En Administrador de Relaciones → Nueva Relación: servicio <b>Facturación Electrónica</b> (Webservices) y, como representante, el alias que creaste.</li>
                  <li>Asegurate de tener un punto de venta para Web Services habilitado (Monotributo: «Factura Electrónica – Monotributo – Web Services»; Responsable inscripto: «RECE para aplicativo y Web Services»).</li>
                </ol>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Pegar el certificado</CardTitle>
          <CardDescription>El texto que te dio ARCA, desde -----BEGIN CERTIFICATE----- hasta -----END CERTIFICATE-----.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasCert && <p className="text-sm text-success">Ya hay un certificado cargado para este entorno. Si pegás otro, lo reemplaza.</p>}
          <textarea
            value={certificate}
            onChange={(e) => setCertificate(e.target.value)}
            rows={6}
            placeholder="-----BEGIN CERTIFICATE-----"
            disabled={!hasCsr}
            className="w-full rounded-xl border border-border bg-card p-3 font-mono text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          <Button disabled={pending || !hasCsr || certificate.trim().length < 50} onClick={() => run(() => saveArcaCertificate({ environment: env, certificate }), "Certificado guardado.", () => setCertificate(""))}>
            Guardar certificado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Probar la conexión y activar</CardTitle>
          <CardDescription>Entramos a ARCA con tu certificado y miramos que tu punto de venta esté habilitado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending || !hasCert}
              onClick={() =>
                run(() => testArcaConnection(env), "¡Conexión con ARCA lista!", (r) => setPoints(r.salesPoints ?? null))
              }
            >
              Probar la conexión
            </Button>
            <Button disabled={pending || !verified} onClick={() => run(() => setArcaEnabled({ enabled: !active, environment: env }), active ? "Facturación apagada." : "Facturación activada.")}>
              {active ? "Apagar la facturación" : `Activar en ${env === "test" ? "pruebas" : "producción"}`}
            </Button>
            {env === "test" && (
              <Button
                variant="outline"
                disabled={pending || !verified}
                onClick={() => run(() => issueArcaTestVoucher(), "ARCA autorizó el comprobante de prueba.", (r) => setVoucher(r.voucher ?? null))}
              >
                Emitir comprobante de prueba
              </Button>
            )}
          </div>
          {verified && <p className="text-xs text-muted-foreground">{`Última conexión correcta: ${new Date(cred!.verified_at!).toLocaleString("es-AR")}`}</p>}
          {points && points.length > 0 && (
            <p className="text-sm text-muted-foreground">{`Puntos de venta para Web Services en ARCA: ${points.map((p) => `${p.number}${p.blocked ? " (bloqueado)" : ""}`).join(", ")}.`}</p>
          )}
          {voucher && (
            <div className="rounded-xl bg-success-bg px-3 py-2 text-sm text-foreground">
              {`Comprobante de prueba Nº ${String(voucher.salesPoint).padStart(5, "0")}-${String(voucher.number).padStart(8, "0")} (tipo ${voucher.voucherType}) · CAE ${voucher.cae} · vence ${voucher.caeExpiry}`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
