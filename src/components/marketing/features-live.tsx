"use client";

import { useEffect, useRef, useState } from "react";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

const items = [
  { name: "Aceite girasol 900 ml", price: 3850 },
  { name: "Arroz largo fino 1 kg", price: 2190 },
  { name: "Leche entera 1 L", price: 1450 },
  { name: "Galletitas dulces", price: 1450 },
];
const TOTAL = items.reduce((acc, i) => acc + i.price, 0);

// Sólo corre mientras se ve en pantalla y no con movimiento reducido: sin eso
// (o sin JS) queda el ticket completo, que es lo que ven los buscadores.
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

// Escáner + ticket de papel: el haz recorre el código, el producto entra al
// ticket y al final aparecen el total, lo que pagó y el vuelto.
export function TicketScanner() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [shown, setShown] = useState(items.length);
  const [done, setDone] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [current, setCurrent] = useState(items.length - 1);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));

    (async () => {
      while (!cancelled) {
        setShown(0);
        setDone(false);
        await wait(700);
        for (let i = 0; i < items.length && !cancelled; i++) {
          setCurrent(i);
          setScanKey((k) => k + 1);
          await wait(850);
          setShown(i + 1);
          await wait(650);
        }
        if (cancelled) break;
        setDone(true);
        await wait(3600);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      setShown(items.length);
      setDone(true);
    };
  }, [active]);

  return (
    <div ref={root} className="flex h-full flex-col gap-3 p-4">
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
        <div className="relative h-10 overflow-hidden rounded-md bg-muted">
          <div className="barcode-bars absolute inset-0" />
          <div
            key={scanKey}
            className={`absolute bottom-0 top-0 w-[3px] bg-primary opacity-0 shadow-[0_0_12px_var(--color-primary)] ${
              scanKey > 0 ? "beam-go" : ""
            }`}
          />
        </div>
        <p className="mt-2 flex justify-between text-xs">
          <span className="font-semibold text-foreground">{items[current].name}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{ars(items[current].price)}</span>
        </p>
      </div>

      <div className="ticket-paper mx-auto flex min-h-0 w-full max-w-[15.5rem] flex-1 flex-col px-3.5 pb-4 pt-3 font-mono text-[10.5px] shadow-lg">
        <p className="text-center text-[11px] font-bold tracking-[0.2em]">PESITO</p>
        <p className="text-center text-[9px] text-[#6b746f]">Ticket de venta</p>
        <div className="my-2 border-t border-dashed border-[#c4cbc7]" />
        <div className="space-y-1">
          {items.slice(0, shown).map((item) => (
            <div key={item.name} className="animate-line-in flex justify-between gap-2">
              <span className="truncate">{item.name}</span>
              <span className="tabular-nums">{ars(item.price)}</span>
            </div>
          ))}
        </div>
        <div
          className={`mt-auto transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}
        >
          <div className="my-2 border-t border-dashed border-[#c4cbc7]" />
          <div className="flex justify-between text-[12px] font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{ars(TOTAL)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[#6b746f]">
            <span>Pagó</span>
            <span className="tabular-nums">$ 10.000</span>
          </div>
          <div className="flex justify-between font-semibold text-[#047857]">
            <span>Vuelto</span>
            <span className="tabular-nums">$ 1.060</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cierre de caja: el efectivo contado sube hasta igualar al esperado.
export function CashCount({ expected }: { expected: number }) {
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const [value, setValue] = useState(expected);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let timer = 0;
    let cancelled = false;

    function run() {
      const t0 = performance.now();
      const step = (t: number) => {
        if (cancelled) return;
        const p = Math.min(1, (t - t0) / 1800);
        setValue(expected * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
        else timer = window.setTimeout(run, 3600);
      };
      raf = requestAnimationFrame(step);
    }
    run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      setValue(expected);
    };
  }, [active, expected]);

  const matched = Math.round(value) >= expected;

  return (
    <div ref={root} className="grid h-full grid-cols-1 content-center gap-3 px-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-8">
      <div className="text-center">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Esperado</p>
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-3xl">{ars(expected)}</p>
      </div>
      <span aria-hidden className="hidden text-muted-foreground sm:block">vs</span>
      <div className="text-center">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Contado</p>
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-3xl">{ars(value)}</p>
        <span
          className={`mt-2 inline-block rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success transition-opacity duration-300 ${
            matched ? "opacity-100" : "opacity-0"
          }`}
        >
          Sin diferencias
        </span>
      </div>
    </div>
  );
}
