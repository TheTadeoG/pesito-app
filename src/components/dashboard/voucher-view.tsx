"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import qrcode from "qrcode-generator";
import { Printer } from "lucide-react";
import type { VoucherDocument } from "facturas";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getVoucherView, type VoucherView as VoucherData } from "@/lib/actions/vouchers";
import { cn, formatCurrency } from "@/lib/utils";

export type VoucherFormat = "ticket" | "a4";
const FORMAT_KEY = "pesito-voucher-format";

const money = (minor: number) => formatCurrency(minor / 100);
const day = (iso: string) => iso.split("-").reverse().join("/");

// El QR se dibuja en el navegador con una librería de ~5 KB: el servidor no genera imágenes ni PDF.
function QrCode({ url, size }: { url: string; size: number }) {
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
    } catch {
      return null;
    }
  }, [url]);
  if (!svg) return null;
  return <div aria-label="Código QR de ARCA" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Legends({ doc }: { doc: VoucherDocument }) {
  return (
    <>
      {doc.letterLegend && <p className="ticket-center ticket-small">{doc.letterLegend}</p>}
      {doc.legends.map((l) => (
        <p key={l.rule} className="ticket-small">
          {l.text}
        </p>
      ))}
    </>
  );
}

/** Comprobante en ticket (58/80 mm), con el mismo look que el ticket de venta. */
function TicketVoucher({ doc, data }: { doc: VoucherDocument; data: VoucherData }) {
  return (
    <>
      {data.environment === "test" && <p className="ticket-center ticket-bold">COMPROBANTE DE PRUEBA</p>}
      <p className="ticket-center ticket-bold ticket-big">{doc.issuer.tradeName ?? doc.issuer.legalName}</p>
      {doc.issuer.tradeName && <p className="ticket-center">{doc.issuer.legalName}</p>}
      <p className="ticket-center">{doc.issuer.address}</p>
      <p className="ticket-center">CUIT {doc.issuer.taxId}</p>
      <p className="ticket-center">{doc.issuer.conditionLegend}</p>
      <p className="ticket-center">IIBB {doc.issuer.grossIncome}</p>
      {doc.issuer.activitiesStartDate && <p className="ticket-center">Inicio de actividades {day(doc.issuer.activitiesStartDate)}</p>}
      <hr />
      <p className="ticket-center ticket-bold ticket-big">{`${doc.title} ${doc.voucherClass}`}</p>
      <p className="ticket-center">{`Cód. ${doc.code} · Nº ${doc.number}`}</p>
      <p className="ticket-center">{`Fecha ${day(doc.issueDate)}`}</p>
      <hr />
      <p>{doc.receiver.name ?? "Consumidor Final"}</p>
      {doc.receiver.document && <p>{`${doc.receiver.document.label ?? "Doc."} ${doc.receiver.document.number}`}</p>}
      <p>{doc.receiver.conditionLegend}</p>
      <p>{`Condición de venta: ${doc.saleConditions}`}</p>
      <hr />
      {doc.lines.map((l, i) => (
        <div key={i} className="ticket-line">
          <p>{l.description}</p>
          <div className="ticket-row">
            <span>{`${l.quantity} x ${formatCurrency(Number(l.unitPrice))}`}</span>
            <span>{money(l.amount)}</span>
          </div>
        </div>
      ))}
      <hr />
      {doc.totals.vatRates.map((v) => (
        <div key={v.id} className="ticket-row">
          <span>{`IVA ${v.rate ?? ""}%`}</span>
          <span>{money(v.amount)}</span>
        </div>
      ))}
      <div className="ticket-row ticket-bold ticket-big">
        <span>TOTAL</span>
        <span>{money(doc.totals.total)}</span>
      </div>
      <hr />
      <p className="ticket-center ticket-bold">{`CAE ${doc.authorization.code}`}</p>
      <p className="ticket-center ticket-bold">{`Vto. CAE ${day(doc.authorization.dueDate)}`}</p>
      {data.qr && (
        <div className="ticket-center" style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
          <QrCode url={data.qr} size={110} />
        </div>
      )}
      <Legends doc={doc} />
    </>
  );
}

