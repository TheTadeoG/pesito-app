"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";

// `dateIso` es "YYYY-MM-DD" simple (sin instante UTC ni huso horario), para
// no correr la fecha un día al formatearla en el navegador del cliente.
function formatSimpleDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export interface CommercialDateProp {
  id: string;
  name: string;
  suggestion: string;
  approximate?: boolean;
  dateIso: string;
  daysUntil: number;
}

const STORAGE_KEY = "pesito-dismissed-commercial-dates";

export function CommercialDatesBanner({ dates }: { dates: CommercialDateProp[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(new Set(JSON.parse(raw)));
      }
    } catch {
      // ignore malformed/blocked localStorage
    }
    setHydrated(true);
  }, []);

  if (!hydrated || dates.length === 0) return null;

  // El key incluye el año de la fecha: se vuelve a mostrar en la próxima
  // edición aunque se haya descartado la de este año.
  const next = dates.find((d) => !dismissed.has(`${d.id}-${d.dateIso.slice(0, 4)}`));
  if (!next) return null;

  const dismissKey = `${next.id}-${next.dateIso.slice(0, 4)}`;

  function dismiss() {
    setDismissed((current) => {
      const updated = new Set(current).add(dismissKey);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // ignore
      }
      return updated;
    });
  }

  const whenLabel =
    next.daysUntil === 0
      ? "es hoy"
      : next.daysUntil === 1
        ? "es mañana"
        : `es en ${next.daysUntil} días (${formatSimpleDate(next.dateIso)})`;

  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm sm:mx-6 lg:mx-8">
      <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-accent-foreground">
        <span className="font-semibold">{next.name}</span> {whenLabel}
        {next.approximate && " (fecha aproximada)"}. {next.suggestion}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar aviso"
        title="Descartar aviso"
        className="shrink-0 rounded-full p-1 text-accent-foreground/70 hover:bg-black/5 hover:text-accent-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
