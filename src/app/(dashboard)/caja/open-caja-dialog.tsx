"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCaja } from "@/app/(dashboard)/caja/actions";

export function OpenCajaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          <Button className="mt-2" onClick={() => setOpen(true)}>
            <DollarSign className="h-4 w-4" />
            Abrir Mi Caja
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
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Contá todo el efectivo que tenés en caja en este momento.
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
