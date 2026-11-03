"use client";

import { certificateFromFile } from "@/lib/arca/cert-file";
import { SceneCsr, SceneDownload, SceneDrop, ScenePuntoVenta, SceneRelation, SceneSearch, SceneTree, SceneUpload } from "@/app/(dashboard)/configuracion/facturacion/arca-scenes";
import { AUTO_INVOICE_METHODS } from "@/lib/arca/auto-invoice";
import { VoucherDialog } from "@/components/dashboard/voucher-view";
import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Download, Upload } from "lucide-react";
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
  saveArcaSalesPoint,
  saveArcaAutoMethods,
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
    auto_invoice_methods: string[];
  } | null;
  credentials: Partial<
    Record<
      "test" | "production",
      { tax_id: string | null; sales_point: number | null; has_key: boolean; csr_pem: string | null; has_certificate: boolean; verified_at: string | null }
    >
  >;
}

type Env = "test" | "production";


// Un paso del asistente: título grande, un dibujo animado (opcional) y muy poco texto.
function WizardStep({ title, scene, children }: { title: string; scene?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {scene}
      <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function AliasInline({ alias }: { alias: string }) {
  return <code className="rounded-md bg-accent px-1.5 py-0.5 font-mono text-[13px] font-semibold text-accent-foreground">{alias}</code>;
}

// El alias es el nombre con el que ARCA conoce a tu certificado: se escribe al crearlo y se vuelve a elegir al autorizarlo.
function AliasNote({ alias }: { alias: string }) {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-foreground">
      <p className="font-semibold">Acordate del alias</p>
      <p className="mt-0.5 text-muted-foreground">
        En ARCA vas a escribir un nombre para tu certificado (el <b>alias</b>) y después tenés que elegirlo de nuevo para autorizarlo. Usá siempre el mismo:{" "}
        <AliasInline alias={alias} />. Anotalo.
      </p>
    </div>
  );
}

// Zona para arrastrar el archivo del certificado, o tocar para elegirlo.
function CertDrop({ onFile, disabled, hasCert }: { onFile: (file: File) => void; disabled: boolean; hasCert: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !disabled) onFile(file);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center text-sm transition-colors",
        over ? "border-primary bg-accent/50" : "border-border hover:border-primary/50 hover:bg-muted/40",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <Upload className="h-6 w-6 text-primary" />
      <span className="font-medium text-foreground">{hasCert ? "Arrastrá otro archivo .crt o tocá para elegirlo" : "Arrastrá acá el archivo .crt o tocá para elegirlo"}</span>
      <span className="text-xs text-muted-foreground">El que descargaste de ARCA, sin abrirlo.</span>
      <input
        type="file"
        accept=".crt,.cer,.pem,.txt"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function Message({ text, tone }: { text: string | null; tone: "error" | "ok" }) {
  if (!text) return null;
  return (
    <p className={cn("rounded-xl px-3 py-2 text-sm", tone === "error" ? "bg-danger-bg text-danger" : "bg-success-bg text-success")}>{text}</p>
  );
}

export function FacturacionManager({ status, orgName }: { status: ArcaStatusView; orgName: string }) {
  const s = status.settings;
  const [env, setEnv] = useState<Env>(s?.active_environment ?? "production");
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
  const [viewVoucher, setViewVoucher] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Facturación automática por medio de pago
  const [autoMethods, setAutoMethods] = useState<string[]>(s?.auto_invoice_methods ?? []);

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

  // Alias que se sugiere en ARCA: el mismo en todos los pasos para no perderlo.
  const alias = "pesito";

  // Un archivo .crt/.cer/.pem arrastrado o elegido: se lee acá y se guarda enseguida (el servidor comprueba que corresponda).
  async function handleCertFile(file: File) {
    const pem = certificateFromFile(new Uint8Array(await file.arrayBuffer()));
    if (!pem) {
      setMsg({ text: "Ese archivo no parece un certificado. Tiene que ser el .crt que descargaste de ARCA.", tone: "error" });
      return;
    }
    setCertificate(pem);
    run(() => saveArcaCertificate({ environment: env, certificate: pem }), `Certificado «${file.name}» guardado.`, () => setCertificate(""));
  }

  // Asistente de ARCA: un paso por pantalla. Arranca donde quedó la persona.
  const stepsFor = (e: Env) => (e === "production" ? ["pv", "solicitud", "descargar", "subir", "bajar", "cert", "servicio", "representante"] : ["solicitud", "copiar", "wsass", "cert", "autorizar"]);
  const startStep = (e: Env) => {
    const c = status.credentials[e];
    const list = stepsFor(e);
    if (c?.has_certificate) return e === "production" ? "servicio" : "autorizar";
    if (c?.has_key && c.csr_pem) return list[list.indexOf("solicitud") + 1];
    return list[0];
  };
  const [wizard, setWizard] = useState<string>(() => startStep(env));
  const steps = stepsFor(env);
  const stepIndex = Math.max(0, steps.indexOf(wizard));
  const goNext = () => setWizard(steps[Math.min(steps.length - 1, stepIndex + 1)]);
  const goBack = () => setWizard(steps[Math.max(0, stepIndex - 1)]);

  function switchEnv(next: Env) {
    setEnv(next);
    setWizard(startStep(next));
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
          <CardTitle>Vincular ARCA</CardTitle>
          <CardDescription>
            Conectá tu CUIT con ARCA (ex AFIP) para emitir facturas desde Pesito. Te guiamos paso a paso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {env === "test" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-bg px-4 py-3 text-sm text-foreground">
              <p>
                <b>Modo de pruebas.</b> Las facturas que hagas acá <b>no tienen valor fiscal</b>: sirven para practicar.
              </p>
              <Button size="sm" variant="outline" onClick={() => switchEnv("production")}>
                Volver a vincular ARCA
              </Button>
            </div>
          ) : null}
          {active && (
            <p className="flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {env === "test" ? "La facturación está activa en modo de pruebas: los comprobantes no tienen validez fiscal." : "La facturación está activa."}
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
          <CardTitle className="text-base">2. Conectar con ARCA</CardTitle>
          <CardDescription>Un paso por vez. Cada uno dice qué tocar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-1.5" aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}>
            {steps.map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => setWizard(id)}
                aria-label={`Ir al paso ${i + 1}`}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", i < stepIndex ? "bg-primary/60" : i === stepIndex ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">{`Paso ${stepIndex + 1} de ${steps.length}`}</p>

          {wizard === "pv" && (
            <WizardStep
              title="Creá tu punto de venta en ARCA"
              scene={<ScenePuntoVenta system={cond === "responsable_inscripto" || cond === "exento" ? "RECE para aplicativo y web services" : "Factura Electrónica – Monotributo – Web Services"} />}
            >
              <p>
                En <b>Administración de Puntos de Venta y Domicilios</b>, agregá uno. En <b>Sistema</b> elegí el que corresponde a tu condición:
              </p>
              <ul className="space-y-1.5">
                <li className={cn("rounded-lg border px-3 py-2", cond === "monotributo" || !cond ? "border-primary/50 bg-accent/40 text-foreground" : "border-border opacity-60")}>
                  <b>Monotributista:</b> «Factura Electrónica – Monotributo – Web Services»
                </li>
                <li className={cn("rounded-lg border px-3 py-2", cond === "responsable_inscripto" || cond === "exento" || !cond ? "border-primary/50 bg-accent/40 text-foreground" : "border-border opacity-60")}>
                  <b>Responsable inscripto (o IVA exento):</b> «RECE para aplicativo y web services»
                </li>
              </ul>
              {!cond && <p className="text-xs">Elegí tu condición frente al IVA en el paso 1 y te marco la que te toca.</p>}
              <div className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-foreground">
                <p className="font-semibold">Acordate del número del punto de venta</p>
                <p className="mt-0.5 text-muted-foreground">Anotalo: en el último paso vas a tener que elegir <b>el mismo</b> que creás ahora.</p>
              </div>
            </WizardStep>
          )}

          {wizard === "solicitud" && (
            <WizardStep title="Generá tu solicitud">
              <div className="max-w-xs text-foreground">
                <Label htmlFor="arca-cuit">CUIT (sin guiones)</Label>
                <Input id="arca-cuit" inputMode="numeric" maxLength={11} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))} />
              </div>
              <p className="text-xs">El certificado es de tu CUIT y sirve para cualquier punto de venta. El punto de venta lo elegís al final.</p>
              <Button
                disabled={pending || !profileDone}
                title={profileDone ? undefined : "Guardá primero los datos del negocio (paso 1)"}
                onClick={() =>
                  run(() => generateArcaCsr({ environment: env, taxId }), "Solicitud generada.", (r) => {
                    setCsr(r.csr ?? null);
                    goNext();
                  })
                }
              >
                {hasCsr ? "Generar una solicitud nueva" : "Generar solicitud"}
              </Button>
              {hasCsr && <p className="text-xs">Si generás otra, el certificado que ya tengas deja de servir.</p>}
            </WizardStep>
          )}

          {wizard === "descargar" && (
            <WizardStep title="Descargá el archivo" scene={<SceneCsr />}>
              {csr ? (
                <Button
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([csr], { type: "application/pkcs10" }));
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = env === "test" ? "pesito-pruebas.csr" : "pesito.csr";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4" />
                  Descargar archivo .csr
                </Button>
              ) : (
                <p>Primero generá la solicitud.</p>
              )}
            </WizardStep>
          )}

          {wizard === "copiar" && (
            <WizardStep title="Copiá la solicitud">
              <p>WSASS pide pegar el texto, no subir el archivo.</p>
              <Button
                disabled={!csr}
                onClick={() => {
                  if (!csr) return;
                  void navigator.clipboard.writeText(csr).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copiada" : "Copiar solicitud"}
              </Button>
            </WizardStep>
          )}

          {wizard === "subir" && (
            <WizardStep title="Subila a ARCA" scene={<SceneUpload />}>
              <p>
                <b>Administración de Certificados Digitales</b> → <b>Agregar alias</b>. Alias: <AliasInline alias={alias} />. Elegí el archivo.
              </p>
              <AliasNote alias={alias} />
            </WizardStep>
          )}

          {wizard === "wsass" && (
            <WizardStep title="Pegala en ARCA (WSASS)" scene={<SceneSearch query="WSASS - Autogestión Certificados Homologación" />}>
              <p>
                <b>Nuevo Certificado</b>. Alias: <AliasInline alias={alias} />. Pegá la solicitud y tocá <b>Crear DN y Obtener Certificado</b>. Guardá el resultado como archivo <b>.crt</b>.
              </p>
              <AliasNote alias={alias} />
            </WizardStep>
          )}

          {wizard === "bajar" && (
            <WizardStep title="Bajá tu certificado" scene={<SceneDownload />}>
              <p>
                En la lista, tocá <b>Ver</b> junto a <AliasInline alias={alias} />. A la derecha aparece <b>Descargar</b>: tocalo. No abras el archivo.
              </p>
            </WizardStep>
          )}

          {wizard === "cert" && (
            <WizardStep title="Subí el certificado .crt que descargaste de ARCA" scene={<SceneDrop />}>
              <CertDrop disabled={!hasCsr || pending} onFile={(file) => void handleCertFile(file)} hasCert={hasCert} />
              {hasCert && <p className="text-sm text-success">Certificado cargado.</p>}
              <details className="text-xs">
                <summary className="cursor-pointer">Prefiero pegar el texto</summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    value={certificate}
                    onChange={(e) => setCertificate(e.target.value)}
                    rows={5}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="w-full rounded-xl border border-border bg-card p-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                  />
                  <Button size="sm" disabled={pending || certificate.trim().length < 50} onClick={() => run(() => saveArcaCertificate({ environment: env, certificate }), "Certificado guardado.", () => setCertificate(""))}>
                    Guardar certificado
                  </Button>
                </div>
              </details>
            </WizardStep>
          )}

          {wizard === "servicio" && (
            <WizardStep title="Elegí el servicio de facturación" scene={<SceneTree title="Nueva relación" items={["Buscar", "ARCA", "WebServices", "Facturación Electrónica"]} />}>
              <p>
                <b>Administrador de Relaciones</b> → <b>Nueva relación</b> → <b>Buscar</b> → <b>ARCA</b> → <b>WebServices</b> → <b>Facturación Electrónica</b>.
              </p>
            </WizardStep>
          )}

          {wizard === "representante" && (
            <WizardStep title="Elegí tu alias como representante" scene={<SceneRelation />}>
              <p>
                <b>Representante</b> → <b>Buscar</b> → <b>Computador Fiscal</b> → <AliasInline alias={alias} /> → <b>Confirmar</b>.
              </p>
              <AliasNote alias={alias} />
              <p className="text-xs">Puede tardar unos minutos. Después seguí con el paso 3.</p>
            </WizardStep>
          )}

          {wizard === "autorizar" && (
            <WizardStep title="Autorizá tu alias" scene={<SceneTree title="WSASS" items={["Crear autorización a servicio", "wsfe", "pesito"]} />}>
              <p>
                En WSASS: <b>Crear autorización a servicio</b> → servicio <b>wsfe</b> → alias <AliasInline alias={alias} />.
              </p>
              <AliasNote alias={alias} />
              <p className="text-xs">Después seguí con el paso 3.</p>
            </WizardStep>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="outline" disabled={stepIndex === 0} onClick={goBack}>
              Atrás
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button disabled={(wizard === "solicitud" && !hasCsr) || (wizard === "cert" && !hasCert)} onClick={goNext}>
                {wizard === "pv" ? "Ya lo creé" : "Siguiente"}
              </Button>
            ) : (
              // Último paso: lleva al paso 3 (probar la conexión), que está más abajo.
              <Button onClick={() => document.getElementById("arca-conectar")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <CheckCircle2 className="h-4 w-4" />
                Listo, seguir al paso 3
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="arca-conectar" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">3. Probar la conexión</CardTitle>
          <CardDescription>Entramos a ARCA con tu certificado y miramos que tu punto de venta esté habilitado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <details className="rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">¿ARCA no acepta el certificado?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {env === "production"
                  ? "Falta autorizar el certificado para facturar: Administrador de Relaciones → Nueva relación → ARCA → WebServices → «Facturación Electrónica». En «Representante» elegí el alias que creaste. Puede tardar unos minutos en aplicarse."
                  : "Falta autorizar el certificado para facturar: en WSASS, «Crear autorización a servicio» con el alias, tu CUIT y el servicio «wsfe»."}
              </li>
              <li>{`Tiene que ser un certificado ${env === "test" ? "de pruebas (WSASS)" : "creado en Administración de Certificados Digitales"}: no se pueden mezclar.`}</li>
              <li>Tiene que ser el certificado de la última solicitud que generaste acá. Si generaste otra después, el certificado viejo ya no sirve.</li>
              <li>El CUIT de acá, el de tu clave fiscal y el del alias tienen que ser el mismo.</li>
            </ul>
          </details>
          <div className="space-y-2 rounded-xl border border-border px-3.5 py-3">
            <Label htmlFor="arca-pv">Punto de venta con el que facturás</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="arca-pv" inputMode="numeric" className="w-28" value={salesPoint} onChange={(e) => setSalesPoint(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 3" />
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !hasCsr || !salesPoint}
                onClick={() => run(() => saveArcaSalesPoint({ environment: env, salesPoint: Number(salesPoint) }), "Punto de venta guardado. Probá la conexión.")}
              >
                Guardar
              </Button>
              {cred?.sales_point && <span className="text-xs text-muted-foreground">{`Guardado: ${cred.sales_point}`}</span>}
            </div>
            {points && points.filter((p) => !p.blocked).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Habilitados en ARCA:</span>
                {points
                  .filter((p) => !p.blocked)
                  .map((p) => (
                    <button
                      key={p.number}
                      type="button"
                      onClick={() => {
                        setSalesPoint(String(p.number));
                        run(() => saveArcaSalesPoint({ environment: env, salesPoint: p.number }), `Punto de venta ${p.number} guardado. Probá la conexión.`);
                      }}
                      className="rounded-full border border-border px-2.5 py-1 font-medium text-foreground hover:border-primary hover:bg-accent"
                    >
                      {`Usar el ${p.number}`}
                    </button>
                  ))}
              </div>
            )}
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-foreground">
              Elegí <b>el mismo punto de venta que creaste en ARCA</b> en el primer paso (el de Web Services). Si usás otro, ARCA va a rechazar las facturas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={verified ? "outline" : "primary"}
              disabled={pending || !hasCert}
              onClick={() =>
                run(() => testArcaConnection(env), "¡Conexión con ARCA lista!", (r) => setPoints(r.salesPoints ?? null))
              }
            >
              {pending ? "Probando…" : verified ? "Probar de nuevo" : "Probar la conexión"}
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
          {verified && (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-bg px-4 py-3" role="status">
              <span className="arca-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-success">Conexión con ARCA lista</p>
                <p className="text-xs text-muted-foreground">
                  {`${cred?.sales_point ? `Punto de venta ${cred.sales_point} habilitado. ` : ""}Última prueba: ${new Date(cred!.verified_at!).toLocaleString("es-AR")}.`}
                </p>
              </div>
            </div>
          )}
          {points && points.length > 0 && (
            <p className="text-sm text-muted-foreground">{`Puntos de venta para Web Services en ARCA: ${points.map((p) => `${p.number}${p.blocked ? " (bloqueado)" : ""}`).join(", ")}.`}</p>
          )}
          {voucher && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success-bg px-3 py-2 text-sm text-foreground">
              <span>{`Comprobante de prueba Nº ${String(voucher.salesPoint).padStart(5, "0")}-${String(voucher.number).padStart(8, "0")} (tipo ${voucher.voucherType}) · CAE ${voucher.cae} · vence ${voucher.caeExpiry}`}</span>
              {voucher.id && (
                <Button size="sm" variant="outline" onClick={() => setViewVoucher(voucher.id)}>
                  Ver e imprimir la factura
                </Button>
              )}
            </div>
          )}
          <VoucherDialog voucherId={viewVoucher} onClose={() => setViewVoucher(null)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Prender o apagar la facturación</CardTitle>
          <CardDescription>
            Prendida, las ventas se facturan según lo que elijas más abajo (a mano o automático por medio de pago). Apagarla no borra nada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", active ? "bg-success" : "bg-muted-foreground/40")} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {`Facturación ${active ? "prendida" : "apagada"}${env === "test" ? " (modo de pruebas)" : ""}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {verified ? (active ? "Las ventas se pueden facturar." : "No se factura nada hasta que la prendas.") : "Probá la conexión (paso 3) para poder prenderla."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Prender o apagar la facturación"
              disabled={pending || !verified}
              onClick={() => run(() => setArcaEnabled({ enabled: !active, environment: env }), active ? "Facturación apagada." : "Facturación prendida.")}
              className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", active ? "bg-success" : "bg-muted")}
            >
              <span className={cn("absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", active ? "translate-x-[1.375rem]" : "translate-x-0.5")} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturación automática por medio de pago</CardTitle>
          <CardDescription>
            Elegí, para cada medio de pago, si Pesito emite la factura sola al cobrar (Automática) o si la hacés vos con el botón «Facturar» en la venta (Manual).
            Al principio todo está en Manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="divide-y divide-border rounded-xl border border-border">
            {AUTO_INVOICE_METHODS.map((m) => {
              const on = autoMethods.includes(m.id);
              const set = (auto: boolean) => setAutoMethods((cur) => (auto ? (cur.includes(m.id) ? cur : [...cur, m.id]) : cur.filter((x) => x !== m.id)));
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{m.label}</span>
                    {m.note && <span className="block text-xs text-muted-foreground">{m.note}</span>}
                  </span>
                  {/* Dos opciones a la vista: la elegida va con color y tilde. */}
                  <span role="radiogroup" aria-label={`Facturación de ${m.label}`} className="inline-flex shrink-0 gap-0.5 rounded-xl border border-border bg-muted p-0.5">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!on}
                      onClick={() => set(false)}
                      className={cn("w-[6.5rem] rounded-lg py-1.5 text-center text-xs font-semibold transition-colors", !on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set(true)}
                      className={cn("flex w-[6.5rem] items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-colors", on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {on && <CheckCircle2 className="h-3.5 w-3.5" />}
                      Automática
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <Button disabled={pending} onClick={() => run(() => saveArcaAutoMethods(autoMethods), "Guardado.")}>
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
