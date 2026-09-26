"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BillingCycle, Plan } from "@/lib/subscription";
import { checkPendingCheckout, startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";

type Status = "idle" | "opening" | "waiting" | "active";

/**
 * Pago del plan con Mercado Pago: abre el checkout en otra pestaña y, mientras
 * tanto, pregunta cada pocos segundos si ya se pagó. Apenas se confirma,
 * `status` pasa a "active" (Mercado Pago no siempre vuelve solo a Pesito).
 * Si el navegador bloquea la pestaña nueva, se va a Mercado Pago en esta.
 */
export function useMercadoPagoCheckout(from: "configuracion" | "alta") {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const checking = useRef(false);

  const start = useCallback(
    async (plan: Plan, cycle: BillingCycle) => {
      setError(null);
      setStatus("opening");
      // Se abre ya (dentro del clic) para que el navegador no la bloquee.
      const tab = window.open("", "_blank");
      const result = await startSubscription(plan, cycle, from);
      if (result.error || !result.url || !result.checkoutId) {
        tab?.close();
        setStatus("idle");
        setError(result.error ?? "No pudimos conectar con Mercado Pago.");
        return;
      }
      setCheckoutId(result.checkoutId);
      if (!tab) {
        window.location.href = result.url;
        return;
      }
      tab.opener = null;
      tab.location.href = result.url;
      setCheckoutUrl(result.url);
      setStatus("waiting");
    },
    [from]
  );

  const check = useCallback(async () => {
    if (checking.current || !checkoutId) return;
    checking.current = true;
    try {
      const res = await checkPendingCheckout(checkoutId);
      if (res.paid) {
        setActivePlan(res.plan);
        setStatus("active");
      }
    } finally {
      checking.current = false;
    }
  }, [checkoutId]);

  useEffect(() => {
    if (status !== "waiting") return;
    const id = window.setInterval(check, 4000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [status, check]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, checkoutUrl, activePlan, start, check, reset };
}
