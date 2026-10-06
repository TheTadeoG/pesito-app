"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { voidSupplierPayment } from "@/app/(dashboard)/proveedores/actions";

export function VoidPaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !confirm(
        `¿Anular ${label}? Vuelve la deuda al proveedor y el dinero a tu caja. Esto no se puede deshacer.`
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await voidSupplierPayment(paymentId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-danger disabled:opacity-50"
      >
        <Undo2 className="h-3 w-3" />
        {pending ? "Anulando…" : "Anular"}
      </button>
      {error && <span className="mt-0.5 max-w-48 whitespace-normal text-right text-[11px] text-danger">{error}</span>}
    </span>
  );
}
