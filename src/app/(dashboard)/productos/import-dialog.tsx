"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { importProductsChunk } from "@/app/(dashboard)/productos/import-actions";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_ROWS,
  TEMPLATE_COLUMNS,
  parseCsv,
  parseProductSheet,
  type ImportProblem,
  type ParsedImport,
} from "@/lib/product-import";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Códigos y SKU que ya existen, para avisar cuáles se repiten antes de guardar. */
  existing: { barcode: string | null; sku: string | null }[];
  /** Cuántos productos activos más entran en el plan. */
  remainingCapacity: number;
}

type Step = "pick" | "review" | "importing" | "done";

interface Summary {
  created: number;
  updated: number;
  skipped: number;
  problems: ImportProblem[];
  error?: string;
}

async function downloadTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = TEMPLATE_COLUMNS.map((c) => ({ value: c.title, fontWeight: "bold" as const }));
  const example = TEMPLATE_COLUMNS.map((c) => c.example);
  await writeXlsxFile([header, example], {
    columns: TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(14, c.title.length + 4) })),
  }).toFile("pesito-productos.xlsx");
}

async function readFile(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
    return parseCsv(await file.text());
  }
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

export function ProductImportDialog({ open, onClose, existing, remainingCapacity }: Props) {
  const { showSuccess } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const existingKeys = useMemo(() => {
    const barcodes = new Set<string>();
    const skus = new Set<string>();
    for (const p of existing) {
      if (p.barcode) barcodes.add(p.barcode.trim().toLowerCase());
      if (p.sku) skus.add(p.sku.trim().toLowerCase());
    }
    return { barcodes, skus };
  }, [existing]);

  const counts = useMemo(() => {
    if (!parsed) return { fresh: 0, known: 0 };
    let known = 0;
    for (const row of parsed.rows) {
      const isKnown =
        (row.barcode && existingKeys.barcodes.has(row.barcode.toLowerCase())) ||
        (row.sku && existingKeys.skus.has(row.sku.toLowerCase()));
      if (isKnown) known++;
    }
    return { fresh: parsed.rows.length - known, known };
  }, [parsed, existingKeys]);

  function reset() {
    setStep("pick");
    setFileName("");
    setParsed(null);
    setReadError(null);
    setUpdateExisting(false);
    setProgress(0);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (step === "importing") return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    try {
      const matrix = await readFile(file);
      const result = parseProductSheet(matrix);
      if (result.missingColumns.length > 0) {
        setReadError(
          `Falta${result.missingColumns.length > 1 ? "n las columnas" : " la columna"} ${result.missingColumns
            .map((c) => `“${c}”`)
            .join(" y ")}. Descargá la planilla modelo y usá esos títulos.`
        );
        return;
      }
      if (result.rows.length === 0) {
        setReadError(
          result.problems.length > 0
            ? "Ninguna fila se pudo leer. Revisá los datos de la planilla."
            : "No encontramos productos en la planilla."
        );
        setParsed(result.problems.length > 0 ? result : null);
        return;
      }
      if (result.rows.length > IMPORT_MAX_ROWS) {
        setReadError(`La planilla tiene demasiados productos (más de ${IMPORT_MAX_ROWS.toLocaleString("es-AR")}). Dividila en varios archivos.`);
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setStep("review");
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    }
  }

  async function startImport() {
    if (!parsed) return;
    setStep("importing");
    setProgress(0);
    const total: Summary = { created: 0, updated: 0, skipped: 0, problems: [...parsed.problems] };
    const rows = parsed.rows;
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE);
      const last = i + IMPORT_CHUNK_SIZE >= rows.length;
      let res;
      try {
        res = await importProductsChunk(chunk, { updateExisting, last });
      } catch {
        total.error = "Se cortó la conexión. Lo que ya se cargó quedó guardado; volvé a subir la planilla para seguir (los productos repetidos se omiten).";
        break;
      }
      total.created += res.created;
      total.updated += res.updated;
      total.skipped += res.skipped;
      total.problems.push(...res.problems);
      if (res.error) {
        total.error = res.error;
        break;
      }
      setProgress(Math.min(rows.length, i + chunk.length));
    }
    setSummary(total);
    setStep("done");
    if (!total.error && total.created + total.updated > 0) {
      showSuccess(
        "Carga terminada",
        `${total.created} producto${total.created === 1 ? "" : "s"} nuevo${total.created === 1 ? "" : "s"}${total.updated > 0 ? ` y ${total.updated} actualizado${total.updated === 1 ? "" : "s"}` : ""}.`
      );
    }
  }

  const overLimit = counts.fresh > remainingCapacity;

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Cargar productos desde Excel"
      description="Subí una planilla con tus productos y los cargamos todos juntos."
    >
      {step === "pick" && (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm text-foreground">
            <li>
              <span className="font-semibold">1.</span> Descargá la planilla modelo y completala con tus
              productos (o usá la tuya, con esos mismos títulos de columna).
            </li>
            <li>
              <span className="font-semibold">2.</span> Subila acá. Antes de guardar te mostramos cómo
              quedaría.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            {`Obligatorias: ${TEMPLATE_COLUMNS.filter((c) => c.required)
              .map((c) => c.title)
              .join(" y ")}. Las demás son opcionales. Si un producto ya existe (mismo código de barras o SKU), no se duplica.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              <Download className="h-4 w-4" />
              Descargar planilla modelo
            </Button>
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Subir planilla
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
          {readError && (
            <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{readError}</p>
          )}
          {parsed && parsed.problems.length > 0 && !readError?.startsWith("Falta") && (
            <ProblemList problems={parsed.problems} />
          )}
          <p className="text-xs text-muted-foreground">
            Funciona con Excel (.xlsx) y CSV. No cambia el stock de los productos que ya existen.
          </p>
        </div>
      )}

      {step === "review" && parsed && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="truncate">{fileName}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Productos nuevos" value={counts.fresh} tone="success" />
            <Stat label="Ya existen" value={counts.known} />
            <Stat label="Con errores" value={parsed.problems.length} tone={parsed.problems.length > 0 ? "danger" : undefined} />
          </div>

          {overLimit && (
            <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
              {`Tu plan admite ${remainingCapacity.toLocaleString("es-AR")} productos activos más y la planilla trae ${counts.fresh.toLocaleString("es-AR")} nuevos. Se cargan los primeros ${remainingCapacity.toLocaleString("es-AR")}; el resto queda afuera.`}
            </p>
          )}

          {counts.known > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3.5 text-sm">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="font-medium text-foreground">Actualizar los que ya existen</span>
                <span className="block text-xs text-muted-foreground">
                  Cambia el precio, el costo y la marca. Sin tildar, esos productos se dejan como están.
                </span>
              </span>
            </label>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa (primeros 5)
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className="max-w-[14rem] truncate px-3 py-2 text-foreground">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.barcode || r.sku || "—"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.cost ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-foreground">{r.price}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parsed.ignoredColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {`Columnas que no usamos: ${parsed.ignoredColumns.join(", ")}.`}
            </p>
          )}
          {parsed.problems.length > 0 && <ProblemList problems={parsed.problems} />}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Elegir otro archivo
            </Button>
            <Button onClick={() => void startImport()} disabled={counts.fresh + (updateExisting ? counts.known : 0) === 0}>
              {`Cargar ${(counts.fresh + (updateExisting ? counts.known : 0)).toLocaleString("es-AR")} productos`}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && parsed && (
        <div className="space-y-3 py-4 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {`Cargando ${progress.toLocaleString("es-AR")} de ${parsed.rows.length.toLocaleString("es-AR")}…`}
          </p>
          <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(progress / parsed.rows.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">No cierres esta ventana.</p>
        </div>
      )}

      {step === "done" && summary && (
        <div className="space-y-4">
          {summary.error ? (
            <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{summary.error}</p>
          ) : (
            <p className="rounded-xl bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success">
              Listo, la carga terminó.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Cargados" value={summary.created} tone="success" />
            <Stat label="Actualizados" value={summary.updated} />
            <Stat label="Omitidos" value={summary.skipped} />
          </div>
          {summary.problems.length > 0 && <ProblemList problems={summary.problems} />}
          <div className="flex justify-end">
            <Button onClick={close}>Cerrar</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-border px-2 py-3">
      <p
        className={
          tone === "success"
            ? "text-xl font-bold text-success"
            : tone === "danger"
              ? "text-xl font-bold text-danger"
              : "text-xl font-bold text-foreground"
        }
      >
        {value.toLocaleString("es-AR")}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProblemList({ problems }: { problems: ImportProblem[] }) {
  const shown = problems.slice(0, 50);
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        {`Filas con problemas (${problems.length.toLocaleString("es-AR")})`}
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto px-3 py-2 text-xs text-muted-foreground">
        {shown.map((p, i) => (
          <li key={`${p.line}-${i}`}>{`Fila ${p.line}: ${p.message}`}</li>
        ))}
        {problems.length > shown.length && <li>{`… y ${problems.length - shown.length} más.`}</li>}
      </ul>
    </div>
  );
}
