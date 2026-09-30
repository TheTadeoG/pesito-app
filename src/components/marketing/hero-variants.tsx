import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnchorLink } from "@/components/marketing/anchor-link";
import { Wordmark } from "@/components/marketing/wordmark";
import { cn } from "@/lib/utils";

// Portadas de prueba para elegir. Sólo se ven en /portadas (sin indexar);
// la portada real sigue siendo hero.tsx hasta que se decida una.

type Tone = "green" | "panel";

const tones: Record<Tone, { section: string; muted: string; accent: string }> = {
  green: {
    section: "bg-hero text-hero-foreground",
    muted: "text-hero-muted",
    accent: "text-hero-accent",
  },
  panel: {
    section: "bg-background text-foreground",
    muted: "text-muted-foreground",
    accent: "text-primary",
  },
};

function Frame({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <section className={cn("relative overflow-hidden", tones[tone].section)}>
      {tone === "green" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,var(--hero-glow),transparent_70%)]"
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(var(--color-border)_1px,transparent_1.2px)] [background-size:18px_18px] [mask-image:linear-gradient(#000_40%,transparent)]"
        />
      )}
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20">{children}</div>
    </section>
  );
}

function Ctas({ center = false }: { center?: boolean }) {
  return (
    <div className={cn("mt-8 flex flex-col gap-3 sm:flex-row sm:items-center", center && "sm:justify-center")}>
      <Link href="/registro">
        <Button size="lg" variant="primary" className="w-full font-bold sm:w-auto">
          Empezar gratis
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      <AnchorLink href="#como-funciona">
        <Button size="lg" variant="heroGhost" className="w-full sm:w-auto">
          Ver cómo funciona
        </Button>
      </AnchorLink>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
      {children}
    </h2>
  );
}

