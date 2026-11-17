"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { PaginationBar, usePagination } from "@/components/dashboard/pagination-bar";
import { cn } from "@/lib/utils";
import { importProductsChunk } from "@/app/(dashboard)/productos/import-actions";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_ROWS,
  TEMPLATE_COLUMNS,
  UPDATE_FIELDS,
  parseCsv,
  makeProductMatcher,
  parseProductSheet,
  resolveExistingPrice,
  type ImportProblem,
  type ParsedImport,
  type UpdateField,
} from "@/lib/product-import";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Códigos y SKU que ya existen, para avisar cuáles se repiten antes de guardar. */
  existing: { id: string; name: string; barcode: string | null; sku: string; price: number; cost: number | null }[];
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

// Columnas que hay que completar sí o sí (en rojo y con *): el nombre y el precio (o costo + % de ganancia).
const REQUIRED_TITLES = new Set(["Nombre", "SKU", "Precio de venta"]);

async function downloadTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = TEMPLATE_COLUMNS.map((c) =>
    REQUIRED_TITLES.has(c.title)
      ? { value: `${c.title} *`, fontWeight: "bold" as const, textColor: "#b91c1c", backgroundColor: "#fee2e2" }
      : { value: c.title, fontWeight: "bold" as const, backgroundColor: "#f3f4f6" }
  );
  const example = TEMPLATE_COLUMNS.map((c) => c.example);
  const help: { value: string; fontWeight?: "bold"; textColor?: string }[][] = [
    [{ value: "Cómo completar la planilla", fontWeight: "bold" }],
    [{ value: "* Las columnas en rojo son obligatorias: Nombre, SKU y Precio de venta." }],
    [{ value: "El SKU es el código propio de cada producto y no se puede repetir: es lo que usamos para reconocerlo. Si ya existe un producto con ese SKU, no se duplica: se actualiza (si lo elegís al subir) o se omite." }],
    [{ value: "En vez del precio podés poner el Costo y la Ganancia sobre el costo (%): el precio se calcula solo. Si cargás precio y %, vale el precio." }],
    [{ value: "Todas las demás columnas son opcionales. Podés borrar las que no uses, pero no cambies los títulos." }],
    [{ value: "Si un producto ya existe (mismo SKU) no se duplica: al subirla podés elegir actualizar su precio, costo, marca, proveedor, etc. El stock nunca se modifica." }],
    [{ value: "Unidad: u, kg, g, l, ml, pack o caja. La marca y el proveedor que no existan se crean." }],
    [{ value: "La primera fila de la hoja “Productos” es un ejemplo: borrala o reemplazala." }],
  ];
  await writeXlsxFile([
    { data: [header, example], sheet: "Productos", columns: TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(16, c.title.length + 6) })), stickyRowsCount: 1 },
    { data: help, sheet: "Cómo completarla", columns: [{ width: 120 }] },
  ]).toFile("pesito-productos.xlsx");
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
  const [fields, setFields] = useState<Set<UpdateField>>(
    () => new Set(UPDATE_FIELDS.filter((f) => f.defaultOn).map((f) => f.field))
  );
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const existingKeys = useMemo(() => {
    return makeProductMatcher(existing);
  }, [existing]);

  const counts = useMemo(() => {
    if (!parsed) return { fresh: 0, known: 0 };
    let known = 0;
    for (const row of parsed.rows) {
      if (existingKeys.find(row)) known++;
    }
    return { fresh: parsed.rows.length - known, known };
  }, [parsed, existingKeys]);

  // Qué cambiaría en los productos que ya existen (mismo criterio que el servidor: se reconocen por SKU).
  const changes = useMemo(() => {
    if (!parsed || !updateExisting) return [];
    const out: PriceChange[] = [];
    for (const row of parsed.rows) {
      const product = existingKeys.find(row);
      if (!product) continue;
      const resolved = fields.has("price") ? resolveExistingPrice(row, product) : null;
      const newPrice = resolved !== null && Math.abs(resolved - product.price) > 0.005 ? resolved : null;
      const newCost = fields.has("cost") && row.cost !== null && row.cost !== product.cost ? row.cost : null;
      if (newPrice === null && newCost === null) continue;
      out.push({ key: `${row.line}`, name: product.name, oldPrice: product.price, newPrice, oldCost: product.cost, newCost });
    }
    return out;
  }, [parsed, updateExisting, fields, existingKeys]);

  function reset() {
    setStep("pick");
    setFileName("");
    setParsed(null);
    setReadError(null);
    setUpdateExisting(false);
    setFields(new Set(UPDATE_FIELDS.filter((f) => f.defaultOn).map((f) => f.field)));
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
        res = await importProductsChunk(chunk, { updateFields: updateExisting ? [...fields] : [], last });
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
              productos (o usá la tuya, con esos mismos títulos de columna). También sirve la planilla que bajás de Pesito con “Descargar Excel”: editala y volvela a subir para cambiar precios, costos o ganancias de muchos productos juntos.
            </li>
            <li>
              <span className="font-semibold">2.</span> Subila acá. Antes de guardar te mostramos cómo
              quedaría.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            {`Obligatorias: ${TEMPLATE_COLUMNS.filter((c) => c.required)
              .map((c) => c.title)
              .join(" y ")} y el precio: el Precio de venta, o el Costo con la Ganancia sobre el costo (%) y el precio se calcula solo (si cargás los dos, vale el precio). Las demás son opcionales. Si un producto ya existe (mismo SKU), no se crea de nuevo: por defecto se deja como está y no se modifica. Si querés, antes de cargar podés elegir qué datos actualizar con los de la planilla (precio, costo, marca, nombre, etc.). Su stock nunca se toca.`}
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
            <div className="rounded-xl border border-border p-3.5">
              <Toggle
                checked={updateExisting}
                onChange={setUpdateExisting}
                label={`Actualizar los ${counts.known.toLocaleString("es-AR")} que ya existen`}
                hint="Sin activar, esos productos se dejan como están. El stock nunca se modifica."
              />
              {updateExisting && (
                <div className="mt-3 space-y-2.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Qué datos actualizar
                  </p>
                  {UPDATE_FIELDS.map((f) => (
                    <Toggle
                      key={f.field}
                      small
                      checked={fields.has(f.field)}
                      onChange={(on) =>
                        setFields((current) => {
                          const next = new Set(current);
                          if (on) next.add(f.field);
                          else next.delete(f.field);
                          return next;
                        })
                      }
                      label={f.label}
                      hint={f.hint}
                    />
                  ))}
                  {fields.size === 0 && (
                    <p className="text-xs text-warning">Elegí al menos un dato o desactivá la actualización.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {updateExisting && (fields.has("price") || fields.has("cost")) && <PriceChangesPreview changes={changes} />}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa (primeros 5)
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className="max-w-[14rem] truncate px-3 py-2 text-foreground">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.sku}</td>
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
            <Button onClick={() => void startImport()} disabled={counts.fresh + (updateExisting && fields.size > 0 ? counts.known : 0) === 0}>
              {`Cargar ${(counts.fresh + (updateExisting && fields.size > 0 ? counts.known : 0)).toLocaleString("es-AR")} productos`}
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

interface PriceChange {
  key: string;
  name: string;
  oldPrice: number;
  newPrice: number | null;
  oldCost: number | null;
  newCost: number | null;
}

const money = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const pctOf = (from: number, to: number) => (from > 0 ? ((to / from - 1) * 100) : null);

// "Antes → después" de los precios y costos de los productos que ya existen, para revisar antes de confirmar.
function PriceChangesPreview({ changes }: { changes: PriceChange[] }) {
  const [onlyBig, setOnlyBig] = useState(false);
  const isBig = (c: PriceChange) => {
    const p = c.newPrice !== null ? pctOf(c.oldPrice, c.newPrice) : null;
    return p !== null && Math.abs(p) >= 30;
  };
  const shown = onlyBig ? changes.filter(isBig) : changes;
  const pg = usePagination(shown.length, String(onlyBig), "pesito:import-preview:pagesize");
  const up = changes.filter((c) => c.newPrice !== null && c.newPrice > c.oldPrice).length;
  const down = changes.filter((c) => c.newPrice !== null && c.newPrice < c.oldPrice).length;
  const big = changes.filter(isBig).length;

  if (changes.length === 0) {
    return <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Ningún producto existente cambia de precio ni de costo con esta planilla.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cambios en productos que ya existen</p>
      <p className="text-sm text-foreground">
        {`${changes.length.toLocaleString("es-AR")} cambian`}
        {up + down > 0 && ` · precio: ${up.toLocaleString("es-AR")} suben, ${down.toLocaleString("es-AR")} bajan`}
      </p>
      {big > 0 && (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-warning-bg px-3 py-2 text-xs text-foreground">
          <input type="checkbox" checked={onlyBig} onChange={(e) => setOnlyBig(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
          {`Mostrar sólo los ${big.toLocaleString("es-AR")} con un cambio de precio de 30% o más (revisalos por si hay un error en la planilla)`}
        </label>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-right">Costo</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(pg.start, pg.end).map((c) => {
              const p = c.newPrice !== null ? pctOf(c.oldPrice, c.newPrice) : null;
              return (
                <tr key={c.key} className="border-t border-border">
                  <td className="max-w-[14rem] truncate px-3 py-2 text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-right">
                    {c.newPrice === null ? (
                      <span className="text-muted-foreground">sin cambio</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground line-through">{money(c.oldPrice)}</span>
                        {" → "}
                        <b className="text-foreground">{money(c.newPrice)}</b>
                        {p !== null && <span className={p > 0 ? "text-success" : "text-danger"}>{` (${p > 0 ? "+" : ""}${p.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)`}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.newCost === null ? (
                      <span className="text-muted-foreground">sin cambio</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground line-through">{c.oldCost === null ? "—" : money(c.oldCost)}</span>
                        {" → "}
                        <b className="text-foreground">{money(c.newCost)}</b>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar total={shown.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} noun="productos" />
      </div>
    </div>
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

function Toggle({
  checked,
  onChange,
  label,
  hint,
  small,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={small ? "text-sm text-foreground" : "text-sm font-medium text-foreground"}>{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
