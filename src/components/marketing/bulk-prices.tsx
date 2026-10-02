import { Check, TrendingUp } from "lucide-react";
import { BulkPricesCard } from "@/components/marketing/bulk-prices-card";

// El aumento masivo por proveedor o marca (Productos → "Aumentar precios" /
// "Aumentar costos") está en todos los planes. Los números del ejemplo son
// ilustrativos.
const points = [
  "Por proveedor o por marca, en un solo paso",
  "En porcentaje o con un monto fijo",
  "Subís el costo y el precio de venta juntos, en la misma proporción",
  "Si te equivocás, lo deshacés. Los cambios quedan en el historial",
];

const exampleRows = [
  { name: "Galletitas surtidas 300 g", before: 1850, after: 2090 },
  { name: "Alfajor triple", before: 1200, after: 1356 },
  { name: "Gaseosa cola 2,25 L", before: 3400, after: 3842 },
];

export function BulkPrices() {
  return (
    <section className="bg-block text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5" />
            Lo que otros sistemas no te resuelven
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl">
            ¿Te aumentó el proveedor? <span className="text-emerald-200">Actualizás todo en segundos</span>
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Elegís el proveedor o la marca, ponés el porcentaje y Pesito actualiza
            los precios o los costos de todos sus productos de una vez. Nada de
            cambiar uno por uno.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-white">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm font-medium text-white">
            Incluido en el Plan Pro. Lo probás gratis los primeros 14 días.
          </p>
        </div>

        <BulkPricesCard rows={exampleRows} />
      </div>
    </section>
  );
}
