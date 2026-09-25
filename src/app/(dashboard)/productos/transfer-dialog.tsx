"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast/toast-provider";
import { transferStock } from "@/lib/actions/branches";

interface TransferProduct {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  stock: number;
  unit: string;
}

interface Line {
  product: TransferProduct;
  quantity: string;
}

// Pasar mercadería de la sucursal actual a otra.
export function TransferButton({
  products,
  branches,
  currentBranchId,
}: {
  products: TransferProduct[];
  branches: { id: string; name: string }[];
  currentBranchId: string;
}) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const destinations = branches.filter((b) => b.id !== currentBranchId);
  const [toId, setToId] = useState(destinations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromName = branches.find((b) => b.id === currentBranchId)?.name ?? "";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.stock > 0 &&
          !lines.some((l) => l.product.id === p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.barcode?.toLowerCase() === q ||
            p.sku?.toLowerCase() === q)
      )
      .slice(0, 8);
  }, [products, query, lines]);

  function reset() {
    setLines([]);
    setQuery("");
    setNote("");
    setError(null);
  }

  async function submit() {
    setError(null);
    const items = lines.map((l) => ({ product_id: l.product.id, quantity: Number(l.quantity) }));
    const invalid = lines.find(
      (l) => !(Number(l.quantity) > 0) || Number(l.quantity) > l.product.stock
    );
    if (invalid) {
      setError(`Revisá la cantidad de ${invalid.product.name} (hay ${invalid.product.stock}).`);
      return;
    }
    setPending(true);
    const result = await transferStock(currentBranchId, toId, items, note);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const toName = branches.find((b) => b.id === toId)?.name ?? "";
    showSuccess("Transferencia hecha", `${lines.length} productos de ${fromName} a ${toName}`);
    setOpen(false);
    reset();
    router.refresh();
  }

  if (destinations.length === 0) return null;

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <ArrowRightLeft className="h-4 w-4" />
        Transferir a otra sucursal
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Transferir mercadería"
        description={`Sale del stock de ${fromName} y entra en la sucursal que elijas.`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="transfer-to">Hacia</Label>
            <Select id="transfer-to" value={toId} onChange={(e) => setToId(e.target.value)}>
              {destinations.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <Label htmlFor="transfer-search">Agregar producto</Label>
            <Input
              id="transfer-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o código de barras"
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setLines((current) => [...current, { product: p, quantity: "1" }]);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Hay {p.stock} {p.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {lines.map((l, i) => (
                <li key={l.product.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Hay {l.product.stock} {l.product.unit} en {fromName}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={l.quantity}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x))
                      )
                    }
                    className="h-9 w-24"
                    aria-label={`Cantidad de ${l.product.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((_, j) => j !== i))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    aria-label={`Quitar ${l.product.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <Label htmlFor="transfer-note">Nota (opcional)</Label>
            <Input
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: reposición del sábado"
            />
          </div>

          {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending || lines.length === 0 || !toId}>
              {pending ? "Transfiriendo…" : "Transferir"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
