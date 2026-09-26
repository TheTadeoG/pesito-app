"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BillingCycle, Plan } from "@/lib/subscription";
import type { PaymentMethod } from "@/lib/billing";
import { checkPendingCheckout, startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";

type Status = "idle" | "opening" | "waiting" | "pending" | "active";

/**
 * Pago del plan con Mercado Pago: abre el pago en otra pestaña y, mientras
 * tanto, pregunta cada pocos segundos si ya se pagó ese pago puntual. Apenas
 * se confirma, `status` pasa a "active" (Mercado Pago no siempre vuelve solo
 * a Pesito). "pending": eligió efectivo y todavía no pagó en el local.
 * Si el navegador bloquea la pestaña nueva, se va a Mercado Pago en esta.
 */
export function useMercadoPagoCheckout() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const checking = useRef(false);

  const start = useCallback(async (plan: Plan, cycle: BillingCycle, method: PaymentMethod) => {
    setError(null);
    setStatus("opening");
    // Se abre ya (dentro del clic) para que el navegador no la bloquee.
    const tab = window.open("", "_blank");
    const result = await startSubscription(plan, cycle, method);
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
  }, []);

  const check = useCallback(async () => {
    if (checking.current || !checkoutId) return;
    checking.current = true;
    try {
      const res = await checkPendingCheckout(checkoutId);
      if (res.state === "paid") {
        setActivePlan(res.plan);
        setPeriodEnd(res.periodEnd);
        setStatus("active");
      } else if (res.state === "pending") {
        setStatus("pending");
      }
    } finally {
      checking.current = false;
    }
  }, [checkoutId]);

  useEffect(() => {
    if (status !== "waiting" && status !== "pending") return;
    const id = window.setInterval(check, status === "pending" ? 15000 : 4000);
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

  return { status, error, checkoutUrl, activePlan, periodEnd, start, check, reset };
}
