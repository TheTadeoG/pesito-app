"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";

const DISMISS_KEY = "pesito-dismissed-new-device";

export interface NewDeviceLogin {
  id: string;
  who: string;
  device: string;
  at: string;
}

// Aviso para dueños/administradores: alguien del equipo (o ellos mismos)
// entró desde un dispositivo nuevo en las últimas 48 h. Se cierra y no
// vuelve a aparecer hasta que haya un ingreso nuevo distinto.
export function NewDeviceAlert({ logins }: { logins: NewDeviceLogin[] }) {
  const latestId = logins[0]?.id ?? null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DISMISS_KEY);
    } catch {
      // sin almacenamiento: se muestra igual
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(stored === latestId);
  }, [latestId]);

  if (!latestId || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, latestId!);
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  const first = logins[0];
  const more = logins.length > 1 ? ` (y ${logins.length - 1} más)` : "";

  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-foreground sm:mx-6 lg:mx-8">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p className="flex-1">
        {`Ingreso desde un dispositivo nuevo: ${first.who}, ${first.device}, ${first.at}${more}. ¿No lo reconocés? Cambiá la contraseña. `}
        <Link href="/configuracion" prefetch={false} className="font-medium text-primary hover:underline">
          Ver ingresos
        </Link>
      </p>
      <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
