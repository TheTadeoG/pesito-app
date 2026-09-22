"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SupplierForm } from "@/app/(dashboard)/proveedores/supplier-form";
import { SupplierPaymentDialog } from "@/app/(dashboard)/proveedores/supplier-payment-dialog";
import type { Supplier } from "@/lib/types";

export function ProveedorDetailClient({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{supplier.name}</h1>
              {supplier.balance > 0 && (
                <Badge tone="warning">Le debés {formatCurrency(supplier.balance)}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[supplier.phone, supplier.email].filter(Boolean).join(" · ") ||
                "Sin datos de contacto"}
            </p>
            {supplier.notes && (
              <p className="mt-1 text-sm text-muted-foreground">{supplier.notes}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {supplier.balance > 0 && (
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

      <SupplierForm
        open={editing}
        onClose={() => {
          setEditing(false);
          router.refresh();
        }}
        supplier={supplier}
      />
      <SupplierPaymentDialog
        supplier={paying ? supplier : null}
        onClose={() => {
          setPaying(false);
          router.refresh();
        }}
      />
    </>
  );
}
