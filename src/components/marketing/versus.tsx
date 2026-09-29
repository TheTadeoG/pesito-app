import { StaggerIn } from "@/components/marketing/stagger-in";

// Sólo lo que más tiempo le ahorra al comerciante. Todo existe hoy: cada fila
// nombra el plan que lo incluye.
const rows = [
  {
    before: "Te aumenta el proveedor y cambiás los precios uno por uno.",
    after: "Subís precios y costos por proveedor o marca en un solo paso. Si te equivocás, lo deshacés.",
    plan: "Plan Pro",
  },
  {
    before: "Armás el pedido a cada proveedor de memoria.",
    after: "Pesito calcula qué pedirle a cada uno y cuánto. Lo mandás por WhatsApp.",
    plan: "Plan IA",
  },
  {
    before: "Cargás tu catálogo artículo por artículo.",
    after: "Lo subís de una vez desde un Excel.",
    plan: "Plan Esencial",
  },
];

export function Versus() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground sm:text-5xl">
          Lo que hoy te lleva horas, <span className="text-primary">Pesito lo hace en un paso</span>
        </h2>
      </div>

      <div className="mx-auto mt-10 max-w-4xl">
        <div className="mb-3 hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide md:grid md:grid-cols-2">
          <span className="text-muted-foreground">Hoy, a mano</span>
          <span className="text-primary">Con Pesito</span>
        </div>
        <StaggerIn className="space-y-3">
          {rows.map((row) => (
            <div key={row.before} className="grid overflow-hidden rounded-card border border-border md:grid-cols-2">
              <p className="bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground sm:p-5 sm:text-base">
                {row.before}
              </p>
              <div className="border-t border-border bg-card p-4 sm:p-5 md:border-l md:border-t-0">
                <p className="text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                  {row.after}
                </p>
                {row.plan && (
                  <span className="mt-3 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {row.plan}
                  </span>
                )}
              </div>
            </div>
          ))}
        </StaggerIn>
      </div>
    </section>
  );
}
