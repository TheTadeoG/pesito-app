"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingCycle, Plan } from "@/lib/subscription";
import { startSubscription } from "@/app/(dashboard)/configuracion/billing-actions";

export function PayButton({ plan, cycle, label }: { plan: Plan; cycle: BillingCycle; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setPending(true);
    setError(null);
    const result = await startSubscription(plan, cycle, "alta");
    if (result.error || !result.url) {
      setPending(false);
      setError(result.error ?? "No pudimos conectar con Mercado Pago.");
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="button" className="w-full" onClick={handlePay} disabled={pending}>
        {pending ? "Conectando con Mercado Pago…" : label}
      </Button>
    </div>
  );
}
