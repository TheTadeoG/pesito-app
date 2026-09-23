"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { OpenCajaFormDialog } from "@/app/(dashboard)/caja/open-caja-dialog";

function elapsed(openedAt: string) {
  const diffMs = Date.now() - new Date(openedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface CajaWidgetProps {
  cashRegister: {
    openedAt: string;
    openingAmount: number;
    cashTotal: number;
  } | null;
}

export function CajaWidget({ cashRegister }: CajaWidgetProps) {
  const [time, setTime] = useState(() =>
    cashRegister ? elapsed(cashRegister.openedAt) : "0:00:00"
  );
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (!cashRegister) return;
    const id = setInterval(() => setTime(elapsed(cashRegister.openedAt)), 1000);
    return () => clearInterval(id);
  }, [cashRegister]);

  // Con la caja cerrada, tocar acá abre el diálogo directo — no hace
  // falta pasar primero por /caja para llegar al mismo formulario. Con la
  // caja abierta, sí tiene sentido ir a /caja: ahí está el detalle real
  // (efectivo, desglose por medio de pago) para cerrarla o revisarla.
  if (!cashRegister) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenDialog(true)}
          className="block w-full rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Mi Caja
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
      href="/caja"
      className="block rounded-xl border border-border bg-background/60 p-3 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <LockOpen className="h-3.5 w-3.5 text-success" />
          Mi Caja
        </span>
        <Badge tone="success">Abierta</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Mi efectivo</p>
      <p className="text-lg font-bold text-foreground">{formatCurrency(cashRegister.cashTotal)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Abierta {time}</p>
    </Link>
  );
}
