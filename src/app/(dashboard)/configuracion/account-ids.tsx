"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";

function IdRow({ label, value }: { label: string; value: string }) {
  const { showSuccess } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(`¡${label} copiado!`);
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

// Para soporte técnico: el dato que conviene compartir al pedir ayuda,
// para identificar sin ambigüedad a qué negocio se refiere. Para
// identificar a una persona puntual del equipo ya alcanza con su nombre
// de usuario o email (son únicos en toda la app).
export function AccountIds({ orgCode }: { orgCode: string }) {
  return (
    <div className="border-t border-border pt-4">
      <IdRow label="Código de negocio" value={`#${orgCode}`} />
    </div>
  );
}
