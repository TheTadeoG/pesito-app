import type { ReactNode } from "react";
import { StaggerIn } from "@/components/marketing/stagger-in";
import {
  Boxes,
  FileSpreadsheet,
  MessageCircle,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";

// Datos de las vistas previas: son de ejemplo, no de un negocio real.
const scanned = [
  { name: "Aceite girasol 900 ml", price: "$ 3.850" },
  { name: "Arroz largo fino 1 kg", price: "$ 2.190" },
  { name: "Leche entera 1 L", price: "$ 1.450" },
  { name: "Galletitas dulces", price: "$ 1.450" },
];

const lowStock = [
  { name: "Leche entera 1 L", state: "Ya se acabó", left: "0 u.", tone: "danger" },
  { name: "Fideos 500 g", state: "Se acaba pronto", left: "2 u.", tone: "warning" },
  { name: "Azúcar 1 kg", state: "Queda poco", left: "6 u.", tone: "warning" },
  { name: "Harina 000 1 kg", state: "Bien", left: "28 u.", tone: "success" },
] as const;

const movements = [
  { what: "Compra", when: "hace 6 días", amount: "+ $ 4.200", paid: false },
  { what: "Pagó", when: "hace 3 días", amount: "- $ 3.000", paid: true },
  { what: "Compra", when: "ayer", amount: "+ $ 1.850", paid: false },
];

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
  plan,
  children,
}: {
  icon: typeof Users;
  title: string;
  plan?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <h3 className="mt-3 text-lg font-bold tracking-tight text-foreground">{title}</h3>
      {plan && (
        <span className="mt-1.5 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
          {plan}
        </span>
      )}
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
          <Preview className="min-h-64 flex-1">
            <div className="flex h-full flex-col p-4">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-semibold text-accent-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                ESCANEANDO
              </span>
              <ul className="mt-3 space-y-2">
                {scanned.map((item, i) => (
                  <li
                    key={item.name}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                      i === scanned.length - 1 ? "border-primary/50 bg-accent/60" : "border-border bg-card"
                    }`}
                  >
                    <span aria-hidden className="font-bold text-primary">✓</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{item.price}</span>
                  </li>
                ))}
              </ul>
              <div className="my-auto flex flex-wrap gap-1.5 py-3">
                {["Efectivo", "Tarjeta", "Transferencia", "Fiado"].map((m, i) => (
                  <span
                    key={m}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      i === 0 ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
              <div className="rounded-xl bg-deep p-3.5 text-deep-foreground">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-deep-muted">Total</span>
                  <span className="text-2xl font-extrabold tracking-tight tabular-nums">$ 8.940</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs">
                  <span className="text-deep-muted">Pagó $ 10.000</span>
                  <span className="font-semibold text-lime">Vuelto $ 1.060</span>
                </div>
              </div>
            </div>
          </Preview>
          <Caption icon={ShoppingCart} title="Cobrá en segundos">
            Escaneá el código de barras o buscá por nombre. El total y el vuelto se arman solos.
          </Caption>
        </div>

        {/* Caja: ancha */}
        <div className={`${cell} sm:col-span-2 lg:col-span-4`}>
          <Preview className="h-44">
            <div className="grid h-full grid-cols-3 items-center gap-2 px-3 sm:gap-4 sm:px-6">
              {[
                ["Esperado", "$ 118.400", "text-foreground"],
                ["Contado", "$ 118.400", "text-foreground"],
                ["Diferencia", "$ 0", "text-success"],
              ].map(([label, value, color]) => (
                <div key={label} className="text-center">
                  <Label>{label}</Label>
                  <p className={`mt-1.5 text-xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Preview>
          <Caption icon={Wallet} title="Caja sin diferencias">
            Abrí y cerrá la caja y mirá el efectivo esperado, así las diferencias se notan enseguida.
          </Caption>
        </div>

        {/* Stock */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-60">
            <ul className="space-y-2 p-3.5">
              {lowStock.map((item) => (
                <li key={item.name} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{item.left}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses[item.tone]}`}>
                    {item.state}
                  </span>
                </li>
              ))}
            </ul>
          </Preview>
          <Caption icon={Boxes} title="Stock siempre al día">
            Baja con cada venta y te avisa qué se está acabando, antes de quedarte sin nada.
          </Caption>
        </div>

        {/* Fiado: la cuenta de un cliente */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-60">
            <div className="p-3.5">
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">ES</span>
                  <p className="text-xs font-semibold text-foreground">Cuenta de Elena S.</p>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-[11px]">
                  {movements.map((m) => (
                    <li key={m.when} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {m.what} · {m.when}
                      </span>
                      <span className={`font-mono tabular-nums ${m.paid ? "text-success" : "text-foreground"}`}>{m.amount}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs font-bold text-foreground">Debe $ 3.050</span>
                  <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                    Registrar pago
                  </span>
                </div>
              </div>
            </div>
          </Preview>
          <Caption icon={Users} title="Fiado bajo control">
            Quién te debe, cuánto y desde cuándo. Cobrar es más fácil cuando lo tenés todo a la vista.
          </Caption>
        </div>

        {/* Excel y etiquetas */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="flex h-full items-center justify-center gap-3 p-4">
              <div className="w-28 shrink-0 rounded-lg border border-border bg-card p-2 shadow-sm">
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
              <span aria-hidden className="text-muted-foreground">→</span>
              <div className="w-24 shrink-0 rotate-2 rounded-lg border border-border bg-card p-2 shadow-sm">
                <p className="truncate text-[10px] font-semibold text-foreground">Yerba 1 kg</p>
                <div className="barcode-bars mt-1.5 h-8 rounded-sm" />
                <p className="mt-1 text-center font-mono text-[10px] font-semibold text-foreground">$ 3.800</p>
              </div>
            </div>
          </Preview>
          <Caption icon={FileSpreadsheet} title="Cargá todo en minutos" plan="Plan Esencial">
            Subí tu catálogo desde un Excel y generá códigos de barras propios con etiquetas para imprimir.
          </Caption>
        </div>

        {/* Pedido a proveedores */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="flex h-full items-center justify-center p-4">
              <div className="w-full max-w-[14rem] rounded-xl border border-border bg-card p-3 shadow-sm">
                <Label>Pedido a Distribuidora Norte</Label>
                <div className="mt-2 space-y-1.5 text-xs text-foreground">
                  <div className="flex justify-between"><span>Aceite girasol 900 ml</span><span className="font-mono">x 12</span></div>
                  <div className="flex justify-between"><span>Arroz largo fino 1 kg</span><span className="font-mono">x 24</span></div>
                  <div className="flex justify-between"><span>Leche entera 1 L</span><span className="font-mono">x 36</span></div>
                </div>
                <span className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Mandar por WhatsApp
                </span>
              </div>
            </div>
          </Preview>
          <Caption icon={MessageCircle} title="Qué pedirle a cada proveedor" plan="Plan IA">
            Calcula qué te falta y cuánto pedir, agrupado por proveedor, con el pedido listo para mandar.
          </Caption>
        </div>

        {/* En vivo */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="flex h-full items-center justify-center p-4">
              <div className="w-36 rounded-[1.4rem] border-2 border-border bg-card p-3 shadow-md">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  EN VIVO
                </span>
                <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums text-foreground">$ 212.750</p>
                <p className="text-[10px] text-muted-foreground">47 ventas hoy</p>
                <svg viewBox="0 0 100 30" className="mt-2 h-8 w-full" aria-hidden>
                  <path d="M0 24 L15 20 L30 22 L45 12 L60 15 L75 6 L100 3" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </Preview>
          <Caption icon={Smartphone} title="Tu negocio desde casa" plan="Plan Pro">
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
