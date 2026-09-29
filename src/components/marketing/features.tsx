import type { ReactNode } from "react";
import { StaggerIn } from "@/components/marketing/stagger-in";
import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  MessageCircle,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";

// Datos de las vistas previas: son de ejemplo, no de un negocio real.
const stock = [
  { name: "Gaseosa cola 500 ml", now: 44, max: 50 },
  { name: "Pan lactal", now: 8, max: 30 },
  { name: "Cerveza 1 L", now: 1, max: 24 },
  { name: "Yerba 1 kg", now: 18, max: 24 },
];

const debtors = [
  { name: "Carlos R.", ago: "hace 12 días", amount: "$ 9.800", late: true, initials: "CR" },
  { name: "Marta G.", ago: "hace 1 día", amount: "$ 1.250", late: false, initials: "MG" },
  { name: "Diego M.", ago: "hace 7 días", amount: "$ 6.300", late: false, initials: "DM" },
  { name: "Ana P.", ago: "hace 6 días", amount: "$ 2.100", late: false, initials: "AP" },
];

const bars = [34, 46, 30, 58, 40, 66, 44, 74, 52, 60, 70, 82];

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
        {/* Cobro */}
        <div className={`${cell} sm:col-span-2 lg:col-span-4`}>
          <Preview className="h-60">
            <div className="flex h-full items-center justify-center gap-4 px-4 sm:justify-start sm:px-8">
              <div className="w-44 shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="relative h-16 overflow-hidden rounded-md bg-muted">
                  <div className="barcode-bars absolute inset-0" />
                  <div className="scan-line absolute inset-x-0 top-2 h-0.5 bg-primary shadow-[0_0_10px_var(--color-primary)]" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">Gaseosa cola 500 ml</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  779800012 · $ 1.200
                </p>
              </div>
              <div className="hidden w-52 -rotate-2 rounded-xl border border-border bg-card p-3 shadow-lg shadow-black/5 sm:block">
                <Label>Venta en curso</Label>
                <div className="mt-2 space-y-1.5 text-xs text-foreground">
                  {[
                    ["Gaseosa cola 500 ml", "$ 1.200"],
                    ["Fideos 500 g", "$ 980"],
                    ["Pan lactal", "$ 1.450"],
                    ["Detergente x2", "$ 3.200"],
                  ].map(([n, p]) => (
                    <div key={n} className="flex justify-between gap-3 border-b border-dashed border-border pb-1.5">
                      <span className="truncate">{n}</span>
                      <span className="font-mono tabular-nums">{p}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-0.5 font-bold">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">$ 6.830</span>
                  </div>
                </div>
              </div>
            </div>
          </Preview>
          <Caption icon={ShoppingCart} title="Cobrá en segundos">
            Escaneá el código de barras o buscá por nombre. El total y el vuelto se arman solos.
          </Caption>
        </div>

        {/* Ventas del día */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-60">
            <div className="flex h-full flex-col justify-between p-4">
              <div>
                <Label>Ventas del día</Label>
                <p className="mt-1 flex items-baseline gap-1 text-4xl font-extrabold tracking-tight text-foreground">
                  <span className="text-primary">$</span>
                  <span className="tabular-nums">287.450</span>
                </p>
                <span className="mt-2 inline-block rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success">
                  +18% que ayer
                </span>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 rounded-t bg-gradient-to-t from-primary/10 to-primary/60"
                  />
                ))}
              </div>
            </div>
          </Preview>
          <Caption icon={BarChart3} title="Mirá cuánto vendiste hoy">
            Ventas del día, productos más vendidos y el estado de tu negocio de un vistazo, sin planillas.
          </Caption>
        </div>

        {/* Stock */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="space-y-3 p-4">
              {stock.map((item) => {
                const pct = Math.round((item.now / item.max) * 100);
                const tone =
                  pct < 15 ? "bg-danger text-danger" : pct < 45 ? "bg-warning text-warning" : "bg-success text-success";
                const [bg, text] = tone.split(" ");
                return (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs text-foreground">
                      <span>{item.name}</span>
                      <span className={`font-mono tabular-nums ${text}`}>
                        {item.now}/{item.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Preview>
          <Caption icon={Boxes} title="Stock siempre al día">
            Baja con cada venta y te avisa qué se está acabando, antes de quedarte sin nada.
          </Caption>
        </div>

        {/* Fiado */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="space-y-2.5 p-4">
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

        {/* Caja */}
        <div className={`${cell} lg:col-span-2`}>
          <Preview className="h-52">
            <div className="flex h-full items-center justify-center p-4">
              <div className="w-full max-w-[13rem] rounded-xl border border-border bg-card p-3 shadow-sm">
                <Label>Cierre de caja</Label>
                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Esperado</span>
                    <span className="font-mono tabular-nums text-foreground">$ 96.500</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Contado</span>
                    <span className="font-mono tabular-nums text-foreground">$ 96.500</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span className="text-foreground">Diferencia</span>
                    <span className="font-mono tabular-nums text-success">$ 0</span>
                  </div>
                </div>
                <span className="mt-3 inline-block rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success">
                  Sin diferencias
                </span>
              </div>
            </div>
          </Preview>
          <Caption icon={Wallet} title="Caja sin diferencias">
            Abrí y cerrá la caja y mirá el efectivo esperado, así las diferencias se notan enseguida.
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
                  <div className="flex justify-between"><span>Gaseosa cola 500 ml</span><span className="font-mono">x 12</span></div>
                  <div className="flex justify-between"><span>Yerba 1 kg</span><span className="font-mono">x 6</span></div>
                  <div className="flex justify-between"><span>Pan lactal</span><span className="font-mono">x 10</span></div>
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
                <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums text-foreground">$ 184.300</p>
                <p className="text-[10px] text-muted-foreground">41 ventas hoy</p>
                <div className="mt-2 flex h-8 items-end gap-1">
                  {[40, 60, 45, 75, 55, 90].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} className="flex-1 rounded-t bg-primary/50" />
                  ))}
                </div>
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
