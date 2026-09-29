import type { ReactNode } from "react";
import { StaggerIn } from "@/components/marketing/stagger-in";
import { CashCount, TicketScanner } from "@/components/marketing/features-live";
import {
  Boxes,
  FileSpreadsheet,
  History,
  MessageCircle,
  ShoppingCart,
  Smartphone,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

// Los datos de las vistas previas son de ejemplo, no de un negocio real.
const debtors = [
  { name: "Carlos R.", ago: "hace 12 días", amount: "$ 9.800", late: true, initials: "CR" },
  { name: "Marta G.", ago: "hace 1 día", amount: "$ 1.250", late: false, initials: "MG" },
  { name: "Diego M.", ago: "hace 7 días", amount: "$ 6.300", late: false, initials: "DM" },
  { name: "Ana P.", ago: "hace 6 días", amount: "$ 2.100", late: false, initials: "AP" },
];

const cashiers = [
  { name: "Marta G.", note: "Sin diferencias", tone: "success", initials: "MG" },
  { name: "Lucas P.", note: "Faltan $ 500", tone: "danger", initials: "LP" },
  { name: "Rocío A.", note: "Sobran $ 100", tone: "warning", initials: "RA" },
] as const;

const providers = [
  { name: "Distribuidora Norte", tag: "Urgente", tone: "danger" },
  { name: "Lácteos del Sur", tag: "Esta semana", tone: "warning" },
  { name: "Almacén Mayorista", tag: "Esta semana", tone: "warning" },
] as const;

const toneClasses = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
} as const;

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

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
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

function LabelSheet({ name, price, className = "" }: { name: string; price: string; className?: string }) {
  return (
    <div className={`w-[4.6rem] rounded-lg border border-border bg-card p-2 shadow-sm ${className}`}>
      <p className="truncate text-[10px] font-semibold text-foreground">{name}</p>
      <div className="barcode-bars mt-1.5 h-7 rounded-sm" />
      <p className="mt-1 text-center font-mono text-[10px] font-semibold text-foreground">{price}</p>
    </div>
  );
}

