"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ListoState = "paid" | "pending" | "confirming";

const COUNTDOWN = 6;
const MAX_REFRESHES = 12;

// Pantalla de vuelta de Mercado Pago: dice con claridad si el pago ya está
// confirmado y el plan funcionando, y sigue sola a Pesito.
export function ListoView({
  state,
  planName,
  renewal,
  features,
  href,
}: {
  state: ListoState;
  planName: string;
  renewal: string;
  features: string[];
  href: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(COUNTDOWN);
  const [tries, setTries] = useState(0);

  // Pagado: cuenta regresiva y carga completa (las pantallas guardadas en
  // caché tienen el plan viejo).
  useEffect(() => {
    if (state !== "paid") return;
    if (left <= 0) {
      window.location.assign(href);
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [state, left, href]);

  // Sin confirmar: se vuelve a consultar cada 3 s (la página sincroniza con
  // Mercado Pago al cargarse) hasta ~36 s.
  useEffect(() => {
    if (state !== "confirming" || tries >= MAX_REFRESHES) return;
    const id = window.setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [state, tries, router]);

  if (state === "paid") {
    return (
      <div className="fx-up w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-success">Pago confirmado</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{`¡Ya tenés el ${planName}!`}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {`Tu pago se acreditó y el plan ya está activo. ${renewal}`}
          </p>
        </div>
        {features.length > 0 && (
          <div className="rounded-2xl bg-muted/60 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ya podés usar</p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-success">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          <a href={href} className="block">
            <Button className="w-full">Entrar a Pesito</Button>
          </a>
          <p className="text-xs text-muted-foreground">{`Te llevamos en ${left} s…`}</p>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="fx-up w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <Clock className="mx-auto h-12 w-12 text-warning" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tu pago está pendiente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando pagues en el local y Mercado Pago lo acredite, el plan se activa solo. No hace falta que hagas
            nada más ni que pagues de nuevo.
          </p>
        </div>
        <a href={href} className="block">
          <Button className="w-full">Ir a Pesito</Button>
        </a>
      </div>
    );
  }

  const slow = tries >= MAX_REFRESHES;
  return (
    <div className="fx-up w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
      {slow ? (
        <Clock className="mx-auto h-12 w-12 text-warning" />
      ) : (
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
      )}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {slow ? "Todavía no recibimos la confirmación" : "Confirmando tu pago…"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {slow
            ? "Mercado Pago está tardando más de lo normal. No pagues de nuevo: apenas lo confirme, el plan se activa solo y te avisamos en Pesito."
            : "Suele tardar unos segundos. Esta pantalla se actualiza sola."}
        </p>
      </div>
      <a href={href} className="block">
        <Button variant={slow ? "primary" : "outline"} className="w-full">
          Ir a Pesito
        </Button>
      </a>
    </div>
  );
}
