"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";

function IdRow({ label, value }: { label: string; value: string }) {
  const { showSuccess } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess("¡Copiado!");
    } catch {
      // clipboard API bloqueada (permisos/http): no hay mucho más que hacer.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm text-foreground">{value}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  );
}

// Para soporte técnico: poder identificar sin ambigüedad a qué usuario y a
// qué negocio se refiere alguien que escribe pidiendo ayuda.
export function AccountIds({ userId, orgId }: { userId: string; orgId: string }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <IdRow label="ID de usuario" value={userId} />
      <IdRow label="ID de negocio" value={orgId} />
    </div>
  );
}