export function Features() {
  return (
    <section id="funciones" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Todo lo que necesita tu negocio, <span className="text-primary">en un solo lugar</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Pesito junta en una sola app lo que hoy manejás con cuaderno,
          calculadora y memoria.
        </p>
      </div>

      <StaggerIn className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Cobro: la celda alta de la izquierda */}
        <div className={`${cell} flex flex-col sm:col-span-2 lg:col-span-2 lg:row-span-2`}>
          <Preview className="min-h-[26rem] flex-1">
            <TicketScanner />
          </Preview>
          <Caption icon={ShoppingCart} title="Cobrá en segundos">
            Escaneá el código de barras o buscá por nombre. El total y el vuelto se arman solos.
          </Caption>
        </div>

        {/* Caja */}
        <div className={`${cell} sm:col-span-2 lg:col-span-4`}>
          <Preview className="h-44">
            <CashCount expected={118400} />
          </Preview>
          <Caption icon={Wallet} title="Caja sin diferencias">
            Abrí y cerrá la caja y mirá el efectivo esperado contra lo que contaste.
          </Caption>
        </div>

        {/* Stock: aviso con acción */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-56">
            <div className="flex h-full flex-col justify-center gap-2.5 p-3.5">
              <div className="rounded-xl border border-warning/40 bg-card p-3 shadow-sm">
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-bold text-warning">
                  Se acaba antes de que llegue un pedido
                </span>
                <p className="mt-2 text-sm font-bold text-foreground">Leche entera 1 L</p>
                <p className="text-[11px] text-muted-foreground">Vendés unas 9 por día. Quedan 2.</p>
                <span className="mt-2.5 inline-block rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  Armar pedido
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[11px]">
                <span className="text-foreground">Fideos 500 g</span>
                <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-bold text-danger">Ya se acabó</span>
              </div>
            </div>
          </Preview>
          <Caption icon={Boxes} title="Stock siempre al día">
            Baja con cada venta y te avisa qué se está acabando, antes de quedarte sin nada.
          </Caption>
        </div>

        {/* Fiado: la lista de clientes */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-56">
            <div className="space-y-2 p-4 [mask-image:linear-gradient(to_bottom,#000_72%,transparent)]">
              {debtors.map((d, i) => (
                <div
                  key={d.name}
                  className={`flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-sm ${
                    i % 2 ? "ml-5" : "mr-5"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {d.initials}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-xs font-semibold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.ago}</p>
                  </div>
                  <span className={`font-mono text-xs font-semibold tabular-nums ${d.late ? "text-danger" : "text-foreground"}`}>
                    {d.amount}
                  </span>
                </div>
              ))}
            </div>
          </Preview>
          <Caption icon={Users} title="Fiado bajo control">
            Quién te debe, cuánto y desde cuándo. Cobrar es más fácil cuando lo tenés todo a la vista.
          </Caption>
        </div>

        {/* Caja de cada empleado */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-60">
            <div className="flex h-full flex-col justify-center gap-2.5 p-4">
              {cashiers.map((c) => (
                <div key={c.name} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {c.initials}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{c.name}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClasses[c.tone]}`}>
                    {c.note}
                  </span>
                </div>
              ))}
            </div>
          </Preview>
          <Caption icon={UserCheck} title="La caja de cada empleado">
            Mirá quién cerró justo y quién tuvo diferencia.
          </Caption>
        </div>

        {/* Pedido a proveedores */}
        <div className={`${cell} sm:col-span-2 lg:col-span-4`}>
          <Preview className="h-60">
            <div className="grid h-full items-center gap-3 p-4 sm:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.name} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClasses[p.tone]}`}>{p.tag}</span>
                  </div>
                ))}
              </div>
              <div className="hidden flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex">
                <div>
                  <p className="text-xs text-muted-foreground">Si no pedís, podrías perder</p>
                  <p className="font-mono text-3xl font-extrabold tracking-tight text-danger">$ 86.000</p>
                </div>
                <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Mandar pedido
                </span>
              </div>
            </div>
          </Preview>
          <Caption icon={MessageCircle} title="Qué pedirle a cada proveedor">
            Sabés a quién pedirle hoy y cuánto perdés si no pedís.
          </Caption>
        </div>

        {/* Historial de precios */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-72">
            <div className="flex h-full flex-col p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold tracking-tight text-foreground">Yerba 1 kg</p>
                <Label>Precio de venta</Label>
              </div>
              <svg viewBox="0 0 300 90" className="mt-1 h-24 w-full" aria-hidden>
                <path d="M6 70 H80 V52 H160 V34 H240 V14 H294" fill="none" stroke="var(--color-border)" strokeWidth="2" />
                <path d="M6 70 H80 V52 H160 V34 H240 V14 H294" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="0" />
                {[[6, 70], [80, 52], [160, 34], [240, 14]].map(([x, y]) => (
                  <circle key={x} cx={x} cy={y} r="4" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="2" />
                ))}
                <circle cx="240" cy="14" r="6" fill="var(--color-primary)" fillOpacity="0.2" />
              </svg>
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-card px-3 py-2 shadow-sm">
                  <div className="leading-tight">
                    <p className="font-mono text-sm font-bold tabular-nums text-foreground">$ 3.842</p>
                    <p className="text-[10px] text-muted-foreground">Aumento masivo +13% · Distribuidora Norte</p>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Hoy</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                  <div className="leading-tight">
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">$ 3.400</p>
                    <p className="text-[10px] text-muted-foreground">hace 30 días</p>
                  </div>
                  <span className="rounded-md border border-primary px-2 py-1 text-[10px] font-semibold text-primary">
                    Volver a este precio
                  </span>
                </div>
              </div>
            </div>
          </Preview>
          <Caption icon={History} title="Cada cambio de precio, guardado">
            Mirá cuándo subió cada producto y volvé a un precio anterior con un toque.
          </Caption>
        </div>

        {/* Excel y etiquetas */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-72">
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
              <div className="w-36 shrink-0 rounded-lg border border-border bg-card p-2 shadow-sm">
                <p className="font-mono text-[10px] font-semibold text-primary">productos.xlsx</p>
                <div className="mt-2 space-y-1">
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="grid grid-cols-3 gap-1">
                      <span className="h-1.5 rounded-sm bg-muted" />
                      <span className="h-1.5 rounded-sm bg-muted" />
                      <span className="h-1.5 rounded-sm bg-primary/30" />
                    </div>
                  ))}
                </div>
              </div>
              <span aria-hidden className="text-muted-foreground">↓</span>
              <div className="flex gap-2">
                <LabelSheet name="Azúcar 1 kg" price="$ 1.900" className="-rotate-3" />
                <LabelSheet name="Fideos 500 g" price="$ 1.250" />
                <LabelSheet name="Yerba 1 kg" price="$ 3.800" className="rotate-3" />
              </div>
            </div>
          </Preview>
          <Caption icon={FileSpreadsheet} title="Cargá todo en minutos">
            Subí tu catálogo desde un Excel y generá códigos de barras propios con etiquetas para imprimir.
          </Caption>
        </div>

        {/* En vivo: como se ve desde un celular */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-72">
            <div className="flex h-full items-end justify-center overflow-hidden">
              <div className="w-44 translate-y-2 rounded-t-[1.6rem] border-2 border-b-0 border-foreground/80 bg-card px-3 pb-6 pt-2 shadow-xl">
                <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-foreground/70" />
                <div className="flex justify-between font-mono text-[8px] text-muted-foreground">
                  <span>18:42</span>
                  <span>●●●</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-tight text-foreground">pesito.</span>
                  <span className="flex items-center gap-1 font-mono text-[9px] font-semibold text-primary">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    EN VIVO
                  </span>
                </div>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Ventas de hoy</p>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">$ 212.750</p>
                <p className="text-[10px] text-muted-foreground">47 ventas hoy</p>
                <svg viewBox="0 0 100 30" className="mt-1 h-7 w-full" aria-hidden>
                  <path d="M0 24 L15 20 L30 22 L45 12 L60 15 L75 6 L100 3" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-2 flex justify-between border-t border-border pt-1.5 text-[10px]">
                  <span className="text-muted-foreground">Efectivo</span>
                  <span className="font-mono font-semibold text-foreground">+ $ 3.200</span>
                </div>
              </div>
            </div>
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
