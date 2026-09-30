"use client";

import type { ReactNode, Ref } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

// Fases de cada escena del panel de la portada. En reposo (sin JS, sin
// movimiento reducido o fuera de pantalla) se muestra la última: todo ya
// actualizado y sin resaltes.
//   0 quieto · 1 el cursor va al botón · 2 clic · 3 botón hecho y salen las líneas
//   4 se actualizan las tarjetas (resaltadas) · 5 quieto con todo actualizado
export const LAST_PHASE = 5;

export interface SceneProps {
  ph: number;
  active: boolean;
  variant: number;
  btnRef: Ref<HTMLDivElement>;
  /** Registra la tarjeta i como destino de las líneas. */
  tg: (i: number) => (el: HTMLElement | null) => void;
}

export function Card({
  title,
  right,
  hit,
  tgRef,
  className,
  children,
}: {
  title?: ReactNode;
  right?: ReactNode;
  hit?: boolean;
  tgRef?: (el: HTMLElement | null) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      ref={tgRef}
      className={cn(
        "relative rounded-xl border border-border bg-card p-3 transition-[box-shadow,border-color] duration-500",
        hit && "border-primary! shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]",
        className
      )}
    >
      {title && (
        <div className="mb-2 flex items-center justify-between gap-2 text-[11.5px] font-bold tracking-[0.01em] text-muted-foreground">
          <span>{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

const pillTones = {
  ok: "bg-success-bg text-success",
  warn: "bg-warning-bg text-warning",
  bad: "bg-danger-bg text-danger",
  soft: "bg-accent text-accent-foreground",
} as const;

export function Pill({
  tone = "ok",
  hidden,
  children,
}: {
  tone?: keyof typeof pillTones;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold transition-[opacity,transform] duration-300",
        pillTones[tone],
        hidden && "translate-y-1 opacity-0"
      )}
    >
      {children}
    </span>
  );
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] tabular-nums", className)}>
      {children}
    </div>
  );
}

export function Meter({ pct, low }: { pct: number; low?: boolean }) {
  return (
    <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-muted">
      <i
        className={cn(
          "block h-full rounded-full transition-[width,background-color] duration-700 ease-out",
          low ? "bg-warning" : "bg-primary"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Line({
  title,
  sub,
  qty,
  gone,
}: {
  title: ReactNode;
  sub?: ReactNode;
  qty?: ReactNode;
  gone?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-1.5 flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-border px-2.5 py-[7px] transition-all duration-500",
        gone && "mb-0 max-h-0 translate-x-3.5 border-0 py-0 opacity-0"
      )}
    >
      <div className="min-w-0">
        <div className="truncate">{title}</div>
        {sub && <small className="block truncate text-[11px] text-muted-foreground">{sub}</small>}
      </div>
      {qty && <span className="whitespace-nowrap tabular-nums text-muted-foreground">{qty}</span>}
    </div>
  );
}

// Botón de acción de cada escena: el cursor lo "toca" y pasa a verde.
export function ActionButton({
  btnRef,
  ph,
  label,
  done,
}: {
  btnRef: Ref<HTMLDivElement>;
  ph: number;
  label: string;
  done: string;
}) {
  const isDone = ph >= 3;
  return (
    <div
      ref={btnRef}
      className={cn(
        "mt-2 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-bold transition-[transform,background-color] duration-300",
        isDone ? "bg-success text-primary-foreground" : "bg-primary text-primary-foreground",
        ph === 2 && "scale-[0.97]"
      )}
    >
      {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
      {isDone ? done : label}
    </div>
  );
}

export const cols = "grid gap-3 @xl:grid-cols-[1.05fr_1fr] @xl:gap-[34px]";
