"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlarmClock, X } from "lucide-react";
import { getCashReminder, type CashReminder } from "@/lib/cash-reminder";
import { cn, formatDateTime } from "@/lib/utils";

const STORAGE_KEY = "pesito-dismissed-cash-reminders";

function reminderText(reminder: CashReminder, openedAt: string) {
  if (reminder.kind === "stale") {
    return `Tu caja sigue abierta desde el ${formatDateTime(openedAt)}: cerrala para que el arqueo de cada día dé bien.`;
  }
  if (reminder.kind === "soon") {
    return `En ${reminder.minutesLeft} minuto${reminder.minutesLeft !== 1 ? "s" : ""} es la hora de cierre (${reminder.closeTime}). Andá preparando el arqueo.`;
  }
  return `Ya pasó la hora de cierre (${reminder.closeTime}). Acordate de cerrar la caja.`;
}

// Aviso para quien tiene la caja abierta: se evalúa en el navegador cada 30 s
// (sin volver al servidor), así aparece a la hora de cierre aunque la persona
// se quede todo el día en el POS.
export function CashCloseReminder({
  registerId,
  openedAt,
  closeTime,
}: {
  registerId: string;
  openedAt: string;
  closeTime: string | null;
}) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      // ignore malformed/blocked sessionStorage
    }
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Hasta montar no se sabe la hora del navegador: nada en el HTML del servidor.
  if (!now) return null;
  const reminder = getCashReminder(openedAt, closeTime, now);
  if (!reminder) return null;

  // Descartar "falta poco" no descarta el de la hora de cierre.
  const dismissKey = `${registerId}-${reminder.kind}`;
  if (dismissed.includes(dismissKey)) return null;

  function dismiss() {
    const updated = [...dismissed, dismissKey];
    setDismissed(updated);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  const urgent = reminder.kind !== "soon";

  return (
    <div
      role="status"
      className={cn(
        "mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-6 lg:mx-8",
        urgent ? "border-danger/30 bg-danger-bg" : "border-warning/30 bg-warning-bg"
      )}
    >
      <AlarmClock className={cn("h-4 w-4 shrink-0", urgent ? "text-danger" : "text-warning")} />
      <p className="min-w-0 flex-1 text-foreground">{reminderText(reminder, openedAt)}</p>
      {!pathname.startsWith("/caja") && (
        <Link
          href="/caja"
          className="shrink-0 rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
        >
          Ir a cerrar la caja
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar aviso"
        title="Descartar aviso"
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
