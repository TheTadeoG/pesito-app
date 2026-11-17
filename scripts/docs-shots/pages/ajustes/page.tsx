"use client";
// Pantalla de prueba SÓLO para sacar las imágenes de /ayuda (ver scripts/docs-shots/README.md). No se publica.
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/toast/toast-provider";
import { PaymentMethodsManager } from "@/app/(dashboard)/configuracion/payment-methods-manager";
import { TicketOptions } from "@/app/(dashboard)/configuracion/ticket-options";
import { CashCloseTimeForm } from "@/app/(dashboard)/configuracion/cash-close-time-form";
import { BranchesManager } from "@/app/(dashboard)/configuracion/branches-manager";
import { OrgNameForm } from "@/app/(dashboard)/configuracion/org-name-form";

const card = "rounded-card border border-border bg-card p-5";

export default function Page() {
  if (process.env.NEXT_PUBLIC_DOCS_SHOTS !== "1") notFound();
  return (
    <ToastProvider>
      <div className="mx-auto max-w-2xl space-y-6 bg-background p-4">
        <div id="s-nombre" className={card}><OrgNameForm initialName="Kiosco Don José" /></div>
        <div id="s-cierre" className={card}><CashCloseTimeForm initialTime="21:00" /></div>
        <div id="s-sucursales" className={card}>
          <BranchesManager branches={[{ id: "b1", name: "Casa central", is_main: true }, { id: "b2", name: "Local Centro", is_main: false }] as never} canAddBranches />
        </div>
        <div id="s-medios" className={card}><PaymentMethodsManager methods={[{ id: "m1", name: "Mercado Pago" }, { id: "m2", name: "Ualá" }] as never} /></div>
        <div id="s-ticket" className={card}><TicketOptions initialShowOrgName initialShowNumber /></div>
      </div>
    </ToastProvider>
  );
}
