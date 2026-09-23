import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { planDefinitions } from "@/lib/plan-features";

type Mark = "yes" | "no";

interface Row {
  question: string;
  pesito: Mark;
  excel: Mark;
  otros: Mark;
}

// Ninguna fila inventa un dato que no podamos sostener (por eso no hay
// tiempos de respuesta ni precios de terceros específicos). Sólo sí/no:
// nada de un tercer estado "depende" que complica la lectura rápida.
const rows: Row[] = [
  {
    question: "¿Podés arrancar sin pagar nada?",
    pesito: "yes",
    excel: "yes",
    otros: "no",
  },
  {
    question: "¿El stock se actualiza solo con cada venta?",
    pesito: "yes",
    excel: "no",
    otros: "yes",
  },
  {
    question: "¿Lleva la cuenta de quién te debe (fiado)?",
    pesito: "yes",
    excel: "no",
    otros: "no",
  },
  {
    question: "¿Funciona desde el celu, sin instalar nada?",
    pesito: "yes",
    excel: "no",
    otros: "no",
  },
  {
    question: "¿Te contesta una persona cuando escribís?",
    pesito: "yes",
    excel: "no",
    otros: "no",
  },
];

const columns = [
  {
    id: "pesito" as const,
    label: "Pesito",
    price: `Desde ${planDefinitions.esencial.priceLabel}/mes`,
    priceSub: "y un plan gratis para arrancar",
  },
  {
    id: "excel" as const,
    label: "Excel o cuaderno",
    price: "Sin costo",
    priceSub: "hasta que un error te cuesta caro",
  },
  {
    id: "otros" as const,
    label: "Otros sistemas",
    price: "Varía",
    priceSub: "según el proveedor",
  },
];

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "yes") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success-bg text-success">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-danger-bg text-danger">
      <X className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  );
}

export function Comparison() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          ¿Pesito o lo que ya venís usando?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Sin vueltas: así se compara con el cuaderno de siempre y con otros sistemas del mercado.
        </p>
      </div>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-[38%]" />
              {columns.map((col) => (
                <th key={col.id} className="px-2 pb-4 text-center align-bottom sm:px-4">
                  <span
                    className={cn(
                      "inline-block text-sm font-semibold",
                      col.id === "pesito" ? "text-primary" : "text-foreground"
                    )}
                  >
                    {col.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{col.price}</span>
                  <span className="block text-[11px] text-muted-foreground/70">
                    {col.priceSub}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.question}>
                <td
                  className={cn(
                    "py-4 pr-4 text-sm text-foreground",
                    i !== 0 && "border-t border-border"
                  )}
                >
                  {row.question}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-2 py-4 text-center sm:px-4",
                      i !== 0 && "border-t border-border",
                      col.id === "pesito" && "bg-accent/40"
                    )}
                  >
                    <MarkIcon mark={row[col.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Comparación general, hecha por Pesito. No apunta a una marca puntual.
      </p>
    </section>
  );
}
