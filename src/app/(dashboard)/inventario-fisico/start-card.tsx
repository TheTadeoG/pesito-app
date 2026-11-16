"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { startInventory } from "@/app/(dashboard)/inventario-fisico/actions";

export interface PastCount {
  id: string;
  name: string;
  branch: string | null;
  appliedAt: string | null;
  adjusted: number;
  plus: number;
  minus: number;
}

type Scope = "todo" | "marca" | "proveedor";

export function StartCard({
  branchName,
  brands,
  suppliers,
  history,
}: {
  branchName: string | null;
  brands: string[];
  suppliers: { id: string; name: string }[];
  history: PastCount[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("todo");
  const [brand, setBrand] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "marca" && !brand) return setError("Elegí una marca.");
    if (scope === "proveedor" && !supplierId) return setError("Elegí un proveedor.");
    setPending(true);
    setError(null);
    const label = name.trim() || (scope === "marca" ? `Inventario ${brand}` : "Inventario");
    const res = await startInventory(label, scope === "marca" ? brand : null, scope === "proveedor" ? supplierId : null);
    if (res.error) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Nuevo inventario{branchName ? ` · ${branchName}` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Contás tu mercadería real (escaneando o a mano), mirás las diferencias contra el sistema y recién al final ajustás el stock. Mientras contás podés seguir vendiendo, y podés cortar y seguir otro día.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={start} className="grid max-w-xl gap-4">
            <div>
              <Label htmlFor="inv-name">Nombre (opcional)</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej: Inventario de fin de mes" />
            </div>
            <div>
              <Label htmlFor="inv-scope">Qué querés contar</Label>
              <Select id="inv-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                <option value="todo">Todos los productos activos</option>
                <option value="marca">Una marca</option>
                <option value="proveedor">Los de un proveedor</option>
              </Select>
            </div>
            {scope === "marca" && (
              <Select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marca">
                <option value="">Elegí una marca</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            )}
            {scope === "proveedor" && (
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Proveedor">
                <option value="">Elegí un proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Empezando…" : "Empezar a contar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventarios anteriores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{`${h.appliedAt ? formatDateTime(h.appliedAt) : ""}${h.branch ? ` · ${h.branch}` : ""}`}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h.adjusted === 0
                      ? "Sin diferencias"
                      : `${h.adjusted} producto${h.adjusted === 1 ? "" : "s"} ajustado${h.adjusted === 1 ? "" : "s"} · `}
                    {h.adjusted > 0 && (
                      <>
                        <span className="font-semibold text-success">{`+${h.plus.toLocaleString("es-AR")}`}</span>
                        {" / "}
                        <span className="font-semibold text-danger">{`−${h.minus.toLocaleString("es-AR")}`}</span>
                        {" unidades"}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
