"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Lock, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
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
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    cashTotal: number;
  } | null;
}

// Bloque destacado arriba del nav: funde el acceso a Punto de Venta con el
// estado de caja, porque vender es lo que un kiosquero hace todo el día —
// no compite por atención con el resto del menú como un ítem más. Ver o
// cerrar la caja en detalle sigue en su propio ítem de nav ("Caja").
export function VenderCard({ cashRegister }: VenderCardProps) {
  const [time, setTime] = useState(() =>
    cashRegister ? elapsed(cashRegister.openedAt) : "0:00:00"
  );
  const [openDialog, setOpenDialog] = useState(false);
  // Efectivo que entró desde el último render del servidor (ventas cobradas
  // en el POS, que ya no refrescan el layout). `base` es el cashRegister
  // sobre el que se acumuló: cuando el servidor manda uno nuevo, se descarta.
  const [cashDelta, setCashDelta] = useState<{ base: VenderCardProps["cashRegister"]; amount: number }>({
    base: cashRegister,
    amount: 0,
  });
  const cashTotal =
    (cashRegister?.cashTotal ?? 0) + (cashDelta.base === cashRegister ? cashDelta.amount : 0);

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
    const id = setInterval(() => setTime(elapsed(cashRegister.openedAt)), 1000);
    return () => clearInterval(id);
  }, [cashRegister]);

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

  return (
    <Link
      href="/pos"
      className="block rounded-xl bg-primary p-3.5 text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="h-4 w-4" />
          Vender
        </span>
        <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
          Abierta
        </span>
      </div>
      <p className="mt-2 text-xs text-primary-foreground/80">
        {formatCurrency(cashTotal)} en caja ·{" "}
        {/* El servidor y el navegador calculan el tiempo con segundos de
            diferencia; sin esto React tira error de hidratación (#418). */}
        <span suppressHydrationWarning>{time}</span>
      </p>
    </Link>
  );
}