/** Comprobante en A4: encabezado con la letra, datos del receptor, detalle y pie con CAE y QR. */
function A4Voucher({ doc, data }: { doc: VoucherDocument; data: VoucherData }) {
  const cell = "border-b border-black/20 px-2 py-1";
  return (
    <div className="voucher-a4-body" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, color: "#000" }}>
      {data.environment === "test" && <p style={{ textAlign: "center", fontWeight: 700 }}>COMPROBANTE DE PRUEBA — SIN VALOR FISCAL</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", border: "1px solid #000" }}>
        <div style={{ padding: 10 }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{doc.issuer.tradeName ?? doc.issuer.legalName}</p>
          {doc.issuer.tradeName && <p>{`Razón social: ${doc.issuer.legalName}`}</p>}
          <p>{doc.issuer.address}</p>
          <p>{doc.issuer.conditionLegend}</p>
        </div>
        <div style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", textAlign: "center", padding: 6 }}>
          <p style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{doc.voucherClass}</p>
          <p style={{ fontSize: 10 }}>{`Cód. ${doc.code}`}</p>
        </div>
        <div style={{ padding: 10 }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{doc.title}</p>
          <p>{`Nº ${doc.number}`}</p>
          <p>{`Fecha de emisión: ${day(doc.issueDate)}`}</p>
          <p>{`CUIT: ${doc.issuer.taxId}`}</p>
          <p>{`Ingresos Brutos: ${doc.issuer.grossIncome}`}</p>
          {doc.issuer.activitiesStartDate && <p>{`Inicio de actividades: ${day(doc.issuer.activitiesStartDate)}`}</p>}
        </div>
      </div>
      <div style={{ border: "1px solid #000", borderTop: 0, padding: 10, marginBottom: 10 }}>
        <p>{`Cliente: ${doc.receiver.name ?? "Consumidor Final"}`}</p>
        {doc.receiver.document && <p>{`${doc.receiver.document.label ?? "Documento"}: ${doc.receiver.document.number}`}</p>}
        {doc.receiver.address && <p>{`Domicilio: ${doc.receiver.address}`}</p>}
        <p>{`Condición frente al IVA: ${doc.receiver.conditionLegend}`}</p>
        <p>{`Condición de venta: ${doc.saleConditions}`}</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eee", textAlign: "left" }}>
            <th className={cell}>Descripción</th>
            <th className={cell} style={{ textAlign: "right" }}>Cant.</th>
            <th className={cell} style={{ textAlign: "right" }}>Precio unit.</th>
            <th className={cell} style={{ textAlign: "right" }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i}>
              <td className={cell}>{l.description}</td>
              <td className={cell} style={{ textAlign: "right" }}>{l.quantity}</td>
              <td className={cell} style={{ textAlign: "right" }}>{formatCurrency(Number(l.unitPrice))}</td>
              <td className={cell} style={{ textAlign: "right" }}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginLeft: "auto", width: 260, marginTop: 10 }}>
        <div className="ticket-row"><span>Subtotal</span><span>{money(doc.totals.subtotal)}</span></div>
        {doc.totals.vatRates.map((v) => (
          <div key={v.id} className="ticket-row"><span>{`IVA ${v.rate ?? ""}%`}</span><span>{money(v.amount)}</span></div>
        ))}
        {doc.totals.otherTaxes.map((t) => (
          <div key={t.id} className="ticket-row"><span>{t.description}</span><span>{money(t.amount)}</span></div>
        ))}
        <div className="ticket-row" style={{ fontSize: 16, fontWeight: 700, borderTop: "1px solid #000", marginTop: 4, paddingTop: 4 }}>
          <span>TOTAL</span>
          <span>{money(doc.totals.total)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, borderTop: "1px solid #000", paddingTop: 10 }}>
        {data.qr && <QrCode url={data.qr} size={110} />}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700 }}>{`CAE Nº ${doc.authorization.code}`}</p>
          <p style={{ fontWeight: 700, fontSize: 14 }}>{`Fecha de vto. de CAE: ${day(doc.authorization.dueDate)}`}</p>
          <Legends doc={doc} />
        </div>
      </div>
    </div>
  );
}

export function VoucherDocumentView({ data, format }: { data: VoucherData; format: VoucherFormat }) {
  const doc = data.document;
  if (!doc) {
    return (
      <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">
        {`El comprobante está autorizado por ARCA (CAE ${data.cae ?? "—"}), pero no pudimos armar el documento para imprimir${data.documentError ? `: ${data.documentError}` : "."}`}
      </p>
    );
  }
  return format === "ticket" ? <TicketVoucher doc={doc} data={data} /> : <A4Voucher doc={doc} data={data} />;
}

/**
 * Ver y reimprimir un comprobante electrónico. Todo el trabajo es del navegador: el servidor sólo lee la fila
 * guardada. Imprime con el mismo mecanismo que el ticket de venta (se monta en el body y se oculta lo demás).
 */
export function VoucherDialog({
  voucherId,
  onClose,
  initialFormat,
}: {
  voucherId: string | null;
  onClose: () => void;
  /** Formato con el que se abre (si no, el último que eligió esta persona). */
  initialFormat?: VoucherFormat;
}) {
  const [data, setData] = useState<VoucherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<VoucherFormat>("ticket");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FORMAT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "a4" || saved === "ticket") setFormat(saved);
    } catch {
      // sin localStorage: queda el ticket
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (voucherId && initialFormat) setFormat(initialFormat);
  }, [voucherId, initialFormat]);

  useEffect(() => {
    if (!voucherId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setError(null);
    void getVoucherView(voucherId).then((res) => {
      if (cancelled) return;
      if (res.voucher) setData(res.voucher);
      else setError(res.error ?? "No pudimos cargar el comprobante.");
    });
    return () => {
      cancelled = true;
    };
  }, [voucherId]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  function pick(next: VoucherFormat) {
    setFormat(next);
    try {
      window.localStorage.setItem(FORMAT_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Dialog open={Boolean(voucherId)} onClose={onClose} title={data?.kind === "credit_note" ? "Nota de crédito electrónica" : "Factura electrónica (fiscal)"} description={data?.environment === "test" ? "Comprobante de prueba: no tiene valor fiscal." : undefined}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex gap-0.5 rounded-xl border border-border bg-muted p-0.5">
              {(["ticket", "a4"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => pick(f)}
                  className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", format === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {f === "ticket" ? "Ticket 80 mm" : "Hoja A4"}
                </button>
              ))}
            </div>
            <Button disabled={!data?.document} onClick={() => setPrinting(true)}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
          {!data && !error && <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>}
          {data && (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-white p-3 text-black">
              <div className={format === "ticket" ? "mx-auto max-w-[300px] font-mono text-[11px] leading-snug" : ""}>
                <VoucherDocumentView data={data} format={format} />
              </div>
            </div>
          )}
        </div>
      </Dialog>
      {printing && data?.document &&
        createPortal(
          <div className={cn("voucher-print", format === "a4" ? "voucher-print-a4" : "ticket-print")}>
            <VoucherDocumentView data={data} format={format} />
          </div>,
          document.body
        )}
    </>
  );
}
