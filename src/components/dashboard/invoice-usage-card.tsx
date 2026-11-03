import Link from "next/link";
import { formatCount } from "@/lib/invoice-packs";
import { cn } from "@/lib/utils";
import type { InvoiceUsage } from "@/lib/invoice-usage";

// Cuántas facturas lleva el negocio este mes frente a su cupo (plan + paquete). Avisa al 80% y al 100%.
export function InvoiceUsageCard({ usage }: { usage: InvoiceUsage }) {
  const pct = usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;
  const tone = usage.reached ? "danger" : usage.nearLimit ? "warning" : "ok";
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Facturas de este mes</p>
        <p className="text-sm text-muted-foreground">{usage.quota > 0 ? `${formatCount(usage.used)} de ${formatCount(usage.quota)}` : "Sin paquete de facturas"}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {usage.quota === 0
          ? "Sin paquete, las ventas salen como comprobante X (no fiscal)."
          : usage.reached
          ? "Llegaste al cupo: hasta el mes que viene las ventas salen como comprobante X (no fiscal). Las podés facturar después de sumar un paquete."
          : usage.nearLimit
            ? `Te quedan ${formatCount(usage.left)}. Sumá un paquete para no quedarte sin cupo.`
            : "Las notas de crédito cuentan como factura. El cupo se renueva cada mes."}{" "}
        <Link href={`/suscribirse?plan=${usage.planId === "gratis" ? "basico" : usage.planId}`} className="font-medium text-primary hover:underline">
          Sumar un paquete
        </Link>
      </p>
    </div>
  );
}
