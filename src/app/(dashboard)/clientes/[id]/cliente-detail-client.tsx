"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CustomerForm } from "@/app/(dashboard)/clientes/customer-form";
import { PaymentDialog } from "@/app/(dashboard)/clientes/payment-dialog";
import type { Customer } from "@/lib/types";

export function ClienteDetailClient({
  customer,
  customPaymentMethods = [],
}: {
  customer: Customer;
  customPaymentMethods?: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{customer.name}</h1>
              {customer.balance > 0 && (
                <Badge tone="warning">Debe {formatCurrency(customer.balance)}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[customer.phone, customer.email, customer.document].filter(Boolean).join(" · ") ||
                "Sin datos de contacto"}
            </p>
            {customer.notes && (
              <p className="mt-1 text-sm text-muted-foreground">{customer.notes}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {customer.balance > 0 && (
              <Button variant="outline" onClick={() => setPaying(true)}>
                <Wallet className="h-4 w-4" />
                Registrar pago
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      <CustomerForm
        open={editing}
        onClose={() => {
          setEditing(false);
          router.refresh();
        }}
        customer={customer}
      />
      <PaymentDialog
        customer={paying ? customer : null}
        onClose={() => {
          setPaying(false);
          router.refresh();
        }}
        customPaymentMethods={customPaymentMethods}
      />
    </>
  );
}
