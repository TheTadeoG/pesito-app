"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Settings2, ShoppingCart, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { CLOSE_SOON_MINUTES, getCashReminder, type CashReminder } from "@/lib/cash-reminder";
import { onCashDelta } from "@/lib/cash-events";
import { OpenCajaFormDialog } from "@/app/(dashboard)/caja/open-caja-dialog";

function elapsed(openedAt: string) {
  const diffMs = Date.now() - new Date(openedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface VenderCardProps {
  /** Hora de cierre del negocio (organizations.cash_close_time). */
  closeTime?: string | null;
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    // null si no se pudo calcular el efectivo.
    cashTotal: number | null;
  } | null;
}

// Bloque destacado arriba del nav: junta Vender y Caja en un solo lugar, con
// lo que hay en caja. Pasa a ámbar cuando se acerca la hora de cierre. El
// monto se puede ocultar (el ojito) si hay clientes mirando el mostrador.
const HIDE_KEY = "pesito-hide-cash";

export function VenderCard({ cashRegister, closeTime = null }: VenderCardProps) {
  const [time, setTime] = useState(() =>
    cashRegister ? elapsed(cashRegister.openedAt) : "0:00:00"
  );
  const [openDialog, setOpenDialog] = useState(false);
  const [reminder, setReminder] = useState<CashReminder | null>(null);
  const [hidden, setHidden] = useState(false);
  // Efectivo que entró desde el último render del servidor (ventas cobradas
  // en el POS, que ya no refrescan el layout). `base` es el cashRegister
  // sobre el que se acumuló: cuando el servidor manda uno nuevo, se descarta.
  const [cashDelta, setCashDelta] = useState<{ base: VenderCardProps["cashRegister"]; amount: number }>({
    base: cashRegister,
    amount: 0,
  });
  const cashTotal =
    cashRegister?.cashTotal == null
      ? null
      : cashRegister.cashTotal + (cashDelta.base === cashRegister ? cashDelta.amount : 0);

  useEffect(
    () =>
      onCashDelta((amount) =>
        setCashDelta((current) => ({
          base: cashRegister,
          amount: (current.base === cashRegister ? current.amount : 0) + amount,
        }))
      ),
    [cashRegister]
  );

  useEffect(() => {
    if (!cashRegister) return;
    const tick = () => {
      setTime(elapsed(cashRegister.openedAt));
      setReminder(getCashReminder(cashRegister.openedAt, closeTime));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cashRegister, closeTime]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // sin localStorage: se muestra el monto
    }
  }, []);

  function toggleHidden() {
    setHidden((v) => {
      try {
        window.localStorage.setItem(HIDE_KEY, v ? "0" : "1");
      } catch {
        // ignore
      }
      return !v;
    });
  }

  if (!cashRegister) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenDialog(true)}
          className="block w-full rounded-xl border border-border bg-background/60 p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Vender
            </span>
            <Badge tone="default">Cerrada</Badge>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <Settings2 className="h-3.5 w-3.5" />
            Abrir caja para vender
          </p>
        </button>
        <OpenCajaFormDialog open={openDialog} onClose={() => setOpenDialog(false)} />
      </>
    );
  }

  const closing = reminder?.kind === "soon" || reminder?.kind === "closing" || reminder?.kind === "stale";
  const soonProgress =
    reminder?.kind === "soon"
      ? Math.min(100, Math.max(4, ((CLOSE_SOON_MINUTES - reminder.minutesLeft) / CLOSE_SOON_MINUTES) * 100))
      : 100;
  const statusText =
    reminder?.kind === "soon"
      ? `Cierra en ${reminder.minutesLeft} min`
      : reminder?.kind === "closing"
        ? "Ya es hora de cerrar"
        : reminder?.kind === "stale"
          ? "Caja de un día anterior"
          : "Caja abierta";

  return (
    <div
      className={cn(
        "rounded-2xl p-3.5 text-white",
        closing
          ? "bg-[radial-gradient(120%_140%_at_0%_0%,#f59e0b_0%,#b45309_60%,#78350f_100%)] shadow-lg shadow-amber-600/25"
          : "bg-[radial-gradient(120%_140%_at_0%_0%,#10b981_0%,#047857_55%,#064e3b_100%)] shadow-lg shadow-emerald-700/30"
      )}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
          {statusText}
        </span>
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={hidden ? "Mostrar el monto" : "Ocultar el monto"}
          title={hidden ? "Mostrar el monto" : "Ocultar el monto"}
          className="rounded-md p-0.5 opacity-80 transition-opacity hover:opacity-100"
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <Link
        href="/caja"
        title="Ver la caja"
        className="mt-1 block text-[1.75rem] font-bold leading-tight tracking-tight hover:opacity-90"
      >
        {cashTotal === null ? "—" : hidden ? "$ ••••••" : formatCurrency(cashTotal)}
      </Link>
      {reminder?.kind === "soon" ? (
        <div className="mb-3 mt-1.5 h-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${soonProgress}%` }} />
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-white/80">
          {/* El servidor y el navegador calculan el tiempo con segundos de
              diferencia; sin esto React tira error de hidratación (#418). */}
          Abierta hace <span suppressHydrationWarning>{time}</span>
        </p>
      )}
      <div className="flex gap-2">
        <Link
          href="/pos"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-2 py-2 text-xs font-bold transition-colors hover:bg-white/90",
            closing ? "text-amber-800" : "text-emerald-800"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          Vender
        </Link>
        <Link
          href="/caja"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/20 px-2 py-2 text-xs font-bold transition-colors hover:bg-white/30"
        >
          <Wallet className="h-4 w-4" />
          {closing ? "Cerrar caja" : "Caja"}
        </Link>
      </div>
    </div>
  );
}
