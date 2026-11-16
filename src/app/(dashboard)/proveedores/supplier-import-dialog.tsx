"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { parseCsv } from "@/lib/product-import";
import {
  SUPPLIER_IMPORT_MAX_ROWS,
  parseSupplierSheet,
  type ParsedSupplierImport,
} from "@/lib/supplier-import";
import { downloadSupplierTemplate } from "@/app/(dashboard)/proveedores/supplier-template";
import { importSuppliers, type SupplierImportResult } from "@/app/(dashboard)/proveedores/import-actions";

async function readFile(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  throw new Error(
    name.endsWith(".xls")
      ? "Los archivos .xls viejos no se pueden leer. Abrilo en Excel y guardalo como .xlsx (o como CSV)."
      : "Subí una planilla de Excel (.xlsx) o un archivo CSV."
  );
}

export function SupplierImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSupplierImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<SupplierImportResult | null>(null);

  function reset() {
    setFileName("");
    setParsed(null);
    setError(null);
    setDone(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  function close() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const result = parseSupplierSheet(await readFile(file));
      if (result.missingColumns.length > 0) {
        setError(`Falta la columna “${result.missingColumns.join("” y “")}”. Descargá la planilla modelo y usá esos títulos.`);
        return;
      }
      if (result.rows.length === 0) {
        setError(result.problems.length > 0 ? "Ninguna fila se pudo leer. Revisá los datos de la planilla." : "No encontramos proveedores en la planilla.");
        setParsed(result.problems.length > 0 ? result : null);
        return;
      }
      if (result.rows.length > SUPPLIER_IMPORT_MAX_ROWS) {
        setError(`La planilla tiene demasiados proveedores (más de ${SUPPLIER_IMPORT_MAX_ROWS.toLocaleString("es-AR")}). Dividila en varios archivos.`);
        return;
      }
      setFileName(file.name);
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    }
  }

  async function start() {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importSuppliers(parsed.rows);
      if (res.error) {
        setError(res.error);
      } else {
        setDone({ ...res, problems: [...parsed.problems, ...res.problems] });
        showSuccess("Proveedores cargados", `${res.created} proveedor${res.created === 1 ? "" : "es"} nuevo${res.created === 1 ? "" : "s"}.`);
        router.refresh();
      }
    } catch {
      setError("Se cortó la conexión. Probá de nuevo (los que ya existen no se duplican).");
    }
    setImporting(false);
  }

  return (
    <Dialog open={open} onClose={close} title="Cargar proveedores desde Excel" description="Subí una planilla con tus proveedores y los cargamos todos juntos.">
      {done ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success">Listo, la carga terminó.</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-border px-2 py-3">
              <p className="text-xl font-bold text-success">{done.created.toLocaleString("es-AR")}</p>
              <p className="text-xs text-muted-foreground">Cargados</p>
            </div>
            <div className="rounded-xl border border-border px-2 py-3">
              <p className="text-xl font-bold text-foreground">{done.skipped.toLocaleString("es-AR")}</p>
              <p className="text-xs text-muted-foreground">Ya existían</p>
            </div>
          </div>
          {done.problems.length > 0 && <Problems problems={done.problems} />}
          <div className="flex justify-end">
            <Button onClick={close}>Cerrar</Button>
          </div>
        </div>
      ) : parsed && parsed.rows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="truncate">{fileName}</span>
          </div>
          <p className="text-sm text-foreground">
            {`Vamos a cargar ${parsed.rows.length.toLocaleString("es-AR")} proveedor${parsed.rows.length === 1 ? "" : "es"}. Los que ya tengas con el mismo nombre no se duplican ni se modifican.`}
          </p>
          <div className="max-h-56 overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 8).map((r) => (
                  <tr key={r.line} className="border-t border-border">
                    <td className="max-w-[12rem] truncate px-3 py-2 text-foreground">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 8 && <p className="text-xs text-muted-foreground">{`…y ${(parsed.rows.length - 8).toLocaleString("es-AR")} más.`}</p>}
          {parsed.ignoredColumns.length > 0 && <p className="text-xs text-muted-foreground">{`Columnas que no usamos: ${parsed.ignoredColumns.join(", ")}.`}</p>}
          {parsed.problems.length > 0 && <Problems problems={parsed.problems} />}
          {error && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset} disabled={importing}>
              Elegir otro archivo
            </Button>
            <Button onClick={() => void start()} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </>
              ) : (
                `Cargar ${parsed.rows.length.toLocaleString("es-AR")} proveedores`
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm text-foreground">
            <li>
              <span className="font-semibold">1.</span> Descargá la planilla modelo y completala con tus proveedores (o usá la tuya, con esos mismos títulos de columna).
            </li>
            <li>
              <span className="font-semibold">2.</span> Subila acá. Antes de guardar te mostramos cómo quedaría.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">Obligatoria: Nombre. Las demás (teléfono, email, notas y plazo de entrega) son opcionales.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadSupplierTemplate()}>
              <Download className="h-4 w-4" />
              Descargar planilla modelo
            </Button>
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Subir planilla
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
          </div>
          {error && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{error}</p>}
          {parsed && parsed.problems.length > 0 && <Problems problems={parsed.problems} />}
        </div>
      )}
    </Dialog>
  );
}

function Problems({ problems }: { problems: { line: number; message: string }[] }) {
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">{`Filas con problemas (${problems.length.toLocaleString("es-AR")})`}</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto px-3 py-2 text-xs text-muted-foreground">
        {problems.slice(0, 50).map((p, i) => (
          <li key={`${p.line}-${i}`}>{`Fila ${p.line}: ${p.message}`}</li>
        ))}
        {problems.length > 50 && <li>{`…y ${(problems.length - 50).toLocaleString("es-AR")} más.`}</li>}
      </ul>
    </div>
  );
}
