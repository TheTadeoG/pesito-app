"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BillingCycle, Plan } from "@/lib/subscription";
import type { PaymentMethod } from "@/lib/billing";
import { checkPendingCheckout, startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";

type Status = "idle" | "opening" | "waiting" | "pending" | "active";

/**
 * Pago del plan con Mercado Pago: lleva a Mercado Pago en esta misma pestaña
 * (vuelve a /suscribirse/listo). `check` pregunta si un pago puntual ya se
 * confirmó (por si vuelve con "atrás" o toca "Ya pagué"): `status` pasa a
 * "active". "pending": eligió efectivo y todavía no pagó en el local.
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
    const result = await startSubscription(plan, cycle, method);
    if (result.error || !result.url || !result.checkoutId) {
      setStatus("idle");
      setError(result.error ?? "No pudimos conectar con Mercado Pago.");
      return;
    }
    setCheckoutId(result.checkoutId);
    setCheckoutUrl(result.url);
    // En esta misma pestaña: Mercado Pago deja un botón "Ir a la página del
    // vendedor" que vuelve a /suscribirse/listo, y ahí se sigue solo a Pesito.
    window.location.assign(result.url);
  }, []);

  // Si vuelve con "atrás" desde Mercado Pago, la pantalla no queda trabada
  // en "Abriendo el pago…".
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setStatus((s) => (s === "opening" ? "idle" : s));
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
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
