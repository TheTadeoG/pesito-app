"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCaja } from "@/app/(dashboard)/caja/actions";

const ENTER_GUARD_MS = 1000;

export function OpenCajaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enterReady, setEnterReady] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    setEnterReady(false);
    setOpen(true);
  }

  async function submitOpen() {
    setPending(true);
    setError(null);
    const result = await openCaja(Number(amount) || 0);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setAmount("");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    await submitOpen();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || open) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      openDialog();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Evita que un Enter que llega justo al abrirse el diálogo (p. ej. el
  // mismo doble Enter que lo abrió) confirme la apertura antes de que el
  // usuario haya podido cargar un monto real. El campo ni siquiera recibe
  // foco hasta pasado este tiempo, así ningún Enter perdido puede caer ahí.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setEnterReady(true);
      amountRef.current?.focus();
    }, ENTER_GUARD_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <>
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Tu caja está cerrada</h2>
          <p className="text-sm text-muted-foreground">
            Abrí tu caja con el efectivo con el que empezás el día para poder vender.
          </p>
          <Button className="mt-2" onClick={openDialog}>
            <DollarSign className="h-4 w-4" />
            Abrir Mi Caja (Enter)
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Abrir Mi Caja"
        description="Abre tu sesión personal de caja. Cada usuario tiene su propia caja independiente. Ingresá el monto inicial con el que comenzás."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Monto inicial (en efectivo)
            </label>
            <Input
              ref={amountRef}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.repeat) return;
                e.preventDefault();
                if (amount && !pending && enterReady) {
                  submitOpen();
                }
              }}
              placeholder="0.00"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Contá todo el efectivo que tenés en caja en este momento.
              {!enterReady && " Esperá unos segundos para confirmar con Enter."}
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <DollarSign className="h-4 w-4" />
              {pending ? "Abriendo…" : "Abrir Caja"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
