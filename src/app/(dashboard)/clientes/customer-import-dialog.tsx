"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast/toast-provider";
import { cn } from "@/lib/utils";
import { importCustomersChunk } from "@/app/(dashboard)/clientes/import-actions";
import { downloadCustomerTemplate } from "@/app/(dashboard)/clientes/customer-excel";
import {
  CUSTOMER_IMPORT_CHUNK_SIZE,
  CUSTOMER_IMPORT_MAX_ROWS,
  CUSTOMER_UPDATE_FIELDS,
  buildCustomerIndex,
  matchCustomer,
  parseCsv,
  parseCustomerSheet,
  type CustomerImportProblem,
  type CustomerUpdateField,
  type KnownCustomer,
  type ParsedCustomerImport,
} from "@/lib/customer-import";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Los clientes que ya existen, para avisar cuáles coinciden antes de guardar. */
  existing: KnownCustomer[];
}

type Step = "pick" | "review" | "importing" | "done";

interface Summary {
  created: number;
  updated: number;
  skipped: number;
  problems: CustomerImportProblem[];
  error?: string;
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

const defaultFields = () =>
  new Set<CustomerUpdateField>(CUSTOMER_UPDATE_FIELDS.filter((f) => f.defaultOn).map((f) => f.field));

export function CustomerImportDialog({ open, onClose, existing }: Props) {
  const { showSuccess } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCustomerImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [fields, setFields] = useState<Set<CustomerUpdateField>>(defaultFields);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const index = useMemo(() => buildCustomerIndex(existing), [existing]);

  const matches = useMemo(() => {
    if (!parsed) return new Map<number, string | null>();
    return new Map(parsed.rows.map((r) => [r.line, matchCustomer(r, index)]));
  }, [parsed, index]);

  const counts = useMemo(() => {
    if (!parsed) return { fresh: 0, known: 0 };
    let known = 0;
    for (const row of parsed.rows) if (matches.get(row.line)) known++;
    return { fresh: parsed.rows.length - known, known };
  }, [parsed, matches]);

  function reset() {
    setStep("pick");
    setFileName("");
    setParsed(null);
    setReadError(null);
    setUpdateExisting(false);
    setFields(defaultFields());
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
      const result = parseCustomerSheet(matrix);
      if (result.missingColumns.length > 0) {
        setReadError(
          `Falta la columna “${result.missingColumns[0]}”. Descargá la planilla modelo y usá esos títulos.`
        );
        return;
      }
      if (result.rows.length === 0) {
        setReadError(
          result.problems.length > 0
            ? "Ninguna fila se pudo leer. Revisá los datos de la planilla."
            : "No encontramos clientes en la planilla."
        );
        setParsed(result.problems.length > 0 ? result : null);
        return;
      }
      if (result.rows.length > CUSTOMER_IMPORT_MAX_ROWS) {
        setReadError(`La planilla tiene demasiados clientes (más de ${CUSTOMER_IMPORT_MAX_ROWS.toLocaleString("es-AR")}). Dividila en varios archivos.`);
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
    for (let i = 0; i < rows.length; i += CUSTOMER_IMPORT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CUSTOMER_IMPORT_CHUNK_SIZE);
      const last = i + CUSTOMER_IMPORT_CHUNK_SIZE >= rows.length;
      let res;
      try {
        res = await importCustomersChunk(chunk, { updateFields: updateExisting ? [...fields] : [], last });
      } catch {
        total.error =
          "Se cortó la conexión. Lo que ya se cargó quedó guardado; volvé a subir la planilla para seguir (los clientes repetidos se omiten).";
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
        `${total.created} cliente${total.created === 1 ? "" : "s"} nuevo${total.created === 1 ? "" : "s"}${total.updated > 0 ? ` y ${total.updated} actualizado${total.updated === 1 ? "" : "s"}` : ""}.`
      );
    }
  }

  const toSave = counts.fresh + (updateExisting && fields.size > 0 ? counts.known : 0);

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Cargar clientes desde Excel"
      description="Subí una planilla con tus clientes y los cargamos todos juntos."
    >
      {step === "pick" && (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm text-foreground">
            <li>
              <span className="font-semibold">1.</span> Descargá la planilla modelo y completala (o exportá tus
              clientes, corregí lo que quieras y volvé a subirla: la columna ID evita que se dupliquen).
            </li>
            <li>
              <span className="font-semibold">2.</span> Subila acá. Antes de guardar te mostramos cómo quedaría.
            </li>
          </ol>
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Se carga:</span> nombre (obligatorio), razón social,
              teléfono, mail, documento, tipo de factura y notas.
            </p>
            <p className="mt-1.5">
              <span className="font-semibold text-foreground">Nunca se modifica:</span> lo que cada cliente debe (el
              saldo de fiado), sus ventas y sus pagos. El fiado sólo cambia vendiendo a fiado o registrando un cobro.
              Si la planilla trae una columna de saldo, se ignora.
            </p>
            <p className="mt-1.5">
              <span className="font-semibold text-foreground">Si un cliente ya existe</span> (mismo ID, documento,
              mail, teléfono o nombre), no se crea de nuevo: por defecto se deja como está. Si querés, antes de cargar
              elegís qué datos actualizar. Una celda vacía nunca borra un dato que ya está cargado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadCustomerTemplate()}>
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
          {readError && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{readError}</p>}
          {parsed && parsed.problems.length > 0 && <ProblemList problems={parsed.problems} />}
          <p className="text-xs text-muted-foreground">Funciona con Excel (.xlsx) y CSV.</p>
        </div>
      )}

      {step === "review" && parsed && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="truncate">{fileName}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Clientes nuevos" value={counts.fresh} tone="success" />
            <Stat label="Ya existen" value={counts.known} />
            <Stat label="Con errores" value={parsed.problems.length} tone={parsed.problems.length > 0 ? "danger" : undefined} />
          </div>

          {parsed.readOnlyColumns.length > 0 && (
            <p className="rounded-xl bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
              {`La planilla trae ${parsed.readOnlyColumns.map((c) => `“${c}”`).join(", ")}: son sólo para mirar y no se importan. Lo que debe cada cliente no se modifica.`}
            </p>
          )}

          {counts.known > 0 && (
            <div className="rounded-xl border border-border p-3.5">
              <Toggle
                checked={updateExisting}
                onChange={setUpdateExisting}
                label={`Actualizar los ${counts.known.toLocaleString("es-AR")} que ya existen`}
                hint="Sin activar, esos clientes se dejan como están. Lo que deben nunca se modifica."
              />
              {updateExisting && (
                <div className="mt-3 space-y-2.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Qué datos actualizar
                  </p>
                  {CUSTOMER_UPDATE_FIELDS.map((f) => (
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

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa (primeros 5)
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Teléfono</th>
                    <th className="px-3 py-2">Mail</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className="max-w-[12rem] truncate px-3 py-2 text-foreground">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.document || "—"}</td>
                      <td className="px-3 py-2">
                        {matches.get(r.line) ? (
                          <span className="text-muted-foreground">Ya existe</span>
                        ) : (
                          <span className="font-semibold text-success">Nuevo</span>
                        )}
                      </td>
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
            <Button onClick={() => void startImport()} disabled={toSave === 0}>
              {`Cargar ${toSave.toLocaleString("es-AR")} clientes`}
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

function ProblemList({ problems }: { problems: CustomerImportProblem[] }) {
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
