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

const items = [
  { name: "Aceite girasol 900 ml", price: 3850 },
  { name: "Arroz largo fino 1 kg", price: 2190 },
  { name: "Leche entera 1 L", price: 1450 },
  { name: "Galletitas dulces", price: 1450 },
  { name: "Yerba 1 kg", price: 3800 },
];
const PAID = 15000;
const TOTAL = items.reduce((acc, i) => acc + i.price, 0);

// Escáner de arriba abajo y, al terminar, la impresora saca el ticket.
export function TicketPrinter() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [current, setCurrent] = useState(0);
  const [scanKey, setScanKey] = useState(0);
  const [printed, setPrinted] = useState(true);
  const [printing, setPrinting] = useState(false);

  useLoop(
    active,
    async (wait) => {
      setPrinted(false);
      setPrinting(false);
      await wait(700);
      for (let i = 0; i < items.length; i++) {
        setCurrent(i);
        setScanKey((k) => k + 1);
        await wait(1150);
      }
      setPrinting(true);
      setPrinted(true);
      await wait(3400);
      setPrinting(false);
      await wait(3200);
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
          <span className="font-semibold text-foreground">{items[current].name}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{ars(items[current].price)}</span>
        </p>
        <div className="relative h-[5.5rem] overflow-hidden rounded-lg bg-muted">
          <div className="barcode-bars absolute inset-0" />
          <div
            key={scanKey}
            className={`absolute inset-x-0 top-0 h-[3px] bg-primary opacity-0 shadow-[0_0_12px_2px_var(--color-primary)] ${
              scanKey > 0 ? "beam-down" : ""
            }`}
          />
        </div>
      </div>

      <div className="relative z-10 mx-7 mt-2.5 h-6 rounded-t-[10px] rounded-b bg-gradient-to-b from-[#26332d] to-[#131b17] shadow-md shadow-black/20">
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
            transition: printed ? "transform 3.4s steps(16)" : "none",
          }}
        >
          <p className="text-center text-sm font-bold tracking-[0.22em]">PESITO</p>
          <p className="text-center text-[10px] text-[#6b746f]">Ticket de venta</p>
          <div className="my-3 border-t border-dashed border-[#c4cbc7]" />
          {items.map((item) => (
            <div key={item.name} className="flex justify-between gap-2 py-[3px]">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="whitespace-nowrap tabular-nums">{ars(item.price)}</span>
            </div>
          ))}
          <div className="my-3 border-t border-dashed border-[#c4cbc7]" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{ars(TOTAL)}</span>
          </div>
          <div className="flex justify-between text-[#6b746f]">
            <span>Pagó</span>
            <span className="tabular-nums">{ars(PAID)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#047857]">
            <span>Vuelto</span>
            <span className="tabular-nums">{ars(PAID - TOTAL)}</span>
          </div>
          <div className="barcode-bars mt-3 h-8 opacity-70" />
        </div>
      </div>
    </div>
  );
}

const bills = [20000, 10000, 5000, 2000, 1000, 2700];
const EXPECTED = 41200;
const COUNTED = bills.reduce((a, b) => a + b, 0);

// Los billetes caen a la bandeja, el contado sube y al final salta la diferencia.
export function CashBills() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [dropped, setDropped] = useState(bills.length);
  const [shake, setShake] = useState(0);

  useLoop(
    active,
    async (wait) => {
      setDropped(0);
      await wait(700);
      for (let i = 1; i <= bills.length; i++) {
        setDropped(i);
        await wait(620);
      }
      setShake((k) => k + 1);
      await wait(3800);
    },
    () => setDropped(bills.length)
  );

  const total = bills.slice(0, dropped).reduce((a, b) => a + b, 0);
  const done = dropped === bills.length;

  return (
    <div
      ref={root}
      key={shake}
      className={`grid h-full grid-cols-2 items-center gap-2 px-4 sm:px-10 ${shake > 0 ? "shake-x" : ""}`}
    >
      <div className="text-center">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Esperado</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-3xl">{ars(EXPECTED)}</p>
        <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Contado</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-3xl">{ars(total)}</p>
        <span
          className={`mt-1.5 inline-block rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-bold text-danger transition-opacity duration-300 ${
            done ? "opacity-100" : "opacity-0"
          }`}
        >
          Faltan {ars(EXPECTED - COUNTED)}
        </span>
      </div>
      <div className="relative mx-auto h-28 w-40">
        {bills.slice(0, dropped).map((b, i) => (
          <div
            key={i}
            className="bill-drop absolute left-1/2 grid h-10 w-24 -translate-x-1/2 place-items-center rounded-md border border-primary/40 bg-gradient-to-br from-accent to-primary/25 font-mono text-[11px] font-bold text-accent-foreground"
            style={
              {
                top: 56 - i * 5,
                rotate: `${((i % 3) - 1) * 3}deg`,
                "--r0": `${i % 2 ? 12 : -12}deg`,
              } as React.CSSProperties
            }
          >
            {b >= 1000 && i < bills.length - 1 ? ars(b) : "Monedas"}
          </div>
        ))}
        <div className="absolute inset-x-1.5 bottom-0 z-10 h-4 rounded-b-[10px] rounded-t border border-border bg-muted" />
      </div>
    </div>
  );
}

const chat = [
  { id: "m", who: "me" as const },
  { id: "t", who: "typing" as const },
  { id: "r", who: "them" as const },
  { id: "s", who: "sys" as const },
];

// Chat corto: Pesito arma el pedido, el proveedor contesta y el pedido queda en camino.
export function OrderChat() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [step, setStep] = useState(chat.length);

  useLoop(
    active,
    async (wait) => {
      setStep(0);
      await wait(700);
      setStep(1);
      await wait(1500);
      setStep(2);
      await wait(1500);
      setStep(3);
      await wait(1300);
      setStep(4);
      await wait(4200);
    },
    () => setStep(chat.length)
  );

  const shown = (n: number) => step >= n;

  return (
    <div ref={root} className="mx-auto flex h-full max-w-md flex-col gap-2 p-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-accent-foreground">DN</span>
        <span className="leading-tight">
          <span className="block text-sm font-bold text-foreground">Distribuidora Norte</span>
          <span className="block text-[10px] text-success">en línea</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden">
        {shown(1) && (
          <div className="bubble-in max-w-[85%] self-end rounded-xl rounded-br-sm border border-primary/30 bg-primary/15 px-3 py-2 text-xs leading-relaxed text-foreground">
            <p className="mb-1 font-mono text-[9.5px] font-bold tracking-wide text-primary">✦ ARMADO POR PESITO</p>
            <p>Hola! Te paso el pedido de hoy:</p>
            <p>• Aceite girasol 900 ml x 12</p>
            <p>• Arroz largo fino 1 kg x 24</p>
            <p>• Leche entera 1 L x 36</p>
          </div>
        )}
        {step === 2 && (
          <div className="bubble-in flex gap-1 self-start rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 150}ms` }} />
            ))}
          </div>
        )}
        {shown(3) && (
          <div className="bubble-in max-w-[85%] self-start rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2 text-xs text-foreground">
            Perfecto, mañana te lo llevamos.
          </div>
        )}
        {shown(4) && (
          <div className="bubble-in self-center rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">
            Pesito dejó el pedido en camino
          </div>
        )}
      </div>
    </div>
  );
}
