"use client";

import { useEffect, useRef, useState } from "react";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

// Las demos sólo corren mientras se ven en pantalla y sin movimiento reducido.
// Sin eso (o sin JS) queda el estado final completo, que es lo que ven los buscadores.
function useActive(ref: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return active;
}

// Corre `run` en bucle mientras `active`; `wait` se cancela al desmontar o pausar.
function useLoop(active: boolean, run: (wait: (ms: number) => Promise<void>, alive: () => boolean) => Promise<void>, reset: () => void) {
  const runRef = useRef(run);
  const resetRef = useRef(reset);
  useEffect(() => {
    runRef.current = run;
    resetRef.current = reset;
  });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));
    (async () => {
      while (!cancelled) await runRef.current(wait, () => !cancelled);
    })();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      resetRef.current();
    };
  }, [active]);
}

const ITEM = { name: "Yerba 1 kg", price: 3800 };
const PAID = 5000;

// Escáner de arriba abajo y, al terminar, la impresora saca el ticket de corrido.
export function TicketPrinter() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [scanKey, setScanKey] = useState(0);
  const [printed, setPrinted] = useState(true);
  const [printing, setPrinting] = useState(false);

  useLoop(
    active,
    async (wait) => {
      setPrinted(false);
      setPrinting(false);
      await wait(800);
      setScanKey((k) => k + 1);
      await wait(1500);
      setPrinting(true);
      setPrinted(true);
      await wait(2700);
      setPrinting(false);
      await wait(3400);
    },
    () => {
      setPrinted(true);
      setPrinting(false);
    }
  );

  return (
    <div ref={root} className="flex h-full flex-col">
      <div className="mx-3.5 mt-3 rounded-xl border border-border bg-card p-2 shadow-sm">
        <p className="mb-1.5 flex justify-between text-[11.5px]">
          <span className="font-semibold text-foreground">{ITEM.name}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{ars(ITEM.price)}</span>
        </p>
        <div className="relative h-[4.6rem] overflow-hidden rounded-lg bg-muted">
          <div className="barcode-bars absolute inset-0" />
          <div
            key={scanKey}
            className={`absolute inset-x-0 top-0 h-[3px] bg-primary opacity-0 shadow-[0_0_12px_2px_var(--color-primary)] ${
              scanKey > 0 ? "beam-down" : ""
            }`}
          />
        </div>
      </div>

      <div className="relative z-10 mx-7 mt-3 h-6 rounded-t-[10px] rounded-b bg-gradient-to-b from-[#26332d] to-[#131b17] shadow-md shadow-black/20">
        <span
          className={`absolute right-3.5 top-2 h-[7px] w-[7px] rounded-full transition-[background-color,box-shadow] duration-200 ${
            printing ? "bg-lime shadow-[0_0_8px_var(--color-lime)]" : "bg-[#444]"
          }`}
        />
        <span className="absolute inset-x-3 -bottom-[3px] h-[5px] rounded-[3px] bg-[#050807]" />
      </div>
      <div className="relative z-0 mx-9 min-h-0 flex-1 overflow-hidden">
        <div
          className="ticket-paper px-4 pb-5 pt-4 font-mono text-xs shadow-lg"
          style={{
            transform: printed ? "translateY(0)" : "translateY(-101%)",
            transition: printed ? "transform 2.6s cubic-bezier(0.45, 0.05, 0.25, 1)" : "none",
          }}
        >
          <p className="text-center text-sm font-bold tracking-[0.22em]">PESITO</p>
          <p className="text-center text-[10px] text-[#6b746f]">Ticket de venta</p>
          <div className="my-3 border-t border-dashed border-[#c4cbc7]" />
          <div className="flex justify-between gap-2 py-[3px]">
            <span>{ITEM.name}</span>
            <span className="whitespace-nowrap tabular-nums">{ars(ITEM.price)}</span>
          </div>
          <div className="my-3 border-t border-dashed border-[#c4cbc7]" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{ars(ITEM.price)}</span>
          </div>
          <div className="flex justify-between text-[#6b746f]">
            <span>Pagó</span>
            <span className="tabular-nums">{ars(PAID)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#047857]">
            <span>Vuelto</span>
            <span className="tabular-nums">{ars(PAID - ITEM.price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const cases = [
  { who: "Marta", expected: 96500, bills: [50000, 20000, 20000, 5000, 1500] },
  { who: "Lucas", expected: 41200, bills: [20000, 10000, 5000, 2000, 3700] },
];

function CashColumn({ who, expected, bills, dropped, shake }: { who: string; expected: number; bills: number[]; dropped: number; shake: boolean }) {
  const total = bills.slice(0, dropped).reduce((a, b) => a + b, 0);
  const counted = bills.reduce((a, b) => a + b, 0);
  const done = dropped === bills.length;
  const diff = expected - counted;
  return (
    <div key={String(shake)} className={`min-w-0 rounded-xl border border-border bg-card/80 p-3 text-center shadow-sm ${shake ? "shake-x" : ""}`}>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Caja de {who}</p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <div>
          <p className="text-[10px] text-muted-foreground">Esperado</p>
          <p className="text-lg font-extrabold tracking-tight tabular-nums text-foreground sm:text-2xl">{ars(expected)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Contado</p>
          <p className="text-lg font-extrabold tracking-tight tabular-nums text-foreground sm:text-2xl">{ars(total)}</p>
        </div>
      </div>
      <div className="relative mx-auto mt-3 h-20 w-32">
        {bills.slice(0, dropped).map((b, i) => (
          <div
            key={i}
            className="bill-drop absolute left-1/2 grid h-8 w-20 -translate-x-1/2 place-items-center rounded-md border border-primary/40 bg-gradient-to-br from-accent to-primary/25 font-mono text-[10px] font-bold text-accent-foreground"
            style={{ top: 34 - i * 4, rotate: `${((i % 3) - 1) * 3}deg`, "--r0": `${i % 2 ? 12 : -12}deg` } as React.CSSProperties}
          >
            {i < bills.length - 1 ? ars(b) : "Monedas"}
          </div>
        ))}
        <div className="absolute inset-x-1 bottom-0 z-10 h-3 rounded-b-[8px] rounded-t border border-border bg-muted" />
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-opacity duration-300 ${
          diff === 0 ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
        } ${done ? "opacity-100" : "opacity-0"}`}
      >
        {diff === 0 ? "Sin diferencias" : `Faltan ${ars(diff)}`}
      </span>
    </div>
  );
}

// Dos cajas se cuentan a la vez, lado a lado: una cierra justa y la otra tiene diferencia.
export function CashBills() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [dropped, setDropped] = useState(cases[0].bills.length);
  const [shaking, setShaking] = useState(false);

  useLoop(
    active,
    async (wait) => {
      setShaking(false);
      setDropped(0);
      await wait(800);
      for (let i = 1; i <= cases[0].bills.length; i++) {
        setDropped(i);
        await wait(620);
      }
      setShaking(true);
      await wait(4200);
    },
    () => {
      setShaking(false);
      setDropped(cases[0].bills.length);
    }
  );

  return (
    <div ref={root} className="grid h-full grid-cols-2 items-center gap-3 p-3 sm:gap-4 sm:p-5">
      {cases.map((c, idx) => (
        <CashColumn key={c.who} {...c} dropped={dropped} shake={shaking && idx === 1} />
      ))}
    </div>
  );
}

const lines = [
  { name: "Aceite girasol 900 ml", qty: 12 },
  { name: "Arroz largo fino 1 kg", qty: 24 },
  { name: "Leche entera 1 L", qty: 36 },
];

const ticks = (
  <span className="ml-1 text-[#53bdeb]" aria-hidden>
    ✓✓
  </span>
);

// Del pedido armado a un chat con el aspecto de WhatsApp: el pedido viaja y el proveedor contesta.
export function OrderChat() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [step, setStep] = useState(4);

  useLoop(
    active,
    async (wait) => {
      setStep(0);
      await wait(1300);
      setStep(1);
      await wait(700);
      setStep(2);
      await wait(1500);
      setStep(3);
      await wait(1500);
      setStep(4);
      await wait(4400);
    },
    () => setStep(4)
  );

  return (
    <div ref={root} className="grid h-full gap-3 p-4 md:grid-cols-[1fr_1.15fr]">
      <div className="hidden flex-col justify-center rounded-xl border border-border bg-card p-3.5 shadow-sm md:flex">
        <p className="font-mono text-[10px] font-bold tracking-wide text-primary">✦ PEDIDO ARMADO POR PESITO</p>
        <div className="mt-2 space-y-1.5 text-xs text-foreground">
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between gap-2">
              <span className="truncate">{l.name}</span>
              <span className="font-mono font-semibold">x {l.qty}</span>
            </div>
          ))}
        </div>
        {step >= 4 ? (
          <span className="bubble-in mt-3 rounded-lg bg-accent px-3 py-2 text-center text-xs font-bold text-accent-foreground">
            En camino · llega mañana
          </span>
        ) : (
          <span
            className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-bold transition-[background-color,transform] duration-150 ${
              step >= 2 ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
            } ${step === 1 ? "scale-95" : ""}`}
          >
            {step === 0 ? "Mandar pedido" : step === 1 ? "Enviando…" : "Enviado"}
          </span>
        )}
      </div>

      {/* Chat con el aspecto de WhatsApp: colores propios, iguales en tema claro y oscuro */}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-[#efeae2] shadow-md">
        <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[11px] font-extrabold">DN</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Distribuidora Norte</span>
            <span className="block text-[10px] text-white/80">{step === 3 ? "escribiendo…" : "en línea"}</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5 bg-[radial-gradient(rgb(0_0_0/0.05)_1px,transparent_1px)] [background-size:14px_14px] p-2.5">
          {step >= 2 && (
            <div className="bubble-in max-w-[88%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 py-1.5 text-xs leading-snug text-[#111b21] shadow-sm">
              <p className="mb-0.5 font-mono text-[9px] font-bold tracking-wide text-[#047857]">✦ ARMADO POR PESITO</p>
              <p>Hola! Te paso el pedido de hoy: aceite x12, arroz x24, leche x36.</p>
              <p className="mt-0.5 text-right text-[9px] text-[#667781]">
                18:42{ticks}
              </p>
            </div>
          )}
          {step >= 4 && (
            <div className="bubble-in max-w-[88%] self-start rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 text-xs leading-snug text-[#111b21] shadow-sm">
              <p>Perfecto, mañana te lo llevamos.</p>
              <p className="mt-0.5 text-right text-[9px] text-[#667781]">18:44</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const sheet = [
  { name: "Yerba 1 kg", price: "$ 3.800" },
  { name: "Fideos 500 g", price: "$ 1.250" },
  { name: "Azúcar 1 kg", price: "$ 1.900" },
  { name: "Aceite 900 ml", price: "$ 3.850" },
];

// De la planilla a las etiquetas: cada fila viaja de un lado al otro y se vuelve etiqueta.
export function ImportFlow() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const box = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const chip = useRef<HTMLDivElement>(null);
  const [made, setMade] = useState(sheet.length);
  const [current, setCurrent] = useState(-1);

  useLoop(
    active,
    async (wait, alive) => {
      setMade(0);
      setCurrent(-1);
      await wait(900);
      for (let i = 0; i < sheet.length && alive(); i++) {
        setCurrent(i);
        await wait(350);
        const b = box.current;
        const a = rows.current[i];
        const t = slots.current[i];
        const c = chip.current;
        if (b && a && t && c) {
          const cb = b.getBoundingClientRect();
          const ar = a.getBoundingClientRect();
          const tr = t.getBoundingClientRect();
          c.textContent = `${sheet[i].name}  ${sheet[i].price}`;
          c.style.display = "block";
          c.animate(
            [
              { transform: `translate(${ar.left - cb.left}px, ${ar.top - cb.top}px) scale(1)`, opacity: 1 },
              { transform: `translate(${tr.left - cb.left + tr.width / 2 - 40}px, ${tr.top - cb.top + tr.height / 2 - 10}px) scale(0.8)`, opacity: 1 },
            ],
            { duration: 700, easing: "cubic-bezier(0.45, 0.05, 0.25, 1)", fill: "forwards" }
          );
        }
        await wait(720);
        if (chip.current) chip.current.style.display = "none";
        setMade(i + 1);
        await wait(250);
      }
      setCurrent(-1);
      await wait(3600);
    },
    () => {
      setMade(sheet.length);
      setCurrent(-1);
      if (chip.current) chip.current.style.display = "none";
    }
  );

  return (
    <div ref={root} className="flex h-full items-center justify-center p-4">
      <div ref={box} className="relative grid w-full max-w-md grid-cols-[1fr_1.1fr] items-center gap-5">
        <div className="rounded-lg border border-border bg-card p-2.5 shadow-sm">
          <p className="mb-2 font-mono text-[10px] font-semibold text-primary">productos.xlsx</p>
          <div className="space-y-1.5">
            {sheet.map((r, i) => (
              <div
                key={r.name}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[10px] transition-colors duration-200 ${
                  current === i ? "bg-primary/20 text-foreground" : i < made ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                <span className="truncate">{r.name}</span>
                <span className="font-mono">{r.price}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sheet.map((r, i) => (
            <div
              key={r.name}
              ref={(el) => {
                slots.current[i] = el;
              }}
              className="flex h-[4.4rem] items-center justify-center rounded-lg border border-dashed border-border/80"
            >
              {i < made && (
                <div className="bubble-in w-full rounded-md border border-border bg-card p-1.5 shadow-sm">
                  <p className="truncate text-[9px] font-semibold text-foreground">{r.name}</p>
                  <div className="barcode-bars my-1 h-5 rounded-sm" />
                  <p className="text-center font-mono text-[9px] font-semibold text-foreground">{r.price}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          ref={chip}
          className="pointer-events-none absolute left-0 top-0 z-10 hidden whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg"
        />
      </div>
    </div>
  );
}

type StockAlert = { id: string; title: string; note: string; tag: string; tone: "warning" | "danger" };

const stockAlerts: Record<number, StockAlert> = {
  5: { id: "low", title: "Queda poco", note: "Quedan 5", tag: "Aviso", tone: "warning" },
  2: { id: "soon", title: "Se acaba antes de que llegue un pedido", note: "Vendés unas 9 por día", tag: "Aviso", tone: "warning" },
  0: { id: "out", title: "Ya se acabó", note: "Leche entera 1 L", tag: "Sin stock", tone: "danger" },
};

// Alertas de stock: cada venta resta una unidad y, en cada umbral, aparece la alerta que corresponde.
export function StockAlerts() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [n, setN] = useState(2);
  const [saleKey, setSaleKey] = useState(0);
  const [shown, setShown] = useState<StockAlert[]>([stockAlerts[2], stockAlerts[5]]);

  useLoop(
    active,
    async (wait, alive) => {
      setN(8);
      setShown([]);
      setSaleKey(0);
      await wait(1200);
      for (let left = 7; left >= 0 && alive(); left--) {
        setN(left);
        setSaleKey((k) => k + 1);
        const alert = stockAlerts[left];
        if (alert) setShown((prev) => [alert, ...prev].slice(0, 3));
        await wait(alert ? 1500 : 850);
      }
      await wait(3600);
    },
    () => {
      setN(2);
      setSaleKey(0);
      setShown([stockAlerts[2], stockAlerts[5]]);
    }
  );

  const color = n <= 2 ? "var(--color-danger)" : n <= 5 ? "var(--color-warning)" : "var(--color-success)";

  return (
    <div ref={root} className="grid h-full items-center gap-4 p-4 sm:grid-cols-[1fr_1.1fr] sm:p-5">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Leche entera 1 L</p>
        <p className="text-5xl font-extrabold leading-none tracking-tight tabular-nums transition-colors duration-300 sm:text-6xl" style={{ color: n <= 5 ? color : undefined }}>
          {n}
        </p>
        <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">unidades</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-border bg-muted">
          <div
            className="h-full rounded-full transition-[width,background-color] duration-500 ease-out"
            style={{ width: `${(n / 8) * 100}%`, backgroundColor: color }}
          />
        </div>
        <p key={saleKey} className={`mt-2 h-4 font-mono text-[10.5px] font-semibold text-muted-foreground ${saleKey > 0 ? "sale-go" : "opacity-0"}`}>
          Venta: - 1 unidad
        </p>
      </div>
      <div className="min-h-[7.5rem] space-y-2">
        {shown.map((a) => (
          <div key={a.id} className="bubble-in flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <span className="min-w-0 leading-tight">
              <span className="block text-xs font-bold text-foreground">{a.title}</span>
              <span className="block text-[10.5px] text-muted-foreground">{a.note}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                a.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"
              }`}
            >
              {a.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
