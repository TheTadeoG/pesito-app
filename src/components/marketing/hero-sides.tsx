"use client";

import { useEffect, useState, type ComponentType } from "react";
import { BarChart3, Banknote, MessageCircle, Printer, Smartphone, TriangleAlert } from "lucide-react";
import { useSale } from "@/components/marketing/hero-sale";
import { cn } from "@/lib/utils";

// Costados de la portada en pantallas anchas: al cobrar la venta del panel, seis
// nodos se encienden uno tras otro y muestran lo que Pesito hizo; después los
// avisos se retiran y quedan sólo los nodos. Todos los datos son de ejemplo.

interface NodeDef {
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  detail: string;
}

const LEFT: NodeDef[] = [
  { icon: Printer, label: "Ticket", title: "Ticket impreso", detail: "Venta #1048" },
  { icon: TriangleAlert, label: "Stock", title: "Gaseosa cola: quedan 3", detail: "Queda poco" },
  { icon: Banknote, label: "Caja", title: "+$4.500 en la caja", detail: "Caja de Lucas" },
];
const RIGHT: NodeDef[] = [
  { icon: Smartphone, label: "Celular", title: "Venta nueva · $4.500", detail: "En tu celular" },
  { icon: MessageCircle, label: "WhatsApp", title: "Pedido enviado ✓✓", detail: "Distribuidora Norte" },
  { icon: BarChart3, label: "Reportes", title: "Ventas de hoy $284.500", detail: "48 ventas" },
];

const NODE_Y = [40, 170, 300];
const EDGE_Y = [90, 190, 290];
const W = 232;

function Column({
  side,
  defs,
  lit,
  fire,
}: {
  side: "left" | "right";
  defs: NodeDef[];
  lit: number[];
  fire: number;
}) {
  const offset = side === "left" ? 0 : 3;
  const nodeX = side === "left" ? 100 : W - 100;
  const edgeX = side === "left" ? W : 0;
  const nodeEdge = side === "left" ? nodeX + 27 : nodeX - 27;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-0 hidden h-[420px] min-[1360px]:block",
        side === "left" ? "right-full" : "left-full"
      )}
      style={{ width: W }}
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {defs.map((_, i) => {
          const y = NODE_Y[i] + 27;
          const d = `M${edgeX} ${EDGE_Y[i]} C ${(edgeX + nodeEdge) / 2} ${EDGE_Y[i]}, ${(edgeX + nodeEdge) / 2} ${y}, ${nodeEdge} ${y}`;
          return <path key={i} d={d} fill="none" strokeWidth={2} strokeDasharray="3 5" strokeLinecap="round" className="stroke-border" />;
        })}
      </svg>
      {fire > 0 &&
        defs.map((_, i) => {
          const y = NODE_Y[i] + 27;
          const d = `M${edgeX} ${EDGE_Y[i]} C ${(edgeX + nodeEdge) / 2} ${EDGE_Y[i]}, ${(edgeX + nodeEdge) / 2} ${y}, ${nodeEdge} ${y}`;
          return (
            <i
              key={`${fire}-${i}`}
              className="hp-dot"
              style={{ offsetPath: `path('${d}')`, animationDuration: "1100ms", animationDelay: `${300 + (offset + i) * 450}ms` }}
            />
          );
        })}
      {defs.map((n, i) => {
        const Icon = n.icon;
        const on = lit.includes(offset + i);
        return (
          <div key={n.label}>
            <div
              className={cn(
                "absolute w-[190px] rounded-[11px] border border-border bg-card px-[11px] py-2 text-xs text-card-foreground shadow-lg shadow-black/10 transition-[opacity,transform] duration-300",
                on ? "translate-y-0 scale-100 opacity-100" : "translate-y-1.5 scale-[0.97] opacity-0"
              )}
              style={{ left: nodeX - 95, top: NODE_Y[i] - 52 }}
            >
              {n.title}
              <small className="block text-[10.5px] text-muted-foreground">{n.detail}</small>
            </div>
            <div className="absolute flex w-[110px] flex-col items-center gap-1.5 text-xs font-semibold text-card-foreground" style={{ left: nodeX - 55, top: NODE_Y[i] }}>
              <span
                className={cn(
                  "flex h-[54px] w-[54px] items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg shadow-black/10 transition-[box-shadow,border-color,transform] duration-500",
                  on && "scale-[1.06] border-primary! shadow-[0_0_0_6px_var(--color-accent)]"
                )}
              >
                <Icon className="h-[22px] w-[22px]" />
              </span>
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HeroSides() {
  const { fire } = useSale();
  const [lit, setLit] = useState<number[]>([]);

  useEffect(() => {
    if (fire === 0) return;
    const timers: number[] = [window.setTimeout(() => setLit([]), 0)];
    [0, 3, 1, 4, 2, 5].forEach((n, k) => {
      timers.push(window.setTimeout(() => setLit((l) => (l.includes(n) ? l : [...l, n])), 900 + k * 450));
    });
    timers.push(window.setTimeout(() => setLit([]), 900 + 6 * 450 + 2400));
    return () => timers.forEach(window.clearTimeout);
  }, [fire]);

  return (
    <>
      <Column side="left" defs={LEFT} lit={lit} fire={fire} />
      <Column side="right" defs={RIGHT} lit={lit} fire={fire} />
    </>
  );
}