function Accent({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={tones[tone].accent}>{children}</span>;
}

function Sub({ tone, children, center = false }: { tone: Tone; children: ReactNode; center?: boolean }) {
  return (
    <p className={cn("mt-6 max-w-md text-lg leading-relaxed", tones[tone].muted, center && "mx-auto")}>
      {children}
    </p>
  );
}

function Eyebrow({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p className={cn("mb-4 inline-flex items-center gap-2 text-sm font-semibold", tones[tone].accent)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </p>
  );
}

/* ---------- ventana del panel ---------- */

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function Rows({ items }: { items: [string, string][] }) {
  return (
    <ul>
      {items.map(([a, b]) => (
        <li key={a} className="flex justify-between border-b border-border py-1 last:border-0">
          <span>{a}</span>
          <span className="font-semibold tabular-nums">{b}</span>
        </li>
      ))}
    </ul>
  );
}

function AppWindow({ variant }: { variant: "resumen" | "venta" }) {
  const nav = ["Vender", "Productos", "Caja", "Clientes", "Proveedores", "Reportes"];
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-background text-left text-xs text-foreground shadow-2xl shadow-black/20 sm:grid-cols-[8.25rem_1fr]">
      <div className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3 sm:flex">
        <Wordmark className="mx-1.5 text-lg" />
        <p className="mx-1.5 mb-2 border-b border-border pb-2 text-[11px] text-muted-foreground">
          Kiosco Don Pepe
        </p>
        {nav.map((n, i) => (
          <span
            key={n}
            className={cn(
              "rounded-md px-2 py-1.5 font-medium",
              (variant === "venta" ? i === 0 : i === 5)
                ? "bg-sidebar-active-bg font-bold text-sidebar-active-foreground"
                : "text-sidebar-foreground"
            )}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 p-3.5">
        {variant === "resumen" ? (
          <>
            <p className="text-sm font-bold">Resumen de hoy</p>
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Ventas" value="$284.500" />
              <Kpi label="Ganancia" value="$113.300" />
              <Kpi label="Te deben" value="$19.450" />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr]">
              <div className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Ventas de la semana</p>
                <div className="mt-2 flex h-16 items-end gap-1.5">
                  {[36, 48, 44, 62, 78, 100, 58].map((h, i) => (
                    <i
                      key={i}
                      style={{ height: `${h}%` }}
                      className={cn("flex-1 rounded-t-sm", i === 5 ? "bg-primary" : "bg-accent")}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Alertas de stock</p>
                <Rows items={[["Coca-Cola 2.25L", "Sin stock"], ["Pan lactal", "Bajo"], ["Detergente", "Bajo"]]} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Ventas de hoy" value="$284.500" />
              <Kpi label="Caja" value="Cuadra" />
              <Kpi label="Stock bajo" value="3" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Venta actual</p>
                <Rows
                  items={[
                    ["Gaseosa cola 1.5L", "$2.200"],
                    ["Alfajor triple x2", "$1.800"],
                    ["Chicles menta", "$500"],
                    ["Total", "$4.500"],
                  ]}
                />
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Quién te debe</p>
                <Rows items={[["Carlos R.", "$9.800"], ["Diego M.", "$6.300"], ["Ana P.", "$2.100"]]} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 6: fondo de panel, sistema a la vista ---------- */

export function Hero6() {
  const t: Tone = "panel";
  return (
    <Frame tone={t}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <Eyebrow tone={t}>Sistema de ventas, stock y caja</Eyebrow>
          <Title>
            Tu negocio entero, en <Accent tone={t}>una sola pantalla</Accent>
          </Title>
          <Sub tone={t}>
            Cobrá, controlá el stock, cerrá la caja y anotá el fiado. Todo se actualiza solo con cada venta.
          </Sub>
          <Ctas />
        </div>
        <div>
          <AppWindow variant="resumen" />
          <p className="mt-3 text-center text-xs text-muted-foreground">Datos de ejemplo, no de un negocio real.</p>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- 7: centrada, el panel asoma abajo ---------- */

export function Hero7() {
  const t: Tone = "panel";
  return (
    <Frame tone={t}>
      <div className="flex flex-col items-center text-center">
        <Eyebrow tone={t}>Punto de venta para tu negocio</Eyebrow>
        <div className="max-w-3xl">
          <Title>
            Cobrás, y todo lo demás <Accent tone={t}>se hace solo</Accent>
          </Title>
        </div>
        <Sub tone={t} center>
          Stock, caja y fiado se actualizan con cada venta. Empezás gratis, sin tarjeta.
        </Sub>
        <Ctas center />
        <div className="mt-10 max-h-[21rem] w-full max-w-3xl overflow-hidden [mask-image:linear-gradient(#000_70%,transparent)]">
          <AppWindow variant="venta" />
        </div>
      </div>
    </Frame>
  );
}

/* ---------- 8: del cuaderno a Pesito ---------- */

function Note({ children, tilt }: { children: ReactNode; tilt: string }) {
  return (
    <div
      className={cn(
        "rounded bg-[#f4ecc8] px-3 py-2 font-[cursive] text-sm leading-snug text-[#4a3f14] shadow-md shadow-black/20",
        tilt
      )}
    >
      {children}
    </div>
  );
}

function Result({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] text-card-foreground shadow-lg shadow-black/10">
      <span>{left}</span>
      <span className="shrink-0">{right}</span>
    </div>
  );
}

function Tag({ tone, children }: { tone: "ok" | "bad" | "warn"; children: ReactNode }) {
  const c = {
    ok: "bg-success-bg text-success",
    bad: "bg-danger-bg text-danger",
    warn: "bg-warning-bg text-warning",
  }[tone];
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", c)}>{children}</span>;
}

export function Hero8() {
  const t: Tone = "green";
  const rows: { note: ReactNode; result: ReactNode }[] = [
    {
      note: (
        <>
          Carlos debe 9800, <s className="opacity-60">Diego 6300</s> 5300?
        </>
      ),
      result: <Result left="Carlos R. · hace 12 días" right={<><b className="tabular-nums">$9.800</b> <Tag tone="bad">Atrasado</Tag></>} />,
    },
    { note: "¿Cuánto vendí hoy??", result: <Result left="Ventas de hoy" right={<b className="tabular-nums">$284.500</b>} /> },
    { note: "Pedir aceite, arroz, leche…", result: <Result left="Pedido armado" right={<Tag tone="ok">Listo para enviar</Tag>} /> },
    { note: "Caja: falta plata??", result: <Result left="Caja de Lucas" right={<Tag tone="warn">Faltan $500</Tag>} /> },
  ];
  return (
    <Frame tone={t}>
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <Title>
            Lo que hoy anotás en el cuaderno, <Accent tone={t}>lo hace Pesito</Accent>
          </Title>
          <Sub tone={t}>
            Quién te debe, cuánto vendiste, qué pedir, si la caja cuadra. Todo ordenado, sin sumar a mano.
          </Sub>
          <Ctas />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-[1fr_1.25fr] gap-x-10 text-[11px] font-bold uppercase tracking-widest text-hero-muted">
            <span>Hoy</span>
            <span>Con Pesito</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1.75rem_1.25fr]">
              <Note tilt={i % 2 ? "rotate-1" : "-rotate-1"}>{r.note}</Note>
              <span aria-hidden className="hidden text-center text-lg font-extrabold text-hero-accent sm:block">→</span>
              {r.result}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ---------- 9: mostrador y celular ---------- */

export function Hero9() {
  const t: Tone = "green";
  return (
    <Frame tone={t}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <Eyebrow tone={t}>Funciona en el navegador, sin instalar nada</Eyebrow>
          <Title>
            Cobrá en el mostrador. <Accent tone={t}>Controlá desde donde estés.</Accent>
          </Title>
          <Sub tone={t}>
            Vendés desde la compu o la tablet y mirás las ventas del día en tu celular. Stock y caja siempre al día.
          </Sub>
          <Ctas />
        </div>
        <div className="relative pb-6">
          <div className="w-[63%] rounded-t-2xl rounded-b-md border-[6px] border-foreground bg-card p-3 text-card-foreground shadow-2xl shadow-black/30">
            <Rows items={[["Gaseosa cola 1.5L", "$2.200"], ["Alfajor triple x2", "$1.800"], ["Chicles menta", "$500"]]} />
            <div className="mt-2 flex items-baseline justify-between text-sm text-muted-foreground">
              <span>Total</span>
              <b className="text-xl text-foreground">$4.500</b>
            </div>
            <div className="mt-2 rounded-lg bg-primary py-2 text-center text-sm font-bold text-primary-foreground">
              Cobrar venta
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-[38%] rounded-3xl border-[5px] border-foreground bg-card p-3 text-card-foreground shadow-2xl shadow-black/40">
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success">
              <i className="h-1.5 w-1.5 rounded-full bg-success" />
              En vivo
            </span>
            <p className="text-[10.5px] text-muted-foreground">Ventas de hoy</p>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">$284.500</p>
            <div className="mt-1 text-[11px]">
              <Rows items={[["Efectivo", "$164k"], ["Tarjeta", "$77k"], ["Transf.", "$43k"]]} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-hero-muted">Datos de ejemplo, no de un negocio real.</p>
    </Frame>
  );
}

/* ---------- 10: un día en el negocio ---------- */

export function Hero10() {
  const t: Tone = "green";
  const events = [
    { h: "08:00", t: "Abrís la caja", d: "Contás el efectivo inicial y arrancás a vender.", ok: "Caja abierta" },
    { h: "12:30", t: "Cobrás y fiás", d: "Escaneás, cobrás y anotás quién se lleva a cuenta.", ok: "Stock al día" },
    { h: "18:40", t: "Armás el pedido", d: "Ves qué se acaba y se lo mandás al proveedor.", ok: "Pedido listo" },
    { h: "21:00", t: "Cerrás la caja", d: "Contás los billetes y ves si falta o sobra plata.", ok: "Cuadra" },
  ];
  return (
    <Frame tone={t}>
      <div className="flex flex-col items-center text-center">
        <div className="max-w-3xl">
          <Title>
            De abrir la caja a cerrarla, <Accent tone={t}>Pesito te acompaña</Accent>
          </Title>
        </div>
        <Sub tone={t} center>
          Un solo sistema para todo el día del negocio. Empezás gratis, sin tarjeta.
        </Sub>
        <Ctas center />
        <div className="relative mt-14 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] top-[1px] hidden border-t-2 border-dashed border-hero-accent/50 lg:block"
          />
          {events.map((e) => (
            <div
              key={e.h}
              className="relative rounded-2xl border border-border bg-card px-4 pb-4 pt-8 text-sm text-card-foreground shadow-lg shadow-black/10"
            >
              <span className="absolute -top-2 left-3 rounded-full bg-primary px-2.5 py-0.5 font-mono text-xs font-semibold text-primary-foreground">
                {e.h}
              </span>
              <h3 className="font-bold">{e.t}</h3>
              <p className="mt-1 leading-snug text-muted-foreground">{e.d}</p>
              <span className="mt-2.5 inline-block">
                <Tag tone="ok">{e.ok}</Tag>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
