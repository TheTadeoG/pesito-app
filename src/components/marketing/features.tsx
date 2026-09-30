import type { ReactNode } from "react";
import { StaggerIn } from "@/components/marketing/stagger-in";
import { CashBills, DebtFlow, ImportFlow, LivePhone, OrderChat, PriceHistory, StockAlerts, TicketPrinter } from "@/components/marketing/features-live";
import {
  Boxes,
  FileSpreadsheet,
  History,
  MessageCircle,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";

function Preview({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-accent/50 via-transparent to-transparent ${className}`}
    >
      <div aria-hidden className="bento-grid-bg absolute inset-0" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function Caption({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <h3 className="mt-3 text-lg font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

const cell = "rounded-card border border-border bg-card p-4 sm:p-5";

export function Features() {
  return (
    <section id="funciones" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Lo que hoy te lleva horas, <span className="text-primary">Pesito lo hace en un paso</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Pesito junta en una sola app lo que hoy manejás con cuaderno,
          calculadora y memoria.
        </p>
      </div>

      <StaggerIn className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Cobro */}
        <div className={`${cell} flex flex-col sm:col-span-2 lg:col-span-2`}>
          <Preview className="min-h-[19.5rem] flex-1">
            <TicketPrinter />
          </Preview>
          <Caption icon={ShoppingCart} title="Cobrá en segundos">
            Escaneá el código de barras o buscá por nombre. El total y el vuelto se arman solos.
          </Caption>
        </div>

        {/* Caja */}
        <div className={`${cell} flex flex-col sm:col-span-2 lg:col-span-4`}>
          <Preview className="min-h-52 flex-1">
            <CashBills />
          </Preview>
          <Caption icon={Wallet} title="Caja sin sorpresas">
            Contás los billetes y ves al instante si falta o sobra plata.
          </Caption>
        </div>

        {/* Alertas de stock: el stock baja con cada venta */}
        <div className={`${cell} lg:col-span-3`}>
          <Preview className="h-64">
            <StockAlerts />
          </Preview>
          <Caption icon={Boxes} title="Alertas de stock">
            Te avisa qué se está acabando, antes de quedarte sin nada.
          </Caption>
        </div>

        {/* Fiado: la lista de clientes */}
        <div className={`${cell} lg:col-span-3`}>
          <Preview className="h-64">
            <DebtFlow />
          </Preview>
          <Caption icon={Users} title="Fiado bajo control">
            Quién te debe, cuánto y desde cuándo. Cobrar es más fácil cuando lo tenés todo a la vista.
          </Caption>
        </div>

        {/* Pedido a proveedores: chat con el proveedor */}
        <div className={`${cell} sm:col-span-2 lg:col-span-4`}>
          <Preview className="h-72">
            <OrderChat />
          </Preview>
          <Caption icon={MessageCircle} title="Qué pedirle a cada proveedor">
            Pesito arma el pedido por vos. Vos solo lo mandás.
          </Caption>
        </div>

        {/* Historial de precios */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-72">
            <PriceHistory />
          </Preview>
          <Caption icon={History} title="Cada cambio de precio, guardado">
            Mirá cuándo subió cada producto y volvé a un precio anterior con un toque.
          </Caption>
        </div>

        {/* Excel y etiquetas: las filas viajan y se vuelven etiquetas */}
        <div className={`${cell} sm:col-span-2 lg:col-span-3`}>
          <Preview className="h-72">
            <ImportFlow />
          </Preview>
          <Caption icon={FileSpreadsheet} title="Cargá todo en minutos">
            Subí tu catálogo desde un Excel y generá códigos de barras propios con etiquetas para imprimir.
          </Caption>
        </div>

        {/* En vivo: como se ve desde un celular */}
        <div className={`${cell} sm:col-span-2 lg:col-span-3`}>
          <Preview className="h-72">
            <LivePhone />
          </Preview>
          <Caption icon={Smartphone} title="Tu negocio desde casa">
            Mirá las ventas del día en tu celular, sin estar en el mostrador.
          </Caption>
        </div>
      </StaggerIn>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Datos de ejemplo, no de un negocio real.
      </p>
    </section>
  );
}
