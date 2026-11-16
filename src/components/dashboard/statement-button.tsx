"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { downloadAccountStatement } from "@/lib/account-statement-excel";

/** Hook: baja el estado de cuenta en Excel y avisa si algo falla. */
export function useAccountStatement(kind: "cliente" | "proveedor") {
  const { showWarning } = useToast();
  const [busy, setBusy] = useState(false);
  async function download(id: string) {
    setBusy(true);
    try {
      const problem = await downloadAccountStatement(kind, id);
      if (problem) showWarning("No pudimos bajar el estado de cuenta", problem);
    } catch {
      showWarning("No pudimos bajar el estado de cuenta", "Probá de nuevo en un rato.");
    }
    setBusy(false);
  }
  return { busy, download };
}

/** Botón "Estado de cuenta" (Excel) de la ficha de un cliente o proveedor. */
export function StatementButton({ kind, id }: { kind: "cliente" | "proveedor"; id: string }) {
  const { busy, download } = useAccountStatement(kind);
  return (
    <Button variant="outline" onClick={() => void download(id)} disabled={busy}>
      <Download className="h-4 w-4" />
      {busy ? "Preparando…" : "Estado de cuenta"}
    </Button>
  );
}
